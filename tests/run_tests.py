#!/usr/bin/env python3
"""
First Light — automated test suite (web + Android-app behaviour).

Runs the real app in a headless phone-sized Chromium and checks valid and invalid behaviour.
Spotify, YouTube and the Android bridge are replaced by local stand-ins (tests/mocks/), so no
accounts or phone are needed. Android-only flows run with a fake bridge that records every call.

Usage:
    pip install playwright && playwright install chromium
    python3 tests/run_tests.py            # all tests
    python3 tests/run_tests.py spotify    # only tests whose name or group contains "spotify"
Writes tests/TEST-REPORT.md.
"""
import asyncio, json, os, re, sys, time, threading, http.server, socketserver, functools, traceback
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / 'tests' / 'fixtures'
MOCKS = ROOT / 'tests' / 'mocks'
PORT = 8155
BASE = f'http://localhost:{PORT}'
URL = f'{BASE}/www/index.html'
WEB = ROOT / 'www'
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']

TESTS = []
def test(group, kind, name):
    def deco(fn):
        TESTS.append({'group': group, 'kind': kind, 'name': name, 'fn': fn})
        return fn
    return deco

class Fail(AssertionError):
    pass

def check(cond, msg):
    if not cond:
        raise Fail(msg)

# ---------------------------------------------------------------- page helper
class App:
    def __init__(self, browser):
        self.browser = browser
        self.errors = []
        self.calls = []        # Spotify API calls seen
        self.spotify = {}      # Spotify mock behaviour
        self.ctx = None
        self.pg = None

    async def open(self, *, battery=(0.82, False), clock=True, seed=None, deny_camera=False, spotify=None, youtube=None, sw='block', onboarded=True, native=None, greet=False, at=None):
        self.ctx = await self.browser.new_context(viewport={'width': 390, 'height': 844}, service_workers=sw, timezone_id='Asia/Kolkata')
        seed = dict(seed or {})
        if onboarded and 'fl:profile' not in seed:
            seed['fl:profile'] = {'name': 'Priya', 'onboarded': True}
        if native is not None:
            await self.ctx.add_init_script(f'window.__nativeInit = {json.dumps(native)};')
            await self.ctx.route('**/vendor/capacitor.js', lambda r: r.fulfill(path=str(MOCKS / "capacitor-native.js"), content_type='text/javascript'))
        if battery == 'none':
            await self.ctx.add_init_script("Object.defineProperty(navigator, 'getBattery', { value: undefined, configurable: true });")
        elif battery:
            lvl, chg = battery
            await self.ctx.add_init_script(f"""(() => {{
              const b = new EventTarget(); b.level = {lvl}; b.charging = {str(chg).lower()};
              window.__setBattery = (l, c) => {{ b.level = l; b.charging = c; b.dispatchEvent(new Event('levelchange')); b.dispatchEvent(new Event('chargingchange')); }};
              navigator.getBattery = () => Promise.resolve(b);
            }})();""")
        if seed:
            await self.ctx.add_init_script(f"""(() => {{
              if (sessionStorage.getItem('__seeded')) return;
              const seed = {json.dumps(seed)};
              for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
              sessionStorage.setItem('__seeded', '1');
            }})();""")
        if deny_camera:
            await self.ctx.add_init_script("navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));")
        if spotify is not None:
            self.spotify = {'play': 'ok', 'refresh': 'ok', 'sdk': 'ok', **spotify}
            await self.ctx.add_init_script(f"window.__spotifySdkMode = {json.dumps(self.spotify['sdk'])};")
            await self._route_spotify()
        if youtube is not None:
            await self.ctx.add_init_script(f"window.__ytMode = {json.dumps(youtube)};")
            await self.ctx.route('https://www.youtube.com/iframe_api', lambda r: r.fulfill(path=str(MOCKS / 'youtube-api.js'), content_type='text/javascript'))
        self.pg = await self.ctx.new_page()
        self.pg.on('pageerror', lambda e: self.errors.append(str(e)))
        if clock:
            if at:
                from datetime import datetime as _dt, timezone as _tz
                await self.pg.clock.install(time=_dt.fromtimestamp(at / 1000, _tz.utc))
            else:
                await self.pg.clock.install()
        await self.pg.goto(URL)
        await self.pg.wait_for_timeout(500)
        if not greet:
            await self.pg.evaluate("document.querySelector('.greet')?.remove()")
        return self.pg

    async def close(self):
        if self.ctx:
            await self.ctx.close()

    # -- Spotify stand-in -------------------------------------------------
    async def _route_spotify(self):
        async def authorize(route):
            q = parse_qs(urlparse(route.request.url).query)
            self.calls.append(('AUTHORIZE', q.get('code_challenge_method', [''])[0]))
            state = q['state'][0] if self.spotify.get('state') != 'wrong' else 'tampered'
            loc = f"{q['redirect_uri'][0]}?error=access_denied&state={state}" if self.spotify.get('deny') else f"{q['redirect_uri'][0]}?code=CODE123&state={state}"
            await route.fulfill(status=302, headers={'Location': loc})
        async def token(route):
            body = parse_qs(route.request.post_data or '')
            grant = body.get('grant_type', [''])[0]
            self.calls.append(('TOKEN', grant))
            if grant == 'authorization_code' and not body.get('code_verifier'):
                return await route.fulfill(status=400, json={'error': 'invalid_request'})
            if grant == 'refresh_token' and self.spotify['refresh'] == 'fail':
                return await route.fulfill(status=400, json={'error': 'invalid_grant'})
            await route.fulfill(json={'access_token': 'ACCESS-' + grant, 'refresh_token': 'REFRESH', 'expires_in': 3600})
        async def api(route):
            req = route.request
            path = urlparse(req.url).path.replace('/v1', '', 1)
            self.calls.append((req.method, path + ('?' + urlparse(req.url).query if urlparse(req.url).query else ''), req.post_data))
            if req.headers.get('authorization', '').endswith('EXPIRED'):
                return await route.fulfill(status=401, json={'error': {'status': 401, 'message': 'The access token expired'}})
            if path == '/me':
                return await route.fulfill(json={'display_name': 'Test User', 'id': 'tester'})
            if path == '/me/playlists':
                return await route.fulfill(json={'items': [
                    {'id': 'pl1', 'name': 'Rise and shine', 'uri': 'spotify:playlist:pl1', 'items': {'total': 7}},
                    {'id': 'pl2', 'name': 'Loud mornings', 'uri': 'spotify:playlist:pl2', 'tracks': {'total': 3}}]})
            if path == '/me/player/devices':
                return await route.fulfill(json={'devices': [{'id': 'phone-1', 'type': 'Smartphone', 'is_active': True}]})
            if path == '/me/player/play':
                if self.spotify['play'] == 'premium':
                    return await route.fulfill(status=403, json={'error': {'status': 403, 'message': 'Player command failed: Premium required', 'reason': 'PREMIUM_REQUIRED'}})
                return await route.fulfill(status=204)
            if path == '/me/player':
                return await route.fulfill(json={'is_playing': True})
            if path.startswith('/me/player/'):
                return await route.fulfill(status=204)
            await route.fulfill(status=404, json={'error': {'status': 404, 'message': 'not mocked'}})
        await self.ctx.route('https://accounts.spotify.com/authorize**', authorize)
        await self.ctx.route('https://accounts.spotify.com/api/token', token)
        await self.ctx.route('https://api.spotify.com/**', api)
        await self.ctx.route('https://sdk.scdn.co/spotify-player.js', lambda r: r.fulfill(path=str(MOCKS / 'spotify-sdk.js'), content_type='text/javascript'))

    # -- actions ------------------------------------------------------------
    async def js(self, module, expr):
        return await self.pg.evaluate(f"async () => {{ const m = await import('./js/{module}'); return ({expr}); }}")

    async def native_calls(self, method=None):
        c = await self.pg.evaluate('window.__nativeCalls || []')
        return [x for x in c if method is None or x['method'] == method]

    async def tick(self, ms):
        await self.pg.clock.run_for(ms)
        await self.pg.wait_for_timeout(150)

    async def tab(self, name):
        await self.pg.click(f'[data-go={name}]')
        await self.pg.wait_for_timeout(200)

    async def fire_test_alarm(self):
        await self.pg.click('[data-ref=test]')
        await self.tick(11_000)
        await self.pg.wait_for_timeout(300)

    async def fire_direct(self, test=True):
        await self.js('core/events.js', f"m.emit('alarm:fire', {{ test: {str(test).lower()} }})")
        await self.pg.wait_for_timeout(400)

    async def phrase(self):
        return await self.pg.get_attribute('#morning [data-ref=phrase]', 'aria-label')

    async def type_phrase(self, text=None):
        text = await self.phrase() if text is None else text
        await self.pg.fill('#morning [data-ref=input]', text)
        await self.pg.click('#morning [data-ref=stop]')
        await self.pg.wait_for_timeout(250)

    async def phase(self):
        return await self.js('features/morning.js', 'm.get()?.phase ?? null')

    async def prove_current_task(self, retake=False):
        await self.pg.click('#morning [data-gate] button.gold')
        await self.pg.wait_for_timeout(1200)
        await self.pg.click('#camera [data-act=snap]')
        await self.pg.wait_for_timeout(300)
        if retake:
            await self.pg.click('#camera [data-act=retake]')
            await self.pg.wait_for_timeout(1200)
            await self.pg.click('#camera [data-act=snap]')
            await self.pg.wait_for_timeout(300)
        await self.pg.click('#camera [data-act=next]')
        await self.pg.wait_for_timeout(300)

    async def arm_by_keyboard(self):
        await self.pg.focus('[data-ref=thumb]')
        await self.pg.keyboard.press('Enter')
        await self.pg.wait_for_timeout(300)

    async def toast_text(self):
        els = await self.pg.query_selector_all('.toast')
        return ' | '.join([await e.inner_text() for e in els])

    async def visible(self, sel):
        return await self.pg.is_visible(sel)

ONE_TASK = [{'id': 'only', 'name': 'Drink water', 'proof': 'a glass of water', 'gapMin': 0}]

# ================================================================== tests
# ---------- App shell
@test('App', 'valid', 'Loads with no errors, correct title and five tabs')
async def t_shell(a):
    pg = await a.open()
    check(await pg.title() == 'First Light', 'title should be First Light')
    check(len(await pg.query_selector_all('nav.tabs [data-go]')) == 5, 'expected 5 tabs')

@test('App', 'valid', 'Every tab opens and shows its heading')
async def t_tabs(a):
    pg = await a.open()
    for tab, head in [('tasks', 'Morning tasks'), ('sounds', 'Sounds'), ('settings', 'Settings')]:
        await a.tab(tab)
        check(head in await pg.inner_text(f'[data-tab={tab}] h1'), f'{tab} heading')
    await a.tab('progress')
    check('mornings proven in a row' in await pg.inner_text('[data-tab=progress]'), 'progress caption')

@test('App', 'valid', 'Classic fonts are bundled and load offline (Bodoni Moda, EB Garamond)')
async def t_fonts(a):
    pg = await a.open()
    ok = await pg.evaluate("async () => { await document.fonts.ready; return [document.fonts.check('600 20px \"Bodoni Moda\"'), document.fonts.check('400 18px \"EB Garamond\"')]; }")
    check(all(ok), f'fonts loaded: {ok}')

@test('App', 'valid', 'Every button has an accessible name')
async def t_a11y(a):
    pg = await a.open()
    for tab in ['alarm', 'tasks', 'sounds', 'progress', 'settings']:
        await a.tab(tab)
        bad = await pg.evaluate("() => [...document.querySelectorAll('main button, nav button')].filter(b => b.offsetParent && !(b.innerText.trim() || b.getAttribute('aria-label'))).map(b => b.outerHTML.slice(0, 80))")
        check(not bad, f'unnamed buttons on {tab}: {bad}')

@test('App', 'invalid', 'Corrupted saved data falls back to defaults instead of crashing')
async def t_corrupt(a):
    pg = await a.open(seed={'fl:tasks': '{not json', 'fl:alarm': '[[[', 'fl:streak': 'null'})
    check(not a.errors, f'page errors: {a.errors}')
    names = await a.js('features/tasks.js', 'm.all().map(t => t.name)')
    check(names[:3] == ['Open-eyes selfie', 'Brushing teeth', 'Tea is ready'], f'default tasks, got {names}')

@test('App', 'invalid', 'Storage failure shows a clear message')
async def t_storage_full(a):
    pg = await a.open()
    await pg.evaluate("() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; }")
    await a.tab('tasks')
    await pg.click('[data-switch=chaos]')
    await pg.wait_for_timeout(200)
    check('storage may be full' in await a.toast_text(), 'expected storage toast')

# ---------- Alarm
@test('Alarm', 'valid', 'Changing the wake-up time is saved across a reload')
async def t_time(a):
    pg = await a.open(clock=False)
    await pg.fill('[data-ref=time]', '05:15')
    await pg.dispatch_event('[data-ref=time]', 'change')
    await pg.reload(); await pg.wait_for_timeout(500)
    check(await a.js('features/alarm.js', 'm.status().time') == '05:15', 'time should persist')

@test('Alarm', 'invalid', 'Clearing the time field keeps the previous time')
async def t_time_empty(a):
    pg = await a.open()
    await pg.fill('[data-ref=time]', '')
    await pg.dispatch_event('[data-ref=time]', 'change')
    check(await a.js('features/alarm.js', 'm.status().time') == '06:30', 'time should stay 06:30')
    check(await a.js('features/alarm.js', "(m.setTime('25:99'), m.status().time)") == '06:30', 'malformed time rejected')

@test('Alarm', 'valid', 'Slide-to-arm works with the keyboard (Enter)')
async def t_arm_key(a):
    pg = await a.open()
    await a.arm_by_keyboard()
    check(await a.js('features/alarm.js', 'm.status().armed'), 'should be armed')

@test('Alarm', 'valid', 'Dragging the slider all the way arms the alarm')
async def t_arm_drag(a):
    pg = await a.open()
    box = await pg.locator('[data-ref=thumb]').bounding_box()
    await pg.mouse.move(box['x'] + 20, box['y'] + 20); await pg.mouse.down()
    await pg.mouse.move(box['x'] + 360, box['y'] + 20, steps=10); await pg.mouse.up()
    await pg.wait_for_timeout(500)
    check(await a.js('features/alarm.js', 'm.status().armed'), 'drag should arm')

@test('Alarm', 'invalid', 'A short drag does not arm (prevents accidental taps)')
async def t_arm_short(a):
    pg = await a.open()
    box = await pg.locator('[data-ref=thumb]').bounding_box()
    await pg.mouse.move(box['x'] + 20, box['y'] + 20); await pg.mouse.down()
    await pg.mouse.move(box['x'] + 90, box['y'] + 20, steps=5); await pg.mouse.up()
    await pg.wait_for_timeout(400)
    check(not await a.js('features/alarm.js', 'm.status().armed'), 'short drag must not arm')
    await pg.click('[data-ref=thumb]')
    check(not await a.js('features/alarm.js', 'm.status().armed'), 'a plain tap must not arm')

@test('Alarm', 'valid', 'Disarm turns the alarm off')
async def t_disarm(a):
    pg = await a.open()
    await a.arm_by_keyboard()
    await pg.click('#night [data-ref=back]')
    await pg.click('[data-ref=disarm]')
    check(not await a.js('features/alarm.js', 'm.status().armed'), 'should be disarmed')

@test('Alarm', 'valid', 'Rings at the set time, then re-arms for the next day')
async def t_rings_on_time(a):
    pg = await a.open()
    t = await pg.evaluate("() => { const d = new Date(Date.now() + 120000); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }")
    await a.js('features/alarm.js', f"(m.setTime('{t}'), m.arm(), true)")
    await a.tick(60_000)
    check(await a.phase() is None, 'should not ring early')
    await a.tick(70_000)
    check(await a.phase() == 'ringing', 'should ring at the set time')
    armed_at = await a.js('features/alarm.js', 'm.status().armedAt - Date.now()')
    check(armed_at > 23 * 3600 * 1000, 'next alarm should be about a day later')

@test('Alarm', 'invalid', 'An alarm missed while the app was closed does not ring hours late')
async def t_stale(a):
    pg = await a.open(seed={'fl:alarm': {'time': '06:30', 'armedAt': int(time.time() * 1000) - 3 * 3600 * 1000, 'testAt': None}})
    await a.tick(2000)
    check(await a.phase() is None, 'stale alarm must not ring')
    check(await a.js('features/alarm.js', 'm.status().armedAt > Date.now()'), 'should be rolled to the next occurrence')

@test('Alarm', 'valid', 'Test alarm rings after 10 seconds')
async def t_test_alarm(a):
    pg = await a.open()
    await pg.click('[data-ref=test]')
    await a.tick(8000)
    check(await a.phase() is None, 'not before 10 s')
    await a.tick(3000)
    check(await a.phase() == 'ringing', 'rings after 10 s')
    check(await a.visible('#morning [data-ref=input]'), 'ringing screen visible')

@test('Alarm', 'invalid', 'A second alarm during an active morning is ignored')
async def t_double_fire(a):
    pg = await a.open()
    await a.fire_direct()
    started = await a.js('features/morning.js', 'm.get().startedAt')
    await a.fire_direct()
    check(await a.js('features/morning.js', 'm.get().startedAt') == started, 'morning should not restart')

# ---------- Battery guard
@test('Battery', 'invalid', 'Low battery, not charging: arming asks first; "plug in first" cancels')
async def t_batt_cancel(a):
    pg = await a.open(battery=(0.22, False))
    await a.arm_by_keyboard()
    check('Battery at 22%' in await pg.inner_text('.sheet'), 'warning sheet expected')
    await pg.click('.sheet [data-i="0"]')
    check(not await a.js('features/alarm.js', 'm.status().armed'), 'should stay disarmed')

@test('Battery', 'valid', 'Low battery: "Arm anyway" arms')
async def t_batt_anyway(a):
    pg = await a.open(battery=(0.22, False))
    await a.arm_by_keyboard()
    await pg.click('.sheet [data-i="1"]'); await pg.wait_for_timeout(200)
    check(await a.js('features/alarm.js', 'm.status().armed'), 'should be armed')

@test('Battery', 'valid', 'Low battery but charging arms without a warning')
async def t_batt_charging(a):
    pg = await a.open(battery=(0.12, True))
    await a.arm_by_keyboard()
    check(not await pg.query_selector('.sheet'), 'no sheet while charging')
    check(await a.js('features/alarm.js', 'm.status().armed'), 'armed')

@test('Battery', 'valid', 'Guard switched off: no warning at low battery')
async def t_batt_off(a):
    pg = await a.open(battery=(0.12, False), seed={'fl:battery': {'enabled': False, 'armBelow': 40, 'floor': 15}})
    await a.arm_by_keyboard()
    check(not await pg.query_selector('.sheet'), 'no sheet when guard off')

@test('Battery', 'valid', 'Battery hits the floor unplugged while armed: alarm switches off and it is recorded')
async def t_batt_trip(a):
    pg = await a.open(battery=(0.60, False))
    await a.arm_by_keyboard()
    await pg.evaluate('() => window.__setBattery(0.15, false)'); await pg.wait_for_timeout(300)
    check(not await a.js('features/alarm.js', 'm.status().armed'), 'should disarm at floor')
    check('Alarm switched off' in await pg.inner_text('.sheet'), 'explanation sheet expected')
    check(await a.js('features/stats.js', 'm.get().totals.paused') == 1, 'paused night counted')

@test('Battery', 'valid', 'Battery at the floor while charging keeps the alarm armed')
async def t_batt_floor_charging(a):
    pg = await a.open(battery=(0.60, True))
    await a.arm_by_keyboard()
    await pg.evaluate('() => window.__setBattery(0.10, true)'); await pg.wait_for_timeout(300)
    check(await a.js('features/alarm.js', 'm.status().armed'), 'should stay armed')

@test('Battery', 'invalid', 'Browser without battery info (e.g. iPhone): arms and advises plugging in')
async def t_batt_unsupported(a):
    pg = await a.open(battery='none')
    await a.arm_by_keyboard()
    check(await a.js('features/alarm.js', 'm.status().armed'), 'armed')
    check('can’t read your battery' in await a.toast_text(), 'advice toast expected')

@test('Battery', 'invalid', 'Guard levels stay sensible: switch-off level can’t reach the warning level')
async def t_batt_limits(a):
    pg = await a.open()
    r = await a.js('features/battery-guard.js', "[m.setSetting('floor', 45), m.settings().armBelow, m.setSetting('armBelow', 5), m.setSetting('floor', 'abc'), m.setSetting('floor', -3)]")
    check(r[0] == 35 and r[1] == 40, f'floor capped below warning level: {r}')
    check(r[2] == 40, f'warning level can’t drop below floor+5: {r}')
    check(r[3] == 35 and r[4] == 5, f'bad input handled: {r}')

@test('Battery', 'valid', 'Low battery during an active morning never stops the morning')
async def t_batt_morning(a):
    pg = await a.open(battery=(0.60, False))
    await a.js('features/alarm.js', '(m.arm(), true)')
    await a.fire_direct()
    await pg.evaluate('() => window.__setBattery(0.05, false)'); await pg.wait_for_timeout(300)
    check(await a.phase() == 'ringing', 'morning must continue')

# ---------- Night screen
@test('Night', 'valid', 'Arming opens the black night screen; "Back to the app" keeps it armed')
async def t_night(a):
    pg = await a.open()
    await a.arm_by_keyboard()
    check(await a.visible('#night'), 'night screen shown')
    bg = await pg.evaluate("() => getComputedStyle(document.getElementById('night')).backgroundColor")
    check(bg == 'rgb(0, 0, 0)', f'night must be pure black, got {bg}')
    await pg.click('#night [data-ref=back]')
    check(not await a.visible('#night'), 'hidden after back')
    check(await a.js('features/alarm.js', 'm.status().armed'), 'still armed')
    await pg.click('[data-ref=night]')
    check(await a.visible('#night'), 'reopens from the Night screen button')

@test('Night', 'valid', 'Night screen gives way to the alarm, and closes on disarm')
async def t_night_ring(a):
    pg = await a.open()
    await a.arm_by_keyboard()
    await a.fire_direct()
    check(not await a.visible('#night'), 'hidden while ringing')
    await a.type_phrase(); await a.js('features/morning.js', '(m.close(), true)'); await pg.wait_for_timeout(200)
    check(await a.visible('#night'), 'night screen returns after the morning while still armed')
    await a.js('features/alarm.js', '(m.disarm(), true)'); await pg.wait_for_timeout(200)
    check(not await a.visible('#night'), 'hidden after disarm')

# ---------- Ringing
@test('Ringing', 'invalid', 'A wrong phrase is rejected and the alarm keeps ringing')
async def t_wrong(a):
    pg = await a.open(); await a.fire_direct()
    await a.type_phrase('I am definitely awake')
    check(await a.phase() == 'ringing', 'still ringing')
    check('Not quite' in await pg.get_attribute('#morning [data-ref=input]', 'placeholder'), 'feedback shown')

@test('Ringing', 'invalid', 'An empty phrase is rejected')
async def t_empty(a):
    pg = await a.open(); await a.fire_direct()
    await a.type_phrase('   ')
    check(await a.phase() == 'ringing', 'still ringing')

@test('Ringing', 'valid', 'The phrase ignores capitals, extra spaces and punctuation')
async def t_loose(a):
    pg = await a.open(); await a.fire_direct()
    p = await a.phrase()
    await a.type_phrase('  ' + p.upper().replace(' ', '   ') + '!!  ')
    check(await a.phase() == 'tasks', 'should stop the alarm')

@test('Ringing', 'invalid', 'Pasting and dropping text into the phrase box is blocked')
async def t_paste(a):
    pg = await a.open(); await a.fire_direct()
    prevented = await pg.evaluate("""() => {
      const i = document.querySelector('#morning [data-ref=input]');
      const dt = new DataTransfer(); dt.setData('text/plain', 'x');
      const p = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      const d = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
      return [!i.dispatchEvent(p), !i.dispatchEvent(d)];
    }""")
    check(all(prevented), f'paste/drop should be blocked: {prevented}')

@test('Ringing', 'valid', 'Letters light up as you type, wrong letters are marked')
async def t_letters(a):
    pg = await a.open(); await a.fire_direct()
    p = await a.phrase()
    await pg.type('#morning [data-ref=input]', p[:3] + 'Q')
    ok = await pg.eval_on_selector_all('#morning .phrase .ch.ok', 'e => e.length')
    bad = await pg.eval_on_selector_all('#morning .phrase .ch.bad', 'e => e.length')
    check(ok == 3 and bad == 1, f'expected 3 ok and 1 bad, got {ok}/{bad}')

# ---------- Snooze
@test('Snooze', 'valid', 'Snooze silences, logs to the Hall of Shame, and rings again after 5 minutes')
async def t_snooze(a):
    pg = await a.open(); await a.fire_direct(test=False)
    await pg.click('#morning [data-ref=snooze]'); await pg.wait_for_timeout(200)
    check(await a.phase() == 'snoozed', 'snoozed')
    check(len(await a.js('features/snooze.js', 'm.hallOfShame()')) == 1, 'shame logged')
    await a.tick(4 * 60_000)
    check(await a.phase() == 'snoozed', 'still snoozed at 4 min')
    await a.tick(61_000)
    check(await a.phase() == 'ringing', 'rings again after 5 min')

@test('Snooze', 'valid', '"I’m up" ends the snooze early so you can stop the alarm')
async def t_snooze_up(a):
    pg = await a.open(); await a.fire_direct()
    await pg.click('#morning [data-ref=snooze]'); await pg.wait_for_timeout(200)
    await pg.click('#morning [data-ref=up]'); await pg.wait_for_timeout(200)
    check(await a.phase() == 'ringing', 'rings immediately')

@test('Snooze', 'invalid', 'After the snooze limit (2), the snooze option disappears')
async def t_snooze_limit(a):
    pg = await a.open(); await a.fire_direct()
    for _ in range(2):
        await pg.click('#morning [data-ref=snooze]'); await pg.wait_for_timeout(150)
        await pg.click('#morning [data-ref=up]'); await pg.wait_for_timeout(150)
    check(not await pg.query_selector('#morning [data-ref=snooze]'), 'no snooze after limit')
    check(await a.js('features/morning.js', 'm.snooze()') is None, 'snooze refused by the rules too')

@test('Snooze', 'valid', 'Snooze switched off: no snooze button')
async def t_snooze_off(a):
    pg = await a.open(seed={'fl:snooze': {'enabled': False, 'minutes': 5, 'max': 2}}); await a.fire_direct()
    check(not await pg.query_selector('#morning [data-ref=snooze]'), 'no snooze button')

@test('Snooze', 'invalid', 'No snooze on the punishment ring after a missed check-in')
async def t_snooze_escalated(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(); await a.type_phrase()
    await a.tick(5 * 60_000 + 1000); await a.tick(61_000)
    check(await a.js('features/morning.js', 'm.get().escalated'), 'escalated ring')
    check(not await pg.query_selector('#morning [data-ref=snooze]'), 'no snooze on escalated ring')

@test('Snooze', 'invalid', 'Snooze settings reject out-of-range and junk values')
async def t_snooze_limits(a):
    await a.open()
    r = await a.js('features/snooze.js', "[m.setSetting('minutes', 0), m.setSetting('minutes', 99), m.setSetting('max', -1), m.setSetting('max', 'lots')]")
    check(r == [1, 30, 0, 0], f'clamped values, got {r}')

@test('Snooze', 'valid', 'Test-run snoozes stay out of your Hall of Shame and totals')
async def t_snooze_test(a):
    pg = await a.open(seed={'fl:tasks': []}); await a.fire_direct(test=True)
    await pg.click('#morning [data-ref=snooze]'); await pg.wait_for_timeout(150)
    await pg.click('#morning [data-ref=up]'); await pg.wait_for_timeout(150)
    await a.type_phrase(); await pg.click('#morning [data-ref=close]')
    await a.tab('progress')
    check('Spotless' in await pg.inner_text('[data-tab=progress]'), 'test snooze hidden')
    check(await a.js('features/stats.js', 'm.get().totals.snoozes') == 0, 'not counted')

# ---------- Check-in
@test('Check-in', 'valid', 'Check-in appears after 5 minutes; answering it stops the timer')
async def t_checkin_pass(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(); await a.type_phrase()
    await a.tick(4 * 60_000)
    check(not await a.visible('#checkin'), 'not yet')
    await a.tick(61_000)
    check(await a.visible('#checkin'), 'check-in shown')
    await pg.click('#checkin [data-ref=yes]'); await pg.wait_for_timeout(200)
    check(not await a.visible('#checkin'), 'closed')
    await a.tick(120_000)
    check(await a.phase() == 'tasks', 'no re-ring after passing')

@test('Check-in', 'invalid', 'Missing the check-in rings again with a harsher phrase and keeps task progress')
async def t_checkin_miss(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK + [{'id': 'two', 'name': 'Stretch', 'proof': 'you stretching', 'gapMin': 0}]})
    await a.fire_direct(); await a.type_phrase()
    await a.prove_current_task()
    await a.tick(5 * 60_000 + 1000); await a.tick(61_000)
    check(await a.phase() == 'ringing', 're-ring')
    check((await a.phrase()) in ['I ignored my own check in and now I type this', 'I promise to stop negotiating with my pillow'], 'retry phrase')
    await a.type_phrase()
    check(await a.js('features/morning.js', 'm.get().completed.length') == 1, 'progress kept')

@test('Check-in', 'invalid', 'Check-in steppers stop at their limits')
async def t_checkin_limits(a):
    pg = await a.open()
    await a.tab('settings')
    for _ in range(6):
        await pg.click('[data-stepper=delayMin] [data-d="-1"]', force=True)
    check(await a.js('features/checkin.js', 'm.settings().delayMin') == 1, 'min 1 minute')
    check(await pg.is_disabled('[data-stepper=delayMin] [data-d="-1"]'), 'minus disabled at the limit')
    r = await a.js('features/checkin.js', "[m.setSetting('windowSec', 5), m.setSetting('windowSec', 9999), m.setSetting('delayMin', 'x')]")
    check(r == [15, 300, 1], f'clamped: {r}')

@test('Check-in', 'valid', 'No check-in after the morning is finished')
async def t_checkin_after_done(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(); await a.type_phrase(); await a.prove_current_task()
    check(await a.phase() == 'done', 'done')
    await a.tick(6 * 60_000)
    check(not await a.visible('#checkin'), 'no check-in after done')

# ---------- Tasks
@test('Tasks', 'valid', 'Quick-add a template task and it is saved')
async def t_task_add(a):
    pg = await a.open(clock=False)
    await a.tab('tasks')
    await pg.click('[data-tpl="0"]')
    await pg.reload(); await pg.wait_for_timeout(500)
    check('Make the bed' in await a.js('features/tasks.js', 'm.all().map(t => t.name)'), 'saved')

@test('Tasks', 'invalid', 'An empty task name is refused and the old name kept')
async def t_task_empty(a):
    pg = await a.open()
    await a.tab('tasks')
    await pg.click('.task-card .title')
    await pg.fill('[data-f=name]', '   ')
    await pg.dispatch_event('[data-f=name]', 'change')
    check(await a.visible('[data-err=name]'), 'error shown')
    check((await a.js('features/tasks.js', 'm.all()[0].name')) == 'Open-eyes selfie', 'name kept')

@test('Tasks', 'invalid', 'Wait time stays between 0 and 120 minutes, junk ignored')
async def t_task_gap(a):
    await a.open()
    r = await a.js('features/tasks.js', "[m.update('t1', {gapMin: -5}).gapMin, m.update('t1', {gapMin: 500}).gapMin, m.update('t1', {gapMin: 'abc'}).gapMin, m.update('t1', {gapMin: 7.6}).gapMin]")
    check(r == [0, 120, 120, 8], f'gap values {r}')

@test('Tasks', 'valid', 'Reorder and delete tasks')
async def t_task_reorder(a):
    pg = await a.open()
    await a.tab('tasks')
    await pg.click('.task-card:nth-child(2) .title')
    await pg.click('[data-act=up]')
    check((await a.js('features/tasks.js', 'm.all().map(t=>t.id)'))[:2] == ['t2', 't1'], 'moved up')
    await pg.click('[data-act=del]')
    check(len(await a.js('features/tasks.js', 'm.all()')) == 2, 'deleted')

@test('Tasks', 'invalid', 'No more than 12 tasks')
async def t_task_max(a):
    pg = await a.open()
    await a.js('features/tasks.js', 'Array.from({length: 20}, () => m.add()).filter(Boolean).length')
    check(len(await a.js('features/tasks.js', 'm.all()')) == 12, 'capped at 12')
    await a.tab('tasks')
    check(await pg.is_disabled('[data-tpl="0"]'), 'quick-add disabled when full')

@test('Tasks', 'valid', 'A task with a wait stays locked until the wait is over')
async def t_task_lock(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK + [{'id': 'tea', 'name': 'Tea', 'proof': 'tea', 'gapMin': 10}], 'fl:checkin': {'delayMin': 60, 'windowSec': 60}})
    await a.fire_direct(); await a.type_phrase(); await a.prove_current_task()
    check('Unlocks in' in await pg.inner_text('#morning [data-gate]'), 'locked')
    check(not await a.js('features/morning.js', "m.completeTask('tea')"), 'cannot complete early')
    await a.tick(10 * 60_000 + 1000)
    check(await pg.query_selector('#morning [data-gate] button.gold'), 'unlocked after 10 min')

@test('Tasks', 'valid', 'With no tasks, typing the phrase finishes the morning')
async def t_no_tasks(a):
    await a.open(seed={'fl:tasks': []})
    await a.fire_direct(); await a.type_phrase()
    check(await a.phase() == 'done', 'done immediately')

@test('Tasks', 'valid', 'Chaos task adds one random task at the end')
async def t_chaos(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK, 'fl:tasks-options': {'chaos': True}})
    await a.fire_direct()
    ts = await a.js('features/morning.js', 'm.get().tasks')
    check(len(ts) == 2 and ts[1].get('chaos'), 'chaos task appended')
    await a.type_phrase(); await a.prove_current_task()
    check('chaos' in await pg.inner_text('#morning .chain'), 'chaos tag shown')

@test('Tasks', 'invalid', 'Editing tasks mid-morning doesn’t change this morning’s list')
async def t_task_snapshot(a):
    await a.open()
    await a.fire_direct()
    await a.js('features/tasks.js', "(m.remove('t1'), m.remove('t2'), true)")
    check(len(await a.js('features/morning.js', 'm.get().tasks')) == 3, 'today unchanged')

# ---------- Camera
@test('Camera', 'invalid', 'Camera blocked: clear message, task not completed')
async def t_cam_denied(a):
    pg = await a.open(deny_camera=True, seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(); await a.type_phrase()
    await pg.click('#morning [data-gate] button.gold'); await pg.wait_for_timeout(400)
    check('Camera blocked' in await pg.inner_text('#camera'), 'message shown')
    await pg.click('#camera [data-act=cancel]')
    check(await a.js('features/morning.js', 'm.get().completed.length') == 0, 'not completed')

@test('Camera', 'valid', 'Capture, retake, then Next completes the task')
async def t_cam_retake(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(); await a.type_phrase()
    await a.prove_current_task(retake=True)
    check(await a.phase() == 'done', 'completed')

@test('Camera', 'invalid', 'Cancelling the camera leaves the task open')
async def t_cam_cancel(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(); await a.type_phrase()
    await pg.click('#morning [data-gate] button.gold'); await pg.wait_for_timeout(800)
    await pg.click('#camera [data-act=cancel]')
    check(await a.phase() == 'tasks' and not await a.visible('#camera'), 'still on tasks')

# ---------- Report & progress
@test('Progress', 'valid', 'Finishing shows the report card; a test run doesn’t touch the streak')
async def t_report(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(test=True); await a.type_phrase(); await a.prove_current_task()
    txt = await pg.inner_text('#morning')
    check('Morning proven' in txt and 'A+' in txt, 'report card A+')
    check(await a.js('features/stats.js', 'm.get().wins') == 0, 'test not counted')

@test('Progress', 'valid', 'A real morning adds to the streak, history and calendar')
async def t_real_morning(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.fire_direct(test=False); await a.type_phrase(); await a.prove_current_task()
    s = await a.js('features/stats.js', 'm.get()')
    check(s['streak'] == 1 and s['wins'] == 1 and s['history'][0]['grade'] == 'A+', f'stats {s}')
    await pg.click('#morning [data-ref=close]'); await a.tab('progress')
    check(await pg.query_selector('.cal .day.proven.today'), 'today marked on the calendar')

@test('Progress', 'valid', 'Grades follow snoozes, missed check-ins and time taken')
async def t_grades(a):
    await a.open()
    r = await a.js('features/report.js', """[
      m.grade({startedAt: 0, doneAt: 10*60000, snoozes: 0, misses: 0}).letter,
      m.grade({startedAt: 0, doneAt: 10*60000, snoozes: 1, misses: 0}).letter,
      m.grade({startedAt: 0, doneAt: 50*60000, snoozes: 2, misses: 1}).letter,
      m.grade({startedAt: 0, doneAt: 90*60000, snoozes: 5, misses: 3}).letter,
      m.grade({startedAt: 0}) ]""")
    check(r == ['A+', 'A', 'D', 'F', None], f'grades {r}')

@test('Progress', 'valid', 'Streak continues from yesterday and resets after a missed day')
async def t_streak_days(a):
    pg = await a.open()
    r = await pg.evaluate("""async () => {
      const k = (d) => d.toISOString ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : d;
      const y = new Date(); y.setDate(y.getDate()-1); const old = new Date(); old.setDate(old.getDate()-3);
      return [k(y), k(old)];
    }""")
    await a.close()
    a2 = App(a.browser); a.ctx = None
    await a2.open(seed={'fl:tasks': [], 'fl:streak': {'streak': 4, 'best': 4, 'wins': 4, 'lastWin': r[0], 'history': []}})
    check(await a2.js('features/stats.js', 'm.currentStreak()') == 4, 'yesterday keeps the streak alive')
    await a2.fire_direct(test=False); await a2.type_phrase()
    check(await a2.js('features/stats.js', 'm.get().streak') == 5, 'continues to 5')
    await a2.close()
    a3 = App(a.browser)
    await a3.open(seed={'fl:tasks': [], 'fl:streak': {'streak': 9, 'best': 9, 'wins': 9, 'lastWin': r[1], 'history': []}})
    check(await a3.js('features/stats.js', 'm.currentStreak()') == 0, 'gap breaks the streak')
    await a3.fire_direct(test=False); await a3.type_phrase()
    s = await a3.js('features/stats.js', 'm.get()')
    check(s['streak'] == 1 and s['best'] == 9, f'restarts at 1, best kept: {s}')
    await a3.close()

@test('Progress', 'invalid', 'An unfinished morning from yesterday is closed, not resumed')
async def t_stale_morning(a):
    y = time.strftime('%Y-%m-%d', time.localtime(time.time() - 86400))
    await a.open(seed={'fl:morning': {'date': y, 'test': False, 'startedAt': 0, 'phase': 'tasks', 'tasks': ONE_TASK, 'completed': [], 'phrase': 'x'}})
    check(await a.phase() == 'closed', 'closed')
    check(not await a.visible('#morning'), 'morning screen hidden')

@test('Progress', 'valid', 'Reloading while the alarm rings keeps it ringing')
async def t_reload_ring(a):
    pg = await a.open(clock=False)
    await a.fire_direct()
    await pg.reload(); await pg.wait_for_timeout(600)
    check(await a.phase() == 'ringing' and await a.visible('#morning [data-ref=input]'), 'still ringing after reload')

# ---------- Sounds
@test('Sounds', 'invalid', 'Adding songs: audio files accepted, other files refused with a reason')
async def t_songs(a):
    pg = await a.open()
    await a.tab('sounds')
    await pg.set_input_files('[data-ref=songInput]', [str(FIX / 'song-a.wav'), str(FIX / 'notes.txt'), str(FIX / 'image.png')])
    await pg.wait_for_timeout(500)
    check(len(await a.js('features/songs.js', 'await m.list()')) == 1, 'only the audio file added')
    check('isn’t an audio file' in await a.toast_text(), 'reason given')

@test('Sounds', 'valid', 'Song rotation: no repeats until every song has played')
async def t_rotation(a):
    pg = await a.open()
    await a.tab('sounds')
    await pg.set_input_files('[data-ref=songInput]', [str(FIX / f'song-{x}.wav') for x in 'abc'])
    await pg.wait_for_timeout(500)
    ids = await a.js('features/songs.js', '[await m.next(), await m.next(), await m.next(), await m.next()]')
    check(len(set(ids[:3])) == 3, f'first three all different: {ids}')
    check(ids[3] != ids[2], 'no back-to-back repeat across cycles')

@test('Sounds', 'valid', 'Your songs play when the alarm rings; the rest plays when you finish')
async def t_local_play(a):
    pg = await a.open(seed={'fl:tasks': []})
    await a.tab('sounds'); await pg.set_input_files('[data-ref=songInput]', [str(FIX / 'song-a.wav')]); await pg.wait_for_timeout(400)
    await a.fire_direct(); await pg.wait_for_timeout(400)
    check(await a.js('features/music.js', 'm.status().playing') == 'local', 'local song playing')
    await a.type_phrase(); await pg.wait_for_timeout(600)
    check(await a.js('features/music.js', 'm.status().playing') == 'finale', 'finale plays after proving')

@test('Sounds', 'valid', 'No songs added: the alarm beeps')
async def t_beeps(a):
    await a.open(); await a.fire_direct()
    check(await a.js('features/music.js', 'm.status().playing') == 'beeps', 'beeps')

@test('Sounds', 'invalid', 'Punishment song: non-audio refused; audio plays after a missed check-in')
async def t_punish(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.tab('sounds')
    await pg.set_input_files('[data-ref=punishInput]', str(FIX / 'notes.txt')); await pg.wait_for_timeout(300)
    check('isn’t audio' in await a.toast_text(), 'refused')
    await pg.set_input_files('[data-ref=punishInput]', str(FIX / 'punish.wav')); await pg.wait_for_timeout(400)
    await a.fire_direct(); await a.type_phrase()
    await a.tick(5 * 60_000 + 1000); await a.tick(61_000); await pg.wait_for_timeout(400)
    check(await a.js('features/music.js', 'm.status().playing') == 'punishment', 'punishment song playing')

# ---------- Boost
@test('Boost', 'invalid', 'Voice note: empty recording refused; saved note plays after the check-in')
async def t_voice(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    r = await a.js('features/boost.js', "(await m.saveVoice(new Blob([]))).ok")
    check(r is False, 'empty refused')
    await pg.evaluate("""async () => { const m = await import('./js/features/boost.js');
      const wav = await (await fetch('/tests/fixtures/song-a.wav')).blob(); return (await m.saveVoice(wav)).ok; }""")
    await a.fire_direct(); await a.type_phrase()
    await a.tick(5 * 60_000 + 1000)
    await pg.click('#checkin [data-ref=yes]'); await pg.wait_for_timeout(500)
    check(await a.visible('#boost') and 'past you' in await pg.inner_text('#boost'), 'boost shows the voice note')

@test('Boost', 'invalid', 'Clips: non-video refused; no boost screen when nothing is saved')
async def t_clips(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    await a.tab('sounds')
    await pg.set_input_files('[data-ref=clipInput]', [str(FIX / 'image.png'), str(FIX / 'clip.webm')]); await pg.wait_for_timeout(400)
    check(len(await a.js('features/boost.js', 'await m.clips()')) == 1, 'only the video added')
    await a.js('features/boost.js', '(await Promise.all((await m.clips()).map(c => m.removeClip(c.id))), true)')
    await a.fire_direct(); await a.type_phrase(); await a.tick(5 * 60_000 + 1000)
    await pg.click('#checkin [data-ref=yes]'); await pg.wait_for_timeout(400)
    check(not await a.visible('#boost'), 'no boost with nothing saved')

# ---------- Spotify (stand-in)
CONNECTED = {'fl:music': {'source': 'spotify'}, 'fl:spotify': {'clientId': 'a' * 32, 'token': {'access': 'ACCESS-ok', 'refresh': 'REFRESH', 'expiresAt': 4102444800000}, 'playlist': {'id': 'pl1', 'name': 'Rise and shine', 'uri': 'spotify:playlist:pl1', 'total': 7}, 'user': {'name': 'Test User'}, 'lastError': None}, 'fl:tasks': []}

@test('Spotify', 'invalid', 'Client ID: wrong format refused with an explanation, correct one saved')
async def t_sp_client(a):
    pg = await a.open(spotify={})
    await a.tab('sounds'); await pg.click('[data-seg=source] [data-value=spotify]')
    await pg.fill('[data-ref=cid]', 'not-a-client-id'); await pg.click('[data-ref=save]')
    check('32 letters' in await pg.inner_text('[data-ref=err]'), 'error explained')
    await pg.fill('[data-ref=cid]', '0123456789abcdef0123456789ABCDEF'); await pg.click('[data-ref=save]'); await pg.wait_for_timeout(200)
    check('Connect Spotify' in await pg.inner_text('[data-tab=sounds]'), 'moves to the connect step')

@test('Spotify', 'valid', 'Connect: secure sign-in (PKCE), token saved, playlists listed and chosen')
async def t_sp_connect(a):
    pg = await a.open(clock=False, spotify={}, seed={'fl:spotify': {'clientId': 'b' * 32}})
    await a.tab('sounds'); await pg.click('[data-seg=source] [data-value=spotify]')
    await pg.click('[data-ref=connect]'); await pg.wait_for_timeout(1500)
    check(('AUTHORIZE', 'S256') in a.calls, 'PKCE S256 used')
    check(('TOKEN', 'authorization_code') in a.calls, 'code exchanged')
    check('Test User' in await pg.inner_text('[data-tab=sounds]'), 'signed in')
    check('?code=' not in pg.url, 'code removed from the address bar')
    await pg.click('[data-ref=load]'); await pg.wait_for_timeout(600)
    await pg.click('[data-pick=pl2]'); await pg.wait_for_timeout(200)
    check((await a.js('features/sources/spotify.js', 'm.status().playlist.name')) == 'Loud mornings', 'playlist chosen')

@test('Spotify', 'invalid', 'Tampered sign-in (state mismatch) is rejected')
async def t_sp_state(a):
    pg = await a.open(clock=False, spotify={'state': 'wrong'}, seed={'fl:spotify': {'clientId': 'c' * 32}})
    await a.tab('sounds'); await pg.click('[data-seg=source] [data-value=spotify]')
    await pg.click('[data-ref=connect]'); await pg.wait_for_timeout(1500)
    check('could not be verified' in await a.toast_text(), 'rejection message')
    check(not await a.js('features/sources/spotify.js', 'm.status().connected'), 'not connected')

@test('Spotify', 'invalid', 'Cancelled sign-in shows a message')
async def t_sp_deny(a):
    pg = await a.open(clock=False, spotify={'deny': True}, seed={'fl:spotify': {'clientId': 'd' * 32}})
    await a.tab('sounds'); await pg.click('[data-seg=source] [data-value=spotify]')
    await pg.click('[data-ref=connect]'); await pg.wait_for_timeout(1500)
    check('cancelled' in await a.toast_text(), 'cancel message')

@test('Spotify', 'valid', 'Alarm plays the playlist in the in-app Spotify player, starting at today’s song')
async def t_sp_play(a):
    pg = await a.open(clock=False, spotify={}, seed=CONNECTED)
    await a.fire_direct(); await pg.wait_for_timeout(2500)
    check(await a.js('features/music.js', 'm.status().playing') == 'spotify', 'spotify playing')
    plays = [c for c in a.calls if c[0] == 'PUT' and c[1].startswith('/me/player/play')]
    check(plays and 'device_id=sdk-device' in plays[0][1], f'played on the in-app player: {plays}')
    body = json.loads(plays[0][2])
    check(body['context_uri'] == 'spotify:playlist:pl1' and 0 <= body['offset']['position'] < 7, f'body {body}')
    await a.type_phrase(); await pg.wait_for_timeout(300)
    check(any(c[1].startswith('/me/player/pause') for c in a.calls), 'paused when stopped')

@test('Spotify', 'invalid', 'No Premium: falls back to your songs/beeps and explains why')
async def t_sp_premium(a):
    pg = await a.open(clock=False, spotify={'play': 'premium'}, seed=CONNECTED)
    await a.fire_direct(); await pg.wait_for_timeout(1500)
    check(await a.js('features/music.js', 'm.status().playing') == 'beeps', 'fallback to beeps (no songs added)')
    check('Premium' in (await a.js('features/music.js', 'm.status().lastFallback.reason')), 'reason recorded')
    await a.type_phrase(); await pg.click('#morning [data-ref=close]')
    await a.tab('sounds')
    check('didn’t start' in await pg.inner_text('[data-tab=sounds]'), 'notice in Sounds')

@test('Spotify', 'invalid', 'Expired sign-in that can’t refresh: disconnects and falls back')
async def t_sp_refresh_fail(a):
    seed = json.loads(json.dumps(CONNECTED)); seed['fl:spotify']['token']['expiresAt'] = 1
    pg = await a.open(clock=False, spotify={'refresh': 'fail'}, seed=seed)
    await a.fire_direct(); await pg.wait_for_timeout(1500)
    check(('TOKEN', 'refresh_token') in a.calls, 'refresh attempted')
    check(await a.js('features/music.js', 'm.status().playing') == 'beeps', 'fallback')
    check(not await a.js('features/sources/spotify.js', 'm.status().connected'), 'disconnected')

@test('Spotify', 'valid', 'Expired access token is refreshed automatically')
async def t_sp_refresh_ok(a):
    seed = json.loads(json.dumps(CONNECTED)); seed['fl:spotify']['token']['expiresAt'] = 1
    pg = await a.open(clock=False, spotify={}, seed=seed)
    await a.fire_direct(); await pg.wait_for_timeout(2500)
    check(('TOKEN', 'refresh_token') in a.calls, 'refreshed')
    check(await a.js('features/music.js', 'm.status().playing') == 'spotify', 'playing after refresh')

@test('Spotify', 'valid', 'Disconnect clears the account')
async def t_sp_disconnect(a):
    pg = await a.open(clock=False, spotify={}, seed=CONNECTED)
    await a.tab('sounds')
    await pg.click('[data-ref=out]'); await pg.wait_for_timeout(200)
    check(not await a.js('features/sources/spotify.js', 'm.status().connected'), 'disconnected')

# ---------- YouTube (stand-in)
@test('YouTube', 'invalid', 'Link check: rejects non-links, other sites, private lists and junk')
async def t_yt_parse(a):
    await a.open()
    r = await a.js('features/sources/youtube.js', """[
      m.parse('hello').ok, m.parse('https://vimeo.com/123').ok,
      m.parse('https://music.youtube.com/playlist?list=LM').ok, m.parse('https://www.youtube.com/watch').ok,
      m.parse('https://www.youtube.com/playlist?list=<script>').ok ]""")
    check(r == [False] * 5, f'all invalid: {r}')

@test('YouTube', 'valid', 'Link check: accepts YouTube Music playlists, watch links and youtu.be')
async def t_yt_parse_ok(a):
    await a.open()
    r = await a.js('features/sources/youtube.js', """[
      m.parse('https://music.youtube.com/playlist?list=PLabc123_-XYZ').listId,
      m.parse('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLzz').listId,
      m.parse('https://youtu.be/dQw4w9WgXcQ').videoId,
      m.parse('https://m.youtube.com/watch?v=dQw4w9WgXcQ').videoId ]""")
    check(r == ['PLabc123_-XYZ', 'PLzz', 'dQw4w9WgXcQ', 'dQw4w9WgXcQ'], f'parsed {r}')

@test('YouTube', 'valid', 'Alarm shows the YouTube player on screen and plays; stopping removes it')
async def t_yt_play(a):
    pg = await a.open(clock=False, youtube='ok', seed={'fl:music': {'source': 'youtube'}, 'fl:youtube': {'url': 'x', 'listId': 'PLtest', 'videoId': None}, 'fl:tasks': []})
    await a.fire_direct(); await pg.wait_for_timeout(800)
    check(await a.js('features/music.js', 'm.status().playing') == 'youtube', 'youtube playing')
    check(await a.visible('#media-stage iframe'), 'player visible, as YouTube requires')
    idx = await pg.evaluate('() => window.__yt.index')
    check(idx in (0, 1, 2), 'started at today’s song')
    await a.type_phrase(); await pg.wait_for_timeout(300)
    check(not await a.visible('#media-stage'), 'player removed after stopping')

@test('YouTube', 'invalid', 'Embedding not allowed: falls back to your songs/beeps')
async def t_yt_error(a):
    pg = await a.open(clock=False, youtube='error', seed={'fl:music': {'source': 'youtube'}, 'fl:youtube': {'url': 'x', 'listId': 'PLtest', 'videoId': None}})
    await a.fire_direct(); await pg.wait_for_timeout(800)
    check(await a.js('features/music.js', 'm.status().playing') == 'beeps', 'fallback')
    check('embedding' in await a.js('features/music.js', 'm.status().lastFallback.reason'), 'reason recorded')

@test('YouTube', 'invalid', 'Player never starts (blocked autoplay): falls back within 8 seconds')
async def t_yt_blocked(a):
    pg = await a.open(clock=False, youtube='blocked', seed={'fl:music': {'source': 'youtube'}, 'fl:youtube': {'url': 'x', 'listId': 'PLtest', 'videoId': None}})
    await a.fire_direct(); await pg.wait_for_timeout(9000)
    check(await a.js('features/music.js', 'm.status().playing') == 'beeps', 'fallback after timeout')
    check(not await a.visible('#media-stage'), 'stalled player removed')

# ---------- Settings & data
@test('Data', 'valid', 'Erase all data asks first, then resets everything')
async def t_erase(a):
    pg = await a.open(clock=False)
    await a.js('features/tasks.js', '(m.remove("t1"), true)')
    await a.tab('settings'); await pg.click('[data-ref=reset]')
    await pg.click('.sheet [data-i="0"]'); await pg.wait_for_timeout(1200)
    check(len(await a.js('features/tasks.js', 'm.all()')) == 3, 'defaults restored')

@test('Data', 'invalid', 'Choosing "Keep my data" erases nothing')
async def t_erase_cancel(a):
    pg = await a.open()
    await a.js('features/tasks.js', '(m.remove("t1"), true)')
    await a.tab('settings'); await pg.click('[data-ref=reset]')
    await pg.click('.sheet [data-i="1"]'); await pg.wait_for_timeout(300)
    check(len(await a.js('features/tasks.js', 'm.all()')) == 2, 'data kept')

@test('Data', 'valid', 'Data from the original Proof of Wake build is carried over')
async def t_migrate(a):
    old = {'alarmTime': '05:45', 'armed': None, 'tasks': [{'id': 'x1', 'name': 'Old task', 'proof': 'a sock', 'gapMin': 2}], 'checkinMin': 7, 'checkinWin': 90, 'songQueue': [], 'lastSong': None, 'stats': {'streak': 4, 'best': 9, 'wins': 12, 'lastWin': None, 'history': []}}
    await a.open(seed={'pow:cfg': old})
    r = await a.js('features/tasks.js', 'm.all().map(t => t.name)')
    check(r == ['Old task'], f'tasks {r}')
    check(await a.js('features/alarm.js', 'm.status().time') == '05:45', 'time carried over')
    check(await a.js('features/stats.js', 'm.get().best') == 9, 'best streak carried over')

@test('Data', 'valid', 'Offline: after one visit, the app opens with no connection')
async def t_offline(a):
    pg = await a.open(clock=False, sw='allow')
    await pg.wait_for_timeout(1500)
    await pg.reload(); await pg.wait_for_timeout(1500)
    await a.ctx.set_offline(True)
    await pg.reload(); await pg.wait_for_timeout(1000)
    check(await pg.title() == 'First Light' and await a.visible('[data-ref=clock]'), 'loads offline')

@test('Data', 'valid', 'Every app file is in the offline cache list')
async def t_cache_list(a):
    sw = (WEB / 'sw.js').read_text()
    files = [str(p.relative_to(WEB)) for d in ('js', 'fonts', 'css', 'sounds') for p in (WEB / d).rglob('*') if p.suffix in ('.js', '.woff2', '.css', '.mp3')]
    missing = [f for f in files if f"'./{f}'" not in sw]
    check(not missing, f'not cached: {missing}')


# ================================================================== phase 3
from datetime import datetime, timezone, timedelta
IST = timezone(timedelta(hours=5, minutes=30))
def ist(y, mo, d, h, mi=0, s=0):
    return datetime(y, mo, d, h, mi, s, tzinfo=IST)
def ms(dt):
    return int(dt.timestamp() * 1000)
NO_PROMPTS = {'fl:sleep': {'prompts': False}}

# ---------- Onboarding
@test('Onboarding', 'valid', 'First run: setup walks through name, logo, colour, theme, font, style, sleep; choices are saved')
async def t_onboard(a):
    pg = await a.open(onboarded=False, clock=False)
    check(await a.visible('#onboarding'), 'setup shown on first run')
    await pg.fill('#onboarding [data-ref=name]', 'Priya'); await pg.click('[data-ob=next]')
    for kind, value in [('logo', 'owl'), ('accent', 'rose'), ('theme', 'midnight'), ('font', 'modern'), ('style', 'soft')]:
        await pg.click(f'[data-pick={kind}][data-value={value}]'); await pg.wait_for_timeout(120)
        check(await pg.evaluate(f"document.documentElement.dataset.{kind if kind != 'logo' else 'theme'} !== undefined"), 'applied live')
        await pg.click('[data-ob=next]'); await pg.wait_for_timeout(150)
    await pg.fill('#onboarding [data-ref=bed]', '23:30'); await pg.dispatch_event('#onboarding [data-ref=bed]', 'change')
    await pg.fill('#onboarding [data-ref=wake]', '05:45'); await pg.dispatch_event('#onboarding [data-ref=wake]', 'change')
    await pg.click('[data-ob=next]'); await pg.wait_for_timeout(200)
    check('All set, Priya' in await pg.inner_text('#onboarding'), 'done step greets by name')
    await pg.click('[data-ob=next]'); await pg.wait_for_timeout(500)
    check(not await a.visible('#onboarding'), 'setup closes')
    p = await a.js('features/profile.js', 'm.get()')
    check(p['name'] == 'Priya' and p['logo'] == 'owl' and p['accent'] == 'rose' and p['theme'] == 'midnight' and p['font'] == 'modern' and p['style'] == 'soft' and p['onboarded'], f'profile {p}')
    check(await a.js('features/alarm.js', 'm.status().time') == '05:45', 'alarm set to the wake-up time')
    check(await a.js('features/sleep.js', 'm.get().schedule.bed') == '23:30', 'bedtime saved')
    await pg.reload(); await pg.wait_for_timeout(500)
    check(not await a.visible('#onboarding'), 'setup not shown again')
    check('Priya' in await pg.inner_text('.greet'), 'Pip greets by name on the next open')

@test('Onboarding', 'valid', 'Skipping the name works; Back keeps earlier choices')
async def t_onboard_skip(a):
    pg = await a.open(onboarded=False, clock=False)
    await pg.click('[data-ob=skip]'); await pg.wait_for_timeout(150)
    await pg.click('[data-pick=logo][data-value=bell]'); await pg.click('[data-ob=next]'); await pg.wait_for_timeout(150)
    await pg.click('[data-ob=back]'); await pg.wait_for_timeout(150)
    check(await pg.get_attribute('[data-pick=logo][data-value=bell]', 'aria-pressed') == 'true', 'choice kept after Back')
    check(await a.js('features/profile.js', 'm.get().name') == '', 'no name saved')

@test('Onboarding', 'invalid', 'Names are cleaned: no HTML, extra spaces, or over-long text')
async def t_name_clean(a):
    await a.open()
    r = await a.js('features/profile.js', "[m.set('name', '  <b>Bob</b>   the    great builder of everything  '), m.set('petName', '   '), m.set('name', '')]")
    check('<' not in r[0] and '>' not in r[0] and len(r[0]) <= 24 and '  ' not in r[0], f'cleaned name {r[0]!r}')
    check(r[1] == 'Pip', 'blank pet name falls back to Pip')
    check(r[2] == '', 'empty name allowed')

@test('Onboarding', 'invalid', 'Unknown look choices are refused; corrupted profile is repaired')
async def t_profile_invalid(a):
    await a.open(seed={'fl:profile': {'name': 'X', 'onboarded': True, 'theme': 'neon', 'font': 'comic-sans'}})
    p = await a.js('features/profile.js', 'm.get()')
    check(p['theme'] == 'noir' and p['font'] == 'classic', f'repaired {p}')
    r = await a.js('features/profile.js', "[m.set('theme', 'neon'), m.set('accent', ''), m.set('hacker', 1)]")
    check(r == [None, None, None], f'refused {r}')

# ---------- Personalisation
@test('Look & feel', 'valid', 'All 768 combinations (4 logos × 4 colours × 4 themes × 4 fonts × 3 styles) apply and stay readable')
async def t_all_combos(a):
    pg = await a.open(clock=False)
    res = await pg.evaluate("""async () => {
      const prof = await import('./js/features/profile.js'); const th = await import('./js/ui/theme.js'); const art = await import('./js/ui/art.js');
      const C = prof.CHOICES; const fails = []; let n = 0; const minC = {};
      const FAM = { classic: 'Bodoni Moda', modern: 'DM Serif Display', friendly: 'Nunito', typewriter: 'Courier Prime' };
      const RAD = { elegant: '12px', soft: '999px', bold: '6px' };
      const btn = document.querySelector('.btn.line, .btn.gold'); const h1 = document.querySelector('h1') || document.querySelector('.home-hero .clock');
      const note = (k, v) => { if (!(k in minC) || v < minC[k]) minC[k] = Math.round(v * 100) / 100; };
      for (const theme of C.theme) for (const accent of C.accent) for (const font of C.font) for (const style of C.style) for (const logo of C.logo) {
        prof.setMany({ theme, accent, font, style, logo }); n++;
        const root = document.documentElement, cs = getComputedStyle(root), v = (k) => cs.getPropertyValue(k).trim();
        const d = root.dataset;
        if (d.theme !== theme || d.accent !== accent || d.font !== font || d.style !== style) fails.push(`${theme}/${accent}/${font}/${style}: attributes`);
        const pairs = { 'text/bg': [v('--text'), v('--bg')], 'text/surface': [v('--text'), v('--surface')], 'text-2/bg': [v('--text-2'), v('--bg')], 'muted/surface-2': [v('--muted'), v('--surface-2')],
          'accent-text/bg': [v('--accent-text'), v('--bg')], 'accent-text/surface-2': [v('--accent-text'), v('--surface-2')], 'on-accent/accent': [v('--on-accent'), v('--accent')], 'danger/surface': [v('--danger'), v('--surface')] };
        for (const [k, [x, y]] of Object.entries(pairs)) { const c = th.contrast(x, y); note(k, c); if (c < 4.5) fails.push(`${theme}/${accent}: ${k} ${c.toFixed(2)}`); }
        const fam = getComputedStyle(document.querySelector('.home-hero .clock')).fontFamily;
        if (!fam.includes(FAM[font])) fails.push(`${font}: clock font ${fam}`);
        if (btn && getComputedStyle(btn).borderTopLeftRadius !== RAD[style]) fails.push(`${style}: radius ${getComputedStyle(btn).borderTopLeftRadius}`);
        if (!art.logoSVG(logo, th.artColours()).includes('<svg')) fails.push(`${logo}: logo`);
      }
      return { n, fails: [...new Set(fails)].slice(0, 15), minC };
    }""")
    check(res['n'] == 768, f"ran {res['n']} combinations")
    check(not res['fails'], f"problems: {res['fails']}")

@test('Look & feel', 'valid', 'Every bundled font file loads')
async def t_fonts_all(a):
    pg = await a.open(clock=False)
    r = await pg.evaluate("""async () => {
      const specs = ['500 20px "Bodoni Moda"', '600 20px "Bodoni Moda"', '700 20px "Bodoni Moda"', 'italic 500 20px "Bodoni Moda"', '400 18px "EB Garamond"', 'italic 400 18px "EB Garamond"', '600 18px "EB Garamond"',
        '400 20px "DM Serif Display"', '400 18px "DM Sans"', '700 18px "DM Sans"', '400 18px "Nunito"', '800 18px "Nunito"', '400 18px "Courier Prime"', '700 18px "Courier Prime"'];
      const out = {}; for (const sp of specs) out[sp] = (await document.fonts.load(sp)).length; return out; }""")
    bad = [k for k, v in r.items() if v == 0]
    check(not bad, f'fonts not loading: {bad}')

@test('Look & feel', 'valid', 'Changing theme, font and logo in Settings is saved across a restart')
async def t_settings_look(a):
    pg = await a.open(clock=False)
    await a.tab('settings')
    await pg.click('[data-group=look] [data-pick=theme][data-value=ivory]'); await pg.wait_for_timeout(200)
    await pg.click('[data-group=look] [data-pick=font][data-value=typewriter]'); await pg.wait_for_timeout(100)
    await pg.click('[data-group=look] [data-pick=logo][data-value=crescent]'); await pg.wait_for_timeout(100)
    await pg.reload(); await pg.wait_for_timeout(500)
    d = await pg.evaluate('({...document.documentElement.dataset})')
    check(d['theme'] == 'ivory' and d['font'] == 'typewriter', f'saved {d}')
    bg = await pg.evaluate("getComputedStyle(document.body).backgroundColor")
    check(bg == 'rgb(246, 241, 231)', f'ivory background applied: {bg}')

# ---------- Messages
@test('Messages', 'valid', 'A 4:00 alarm gets “Oho! … early riser” — every day')
async def t_msg_early(a):
    pg = await a.open(clock=False)
    r = await a.js('features/messages.js', "[...Array(14)].map((_, i) => m.alarmMessage('04:00', { date: new Date(2026, 9, 5 + i) }))")
    check(all('Oho' in x for x in r), f'messages {set(r)}')
    await pg.fill('[data-ref=time]', '04:00'); await pg.dispatch_event('[data-ref=time]', 'change'); await pg.wait_for_timeout(150)
    check('Oho' in await pg.inner_text('[data-ref=msg]'), 'shown on the Alarm tab')

@test('Messages', 'valid', 'Messages change by day and time, mention streaks, and handle weekends')
async def t_msg_vary(a):
    await a.open(clock=False)
    r = await a.js('features/messages.js', """({
      days: new Set([...Array(10)].map((_, i) => m.alarmMessage('07:00', { date: new Date(2026, 9, 5 + i) }))).size,
      owl: m.alarmMessage('03:00', { date: new Date(2026, 9, 7) }),
      late: m.alarmMessage('11:00', { date: new Date(2026, 9, 7) }),
      streak: m.alarmMessage('07:00', { date: new Date(2026, 9, 7), streak: 5 }),
      junk: m.alarmMessage('garbage'),
      hello: [2, 9, 14, 19, 23].map((h) => m.greeting('Priya', h))
    })""")
    check(r['days'] >= 2, 'varies day to day')
    check('🦉' in r['owl'] or 'Legendary' in r['owl'] or 'Bold' in r['owl'], f"very early line {r['owl']}")
    check('Streak: 5 🔥' in r['streak'], 'streak mentioned')
    check(isinstance(r['junk'], str) and len(r['junk']) > 5, 'bad input still gives a message')
    check(r['hello'][1].startswith('Good morning, Priya') and r['hello'][3].startswith('Good evening') and 'late' in r['hello'][0].lower(), f"greetings {r['hello']}")

# ---------- Pip
@test('Pip', 'valid', 'Pip’s mood follows your behaviour (happy, ecstatic, grumpy, sulking, sleepy)')
async def t_pet_moods(a):
    await a.open(clock=False)
    r = await a.js('features/pet.js', """[
      m.moodFor({ hour: 9, streak: 8, wins: 8, provenToday: true, snoozesToday: 0, missesToday: 0, morningActive: false }),
      m.moodFor({ hour: 9, streak: 3, wins: 3, provenToday: true, snoozesToday: 0, missesToday: 0, morningActive: false }),
      m.moodFor({ hour: 7, streak: 3, wins: 3, provenToday: false, snoozesToday: 1, missesToday: 0, morningActive: true }),
      m.moodFor({ hour: 15, streak: 0, wins: 4, provenToday: false, snoozesToday: 0, missesToday: 0, morningActive: false }),
      m.moodFor({ hour: 23, streak: 2, wins: 2, provenToday: false, snoozesToday: 0, missesToday: 0, morningActive: false }),
      m.moodFor({ hour: 12, streak: 0, wins: 0, provenToday: false, snoozesToday: 0, missesToday: 0, morningActive: false })]""")
    check(r == ['ecstatic', 'happy', 'grumpy', 'sulking', 'sleepy', 'neutral'], f'moods {r}')

@test('Pip', 'valid', 'Pip turns grumpy after a real snooze, and answers when poked')
async def t_pet_grumpy(a):
    pg = await a.open(at=ms(ist(2026, 10, 14, 7)))
    await a.fire_direct(test=False)
    await pg.click('#morning [data-ref=snooze]'); await pg.wait_for_timeout(200)
    check(await a.js('features/pet.js', 'm.current()') == 'grumpy', 'grumpy after snooze')
    await pg.click('#morning [data-ref=up]'); await a.type_phrase()
    await a.js('features/morning.js', '(m.close(), true)'); await pg.wait_for_timeout(200)
    await a.tab('alarm')
    check(await pg.query_selector('.pet-card .pet-grumpy'), 'grumpy Pip on the Alarm tab')
    before = await pg.inner_text('.pet-card .bubble p')
    await pg.click('.pet-card .pet-hit'); await pg.wait_for_timeout(100)
    check(await pg.inner_text('.pet-card .bubble p') != before, 'poke gives a new line')

@test('Pip', 'valid', 'Opening the app: Pip flies in with “Good morning, Priya”, then the app appears; tap skips')
async def t_greet(a):
    pg = await a.open(greet=True, at=ms(ist(2026, 10, 14, 9)))
    check('Good morning, Priya' in await pg.inner_text('.greet'), 'greeting shown')
    await a.tick(2600)
    check(not await pg.query_selector('.greet'), 'greeting goes away by itself')
    await pg.reload(); await pg.wait_for_timeout(300)
    await pg.click('.greet'); await a.tick(500)
    check(not await pg.query_selector('.greet'), 'tap skips it')

# ---------- Sleep
@test('Sleep', 'valid', '“Going to sleep” at 23:00, alarm stopped 7.5 h later: night logged as a little short')
async def t_sleep_track(a):
    pg = await a.open(seed=NO_PROMPTS, at=ms(ist(2026, 10, 13, 23)))
    await pg.click('.sleep-card [data-ref=now]'); await pg.wait_for_timeout(150)
    check('Sweet dreams' in await a.toast_text(), 'friendly confirmation')
    await pg.clock.fast_forward(int(7.5 * 3600 * 1000)); await pg.wait_for_timeout(200)
    await a.fire_direct(test=False); await a.type_phrase()
    n = await a.js('features/sleep.js', 'm.get().nights[0]')
    check(n and abs(n['hours'] - 7.5) < 0.05, f'night {n}')
    check(await a.js('features/sleep.js', 'm.classify(7.5).key') == 'bit-short', 'classified a little short')

@test('Sleep', 'valid', 'A short night shows the research-backed day plan; tips can be ticked off')
async def t_recovery(a):
    pg = await a.open(seed=NO_PROMPTS, at=ms(ist(2026, 10, 14, 7)))
    await a.js('features/sleep.js', '(m.goingToSleep(Date.now() - 5 * 3600e3), true)')
    await a.fire_direct(test=False); await a.type_phrase()
    await a.js('features/morning.js', '(m.close(), true)'); await pg.wait_for_timeout(200)
    await a.tab('alarm')
    check(await a.visible('.recovery'), 'plan shown after 5 h')
    check(len(await pg.query_selector_all('.recovery .tips li')) == 7, 'seven tips')
    await pg.click('.recovery [data-tip=stairs]'); await pg.wait_for_timeout(100)
    check('1/7' in await pg.inner_text('.recovery'), 'progress updates')
    await pg.click('.recovery [data-open=coffee]'); await pg.wait_for_timeout(100)
    href = await pg.get_attribute('.recovery .why a', 'href')
    check(href and href.startswith('https://'), 'source link shown')
    await pg.reload(); await pg.wait_for_timeout(400); await pg.evaluate("document.querySelector('.greet')?.remove()")
    check('1/7' in await pg.inner_text('.recovery'), 'ticks saved')

@test('Sleep', 'invalid', 'Nonsense nights aren’t logged (under 1 h or over 16 h); a good night hides the plan')
async def t_sleep_invalid(a):
    pg = await a.open(seed=NO_PROMPTS)
    r = await a.js('features/sleep.js', "[(m.goingToSleep(Date.now() - 30*60e3), m.recordWake()), (m.goingToSleep(Date.now() - 20*3600e3), m.recordWake()), m.get().nights.length]")
    check(r == [None, None, 0], f'not logged {r}')
    await a.js('features/sleep.js', '(m.goingToSleep(Date.now() - 8 * 3600e3), m.recordWake(), true)')
    await a.tab('alarm')
    check(not await a.visible('.recovery'), 'no plan after 8 h')

@test('Sleep', 'invalid', 'Schedule rejects bad times and keeps the goal between 6 and 10 h')
async def t_sleep_schedule(a):
    await a.open(seed=NO_PROMPTS)
    r = await a.js('features/sleep.js', "[m.setSchedule({ bed: '25:00' }).bed, m.setSchedule({ wake: 'soon' }).wake, m.setSchedule({ goal: 12 }).goal, m.setSchedule({ goal: 3 }).goal, m.setSchedule({ goal: 7.3 }).goal, m.setSchedule({ goal: 'x' }).goal]")
    check(r == ['23:00', '06:30', 10, 6, 7.5, 7.5], f'schedule {r}')

@test('Sleep', 'valid', 'Bedtime nudge: “In 30 minutes” reminds you; “Going to sleep” then a gentle “still awake?”')
async def t_bedtime_flow(a):
    pg = await a.open(at=ms(ist(2026, 10, 14, 22, 59, 30)))
    await a.tick(40_000)
    check('Heading to bed, Priya' in await pg.inner_text('.sheet'), 'bedtime nudge')
    await pg.click('.sheet [data-i="1"]'); await pg.wait_for_timeout(150)
    check('remind you in 30' in await a.toast_text(), '“Okie, I’ll remind you in 30”')
    await a.tick(30 * 60_000 + 2000)
    check('30 minutes are up' in await pg.inner_text('.sheet'), 'reminder after 30 min')
    await pg.click('.sheet [data-i="0"]'); await pg.wait_for_timeout(150)
    bed = await a.js('features/sleep.js', 'm.get().pending.bedAt')
    check(bed, 'bedtime noted')
    await a.tick(30 * 60_000 + 2000)
    check('Drifting off' in await pg.inner_text('.sheet'), 'gentle check after 30 min')
    await pg.click('.sheet [data-i="0"]'); await pg.wait_for_timeout(150)
    check(await a.js('features/sleep.js', 'm.get().pending.bedAt') > bed, '“Still awake” moves bedtime later')

@test('Sleep', 'invalid', '“Not tonight” stops nudges for the night; “still awake?” can be turned off')
async def t_bedtime_off(a):
    pg = await a.open(at=ms(ist(2026, 10, 14, 22, 59, 30)), seed={'fl:sleep': {'asleepCheck': 'off'}})
    await a.tick(40_000)
    await pg.click('.sheet [data-i="2"]'); await pg.wait_for_timeout(150)
    await a.tick(60 * 60_000)
    check(not await pg.query_selector('.sheet'), 'no more nudges tonight')
    await a.js('features/sleep.js', '(m.goingToSleep(), true)')
    await a.tick(31 * 60_000)
    check(not await pg.query_selector('.sheet'), 'no “still awake?” when off')

def nights_seed(end, count, hours):
    out = []
    for i in range(count):
        wake = end - timedelta(days=i + 1) + timedelta(hours=7 - end.hour)
        out.append({'date': wake.strftime('%Y-%m-%d'), 'bedAt': ms(wake - timedelta(hours=hours)), 'wakeAt': ms(wake), 'hours': hours})
    return out

@test('Sleep', 'valid', 'Saturday after a short week: suggests a Sunday sleep-in (capped at 2 h) and moves the alarm in one tap')
async def t_sunday(a):
    sat = ist(2026, 10, 17, 15)
    pg = await a.open(at=ms(sat), seed={'fl:sleep': {'prompts': False, 'nights': nights_seed(sat, 5, 6)}})
    adv = await a.js('features/sleep.js', 'm.sundayAdvice()')
    check(adv and adv['minutes'] == 120 and adv['debt'] == 10, f'advice {adv}')
    check('Sunday sleep-in' in await pg.inner_text('.sleep-card'), 'card shown')
    await pg.click('.sleep-card [data-ref=sleepin]'); await pg.wait_for_timeout(150)
    check(await a.js('features/alarm.js', "m.status().overrides['2026-10-18']") == '08:30', 'Sunday alarm 06:30 → 08:30')
    await a.js('features/alarm.js', '(m.arm(), true)'); await pg.wait_for_timeout(200)
    await pg.click('#night [data-ref=back]')  # arming opens the night screen in the browser version
    armed = await a.js('features/alarm.js', 'm.status().armedAt')
    check(armed == ms(ist(2026, 10, 18, 8, 30)), 'armed for Sunday 08:30')
    await pg.click('.sleep-card [data-ref=undo]'); await pg.wait_for_timeout(150)
    check(await a.js('features/alarm.js', 'm.status().armedAt') == ms(ist(2026, 10, 18, 6, 30)), 'back to 06:30')

@test('Sleep', 'invalid', 'No sleep-in advice midweek, with too few nights, or after a good week')
async def t_sunday_none(a):
    wed = ist(2026, 10, 14, 15)
    await a.open(at=ms(wed), seed={'fl:sleep': {'prompts': False, 'nights': nights_seed(wed, 5, 6)}})
    check(await a.js('features/sleep.js', 'm.sundayAdvice()') is None, 'not on Wednesday')
    await a.close()
    sat = ist(2026, 10, 17, 15)
    a2 = App(a.browser); await a2.open(at=ms(sat), seed={'fl:sleep': {'prompts': False, 'nights': nights_seed(sat, 2, 5)}})
    check(await a2.js('features/sleep.js', 'm.sundayAdvice()') is None, 'not with only 2 nights'); await a2.close()
    a3 = App(a.browser); await a3.open(at=ms(sat), seed={'fl:sleep': {'prompts': False, 'nights': nights_seed(sat, 6, 8)}})
    check(await a3.js('features/sleep.js', 'm.sundayAdvice()') is None, 'not after a good week'); await a3.close()

@test('Sleep', 'invalid', 'One-off alarm times reject bad dates and times; old ones are cleaned up')
async def t_override_invalid(a):
    await a.open(at=ms(ist(2026, 10, 14, 12)))
    r = await a.js('features/alarm.js', "[m.setOverride('tomorrow', '08:00'), m.setOverride('2026-10-18', '25:00'), m.setOverride('2026-10-01', '08:00'), Object.keys(m.status().overrides)]")
    check(r[0] is False and r[1] is False, f'bad input refused {r}')
    check('2026-10-01' not in r[3], 'past override removed')

@test('Sleep', 'valid', 'This week’s sleep chart shows each night against the goal')
async def t_sleep_chart(a):
    now = ist(2026, 10, 14, 15)
    pg = await a.open(at=ms(now), seed={'fl:sleep': {'prompts': False, 'nights': nights_seed(now, 4, 6) + [{'date': '2026-10-09', 'bedAt': ms(ist(2026, 10, 8, 23)), 'wakeAt': ms(ist(2026, 10, 9, 8)), 'hours': 9}]}})
    await a.tab('progress')
    bars = await pg.query_selector_all('.sleep-chart .bar')
    check(len(bars) == 5, f'{len(bars)} bars')
    check(len(await pg.query_selector_all('.sleep-chart .bar.short')) == 4, 'short nights marked')
    check('6.6 h average' in await pg.inner_text('[data-tab=progress]'), 'average shown')

# ---------- Sounds
@test('Sounds', 'valid', 'Every alarm and notification sound file is bundled')
async def t_sound_files(a):
    pg = await a.open(clock=False)
    r = await pg.evaluate("""async () => { const s = await import('./js/features/sounds.js');
      const files = [...s.ALARM_SOUNDS.map((x) => 'sounds/alarm_' + x.id + '.mp3'), ...s.SHORT_SOUNDS.map((x) => 'sounds/note_' + x.id + '.mp3'), 'sounds/note_warm.mp3'];
      return Promise.all(files.map(async (f) => [f, (await fetch(f)).status])); }""")
    bad = [f for f, st in r if st != 200]
    check(not bad, f'missing {bad}')

@test('Sounds', 'invalid', 'Choosing sounds: valid picks are saved and previewed, unknown ones refused')
async def t_sound_pick(a):
    pg = await a.open(clock=False)
    r = await a.js('features/sounds.js', "[m.set('checkin', 'marimba'), m.set('checkin', 'airhorn'), m.set('alarm', 'chime'), m.set('volume', 'bell')]")
    check(r == ['marimba', None, None, None], f'picks {r}')
    await a.tab('settings')
    await pg.click('[data-sounds=message] [data-sound=harp]'); await pg.wait_for_timeout(150)
    await pg.reload(); await pg.wait_for_timeout(400)
    check(await a.js('features/sounds.js', 'm.get().message') == 'harp', 'saved')

@test('Sounds', 'valid', 'Check-in plays your chosen sound in a loop (not beeps)')
async def t_checkin_sound(a):
    pg = await a.open(seed={'fl:tasks': ONE_TASK})
    ok = await a.js('features/sounds.js', 'await m.startLoop("checkin")')
    await a.js('features/sounds.js', '(m.stopLoop(), true)')
    check(ok is True, 'sound file plays')
    await a.fire_direct(); await a.type_phrase(); await a.tick(5 * 60_000 + 1000); await pg.wait_for_timeout(300)
    check(await a.visible('#checkin'), 'check-in open')
    check(not await a.js('services/audio.js', 'm.isBeeping()'), 'no fallback beeps')

# ---------- Android app (fake bridge)
async def first_light(a, method):
    return [c for c in await a.native_calls(method) if c['plugin'] == 'FirstLight']

@test('Android', 'valid', 'Arming schedules Android’s alarm (repeats daily) and hands over today’s song; disarm cancels')
async def t_native_arm(a):
    pg = await a.open(native={}, battery=(0.12, False))
    await a.tab('sounds'); await pg.set_input_files('[data-ref=songInput]', [str(FIX / 'song-a.wav')]); await pg.wait_for_timeout(400)
    await a.tab('alarm'); await a.arm_by_keyboard(); await pg.wait_for_timeout(500)
    check(not await pg.query_selector('.sheet'), 'no battery warning in the app')
    check(not await a.visible('#night'), 'no night screen in the app')
    sch = [c['args'] for c in await first_light(a, 'schedule') if c['args']['id'] == 'wake']
    check(sch and sch[-1]['repeatDaily'] and sch[-1]['kind'] == 'wake', f'scheduled {sch}')
    files = [c['args'] for c in await first_light(a, 'setSoundFile') if c['args']['which'] == 'alarm']
    check(files and files[-1]['base64'] != '<0 chars>', 'song handed to Android')
    await pg.click('[data-ref=disarm]'); await pg.wait_for_timeout(200)
    check(any(c['args']['id'] == 'wake' for c in await first_light(a, 'cancel')), 'cancelled on disarm')

@test('Android', 'valid', 'Test alarm is scheduled with Android for 10 seconds from now')
async def t_native_test(a):
    pg = await a.open(native={}, clock=False)
    await pg.click('[data-ref=test]'); await pg.wait_for_timeout(300)
    t = [c['args'] for c in await first_light(a, 'schedule') if c['args']['id'] == 'test']
    now = await pg.evaluate('Date.now()')
    check(t and 8000 < t[-1]['at'] - now < 11000, f'test scheduled {t}')

@test('Android', 'valid', 'Android rings → app shows the alarm; stopping it silences Android')
async def t_native_ring(a):
    pg = await a.open(native={}, clock=False)
    await pg.evaluate("window.__nativeEmit('alarm', { kind: 'wake' })"); await pg.wait_for_timeout(500)
    check(await a.phase() == 'ringing', 'ringing screen')
    check(await first_light(a, 'ring'), 'Android asked to ring')
    await a.type_phrase(); await pg.wait_for_timeout(200)
    check(await first_light(a, 'stopRinging'), 'Android silenced')

@test('Android', 'valid', 'Opened from the lock-screen alarm: the alarm screen is ready immediately')
async def t_native_launch(a):
    await a.open(native={'launch': {'kind': 'wake'}}, clock=False)
    await a.pg.wait_for_timeout(400)
    check(await a.phase() == 'ringing', 'ringing on open')

@test('Android', 'valid', 'Snooze is handed to Android, and its alarm brings the ring back')
async def t_native_snooze(a):
    pg = await a.open(native={}, clock=False)
    await pg.evaluate("window.__nativeEmit('alarm', { kind: 'wake' })"); await pg.wait_for_timeout(400)
    await pg.click('#morning [data-ref=snooze]'); await pg.wait_for_timeout(200)
    check(any(c['args']['id'] == 'snooze' for c in await first_light(a, 'schedule')), 'snooze scheduled')
    await pg.evaluate("window.__nativeEmit('alarm', { kind: 'snooze' })"); await pg.wait_for_timeout(300)
    check(await a.phase() == 'ringing', 'rings again')

@test('Android', 'valid', 'Check-in: scheduled with Android; answering cancels it; missing it plays the punishment ring')
async def t_native_checkin(a):
    pg = await a.open(native={}, seed={'fl:tasks': ONE_TASK})
    await pg.evaluate("window.__nativeEmit('alarm', { kind: 'wake' })"); await pg.wait_for_timeout(400)
    await a.type_phrase()
    check(any(c['args']['id'] == 'checkin' for c in await first_light(a, 'schedule')), 'check-in scheduled')
    await a.tick(5 * 60_000 + 1000); await a.tick(61_000); await pg.wait_for_timeout(300)
    rings = [c['args']['kind'] for c in await first_light(a, 'ring')]
    check('punish' in rings, f'punishment ring {rings}')
    await a.type_phrase(); await a.tick(5 * 60_000 + 1000)
    await pg.click('#checkin [data-ref=yes]'); await pg.wait_for_timeout(200)
    check(any(c['args']['id'] == 'checkin' for c in await first_light(a, 'cancel')), 'check-in cancelled after answering')

@test('Android', 'valid', 'Bedtime nudges are scheduled daily with Android; turning them off cancels')
async def t_native_bedtime(a):
    pg = await a.open(native={}, clock=False)
    sch = [c['args'] for c in await first_light(a, 'schedule') if c['args']['id'] == 'bedtime']
    check(sch and sch[-1]['repeatDaily'] and sch[-1]['kind'] == 'bedtime', f'bedtime {sch}')
    await a.tab('settings')
    await pg.click('[data-group=sleep] [data-switch=prompts]'); await pg.wait_for_timeout(150)
    check(any(c['args']['id'] == 'bedtime' for c in await first_light(a, 'cancel')), 'cancelled')
    await pg.click('[data-seg=asleep] [data-value=silent]'); await pg.wait_for_timeout(150)
    check(any(c['args'].get('asleep') == 'silent' for c in await first_light(a, 'setSounds')), 'silent check sent to Android')

@test('Android', 'valid', 'Bedtime answers given on the notification (app closed) count toward sleep tracking')
async def t_native_sleep_events(a):
    now = ms(ist(2026, 10, 14, 7))
    pg = await a.open(native={'sleepEvents': [{'type': 'later', 'at': now - int(8.5 * 3600e3)}, {'type': 'sleep', 'at': now - 8 * 3600 * 1000}]}, at=now)
    await pg.evaluate("window.__nativeEmit('alarm', { kind: 'wake' })"); await pg.wait_for_timeout(400)
    await a.type_phrase()
    n = await a.js('features/sleep.js', 'm.get().nights[0]')
    check(n and abs(n['hours'] - 8) < 0.05, f'night {n}')

@test('Android', 'valid', 'Picking a logo changes the home-screen icon; light theme switches status-bar icons')
async def t_native_icon(a):
    pg = await a.open(native={}, clock=False)
    await a.tab('settings')
    await pg.click('[data-group=look] [data-pick=logo][data-value=bell]'); await pg.wait_for_timeout(150)
    check(any(c['args']['name'] == 'bell' for c in await first_light(a, 'setIcon')), 'icon changed')
    await pg.click('[data-group=look] [data-pick=theme][data-value=ivory]'); await pg.wait_for_timeout(200)
    styles = [c['args']['style'] for c in await a.native_calls('setStyle') if c['plugin'] == 'SystemBars']
    check(styles and styles[-1] == 'LIGHT', f'status bar {styles}')

@test('Android', 'invalid', 'Missing permissions are flagged on the Alarm tab with a one-tap fix')
async def t_native_perms(a):
    pg = await a.open(native={'status': {'exactAlarms': False}}, clock=False)
    await pg.wait_for_timeout(300)
    check(await a.visible('[data-ref=permWarn]'), 'warning shown')
    await pg.click('[data-ref=permWarn] [data-fix]'); await pg.wait_for_timeout(150)
    check(any(c['args'].get('which') == 'exactAlarm' for c in await first_light(a, 'openSettings')), 'opens the right Android setting')

@test('Android', 'valid', 'First-run setup includes a permissions step that can ask for notifications')
async def t_native_onboard(a):
    pg = await a.open(native={'status': {'notifications': False}}, onboarded=False, clock=False)
    for _ in range(7):
        if await pg.query_selector('[data-ob=skip]') and 'name' in (await pg.get_attribute('.ob-step', 'data-step')): await pg.click('[data-ob=skip]')
        else: await pg.click('[data-ob=next]')
        await pg.wait_for_timeout(200)
    check('ring with the app closed' in await pg.inner_text('#onboarding'), 'permissions step')
    await pg.wait_for_timeout(300)
    await pg.click('[data-perm=notifications]'); await pg.wait_for_timeout(300)
    check(await first_light(a, 'requestNotifications'), 'asked for notifications')

@test('Android', 'valid', 'App lock: choose apps, it locks for real mornings, unlocks when proven (not for tests)')
async def t_native_lock(a):
    pg = await a.open(native={'status': {'accessibility': True}}, seed={'fl:tasks': ONE_TASK})
    await a.tab('settings')
    await pg.click('[data-group=applock] [data-switch=lock]'); await pg.wait_for_timeout(150)
    await pg.click('[data-group=applock] [data-ref=load]'); await pg.wait_for_timeout(300)
    await pg.click('[data-app="com.instagram.android"]'); await pg.wait_for_timeout(200)
    cfg = [c['args'] for c in await first_light(a, 'configureLock')][-1]
    check(cfg['enabled'] and cfg['packages'] == ['com.instagram.android'], f'config {cfg}')
    await a.fire_direct(test=True); await a.type_phrase()
    check(not await first_light(a, 'lockNow'), 'test alarms never lock')
    await a.js('features/morning.js', '(m.close(), true)')
    await a.fire_direct(test=False)
    check(await first_light(a, 'lockNow'), 'locked for a real morning')
    await a.type_phrase(); await a.prove_current_task()
    check(await first_light(a, 'unlock'), 'unlocked when proven')

@test('Android', 'invalid', 'App lock refuses bad app names and keeps the auto-unlock between 1 and 6 h')
async def t_native_lock_invalid(a):
    await a.open(native={}, clock=False)
    r = await a.js('features/applock.js', "[m.toggleApp('bad pkg!'), m.toggleApp(''), m.toggleApp(42), m.setMaxHours(0), m.setMaxHours(24), m.setMaxHours('x')]")
    check(r == [None, None, None, 1, 6, 6], f'values {r}')

@test('Android', 'invalid', 'Opening a locked app shows a reminder; emergency unlock needs the exact phrase and is recorded')
async def t_native_blocked(a):
    pg = await a.open(native={}, clock=False)
    await pg.evaluate("window.__nativeEmit('locked', { pkg: 'com.instagram.android' })"); await pg.wait_for_timeout(300)
    check('is locked' in await pg.inner_text('.sheet'), 'reminder shown')
    await pg.click('.sheet [data-i="1"]'); await pg.wait_for_timeout(150)
    await pg.fill('.sheet input', 'let me in'); await pg.click('.sheet [data-go]'); await pg.wait_for_timeout(150)
    check(not await first_light(a, 'unlock') and await pg.query_selector('.sheet input'), 'wrong phrase refused')
    await pg.fill('.sheet input', 'I need my apps right now'); await pg.click('.sheet [data-go]'); await pg.wait_for_timeout(200)
    check(await first_light(a, 'unlock'), 'unlocked')
    await a.tab('progress')
    check('Emergency unlocks' in await pg.inner_text('[data-tab=progress]'), 'recorded in Progress')

@test('Android', 'valid', 'Spotify in the app: Android rings first, then Spotify takes over')
async def t_native_spotify(a):
    pg = await a.open(native={}, clock=False, spotify={}, seed=CONNECTED)
    await pg.evaluate("window.__nativeEmit('alarm', { kind: 'wake' })"); await pg.wait_for_timeout(3000)
    names = [c['method'] for c in await a.native_calls() if c['plugin'] == 'FirstLight' and c['method'] in ('ring', 'stopRinging')]
    check(names[:2] == ['ring', 'stopRinging'], f'order {names}')
    check(await a.js('features/music.js', 'm.status().playing') == 'spotify', 'Spotify playing')

@test('Android', 'valid', 'A Sunday sleep-in updates Android’s scheduled alarm')
async def t_native_override(a):
    pg = await a.open(native={}, at=ms(ist(2026, 10, 17, 15)))
    await a.js('features/alarm.js', '(m.arm(), true)'); await pg.wait_for_timeout(200)
    await a.js('features/alarm.js', "(m.setOverride('2026-10-18', '08:30'), true)"); await pg.wait_for_timeout(200)
    last = [c['args'] for c in await first_light(a, 'schedule') if c['args']['id'] == 'wake'][-1]
    check(last['at'] == ms(ist(2026, 10, 18, 8, 30)), f'rescheduled {last}')

@test('Android', 'valid', 'The browser version never touches the Android bridge')
async def t_web_no_native(a):
    pg = await a.open(clock=False)
    check(not await pg.evaluate('window.Capacitor.isNativePlatform()'), 'web mode')
    check(await pg.evaluate('window.__nativeCalls === undefined'), 'no native calls')


@test('Android', 'valid', 'Locked apps are named nicely even without a label (com.instagram.android → Instagram)')
async def t_native_labels(a):
    await a.open(native={}, clock=False)
    r = await a.js('features/applock.js', "[m.labelFor('com.instagram.android'), m.labelFor('com.google.android.youtube'), m.labelFor('x.y', 'Real Name')]")
    check(r == ['Instagram', 'Youtube', 'Real Name'], f'labels {r}')

@test('App', 'valid', 'Only one message (toast) shows at a time')
async def t_one_toast(a):
    pg = await a.open(clock=False)
    await pg.evaluate("async () => { const u = await import('./js/core/util.js'); u.toast('one'); u.toast('two'); u.toast('three'); }")
    check(await pg.eval_on_selector_all('.toast', 'e => e.map(x => x.innerText)') == ['three'], 'latest toast only')

@test('Android', 'valid', 'The permission warning clears once setup granted everything')
async def t_native_warning_clears(a):
    pg = await a.open(native={'status': {'notifications': False}}, onboarded=False, clock=False)
    while await pg.query_selector('#onboarding'):
        step = await pg.get_attribute('.ob-step', 'data-step')
        if step == 'permissions': await pg.click('[data-perm=notifications]'); await pg.wait_for_timeout(1000)
        await pg.click('[data-ob=next]'); await pg.wait_for_timeout(250)
    await pg.wait_for_timeout(500)
    check(not await a.visible('[data-ref=permWarn]'), 'no stale warning')

# ================================================================== runner
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

async def main(filter_text):
    httpd = serve()
    chosen = [t for t in TESTS if not filter_text or filter_text.lower() in (t['group'] + ' ' + t['name']).lower()]
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=ARGS)
        for t in chosen:
            a = App(browser)
            start = time.time()
            status, err = 'PASS', ''
            try:
                await asyncio.wait_for(t['fn'](a), timeout=60)
                if a.errors:
                    status, err = 'FAIL', 'Page error: ' + '; '.join(a.errors)[:300]
            except Fail as e:
                status, err = 'FAIL', str(e)
            except Exception as e:
                status, err = 'FAIL', f'{type(e).__name__}: {str(e).splitlines()[0][:300]}'
            finally:
                try: await a.close()
                except Exception: pass
            ms = int((time.time() - start) * 1000)
            results.append({**t, 'status': status, 'error': err, 'ms': ms})
            print(f"{'✔' if status == 'PASS' else '✘'} [{t['group']}] {t['name']} ({ms} ms){'  — ' + err if err else ''}", flush=True)
        await browser.close()
    httpd.shutdown()
    write_report(results)
    return results

def write_report(results):
    passed = sum(r['status'] == 'PASS' for r in results)
    valid = [r for r in results if r['kind'] == 'valid']
    invalid = [r for r in results if r['kind'] == 'invalid']
    lines = [
        '# First Light — test report', '',
        f"Run on {time.strftime('%Y-%m-%d %H:%M')} in headless Chromium at phone size (390×844).", '',
        f"**{passed} of {len(results)} passed.** {len(valid)} valid-use cases, {len(invalid)} invalid-input or failure cases.", '',
        'Spotify and YouTube were replaced with local stand-ins (`tests/mocks/`), so these tests prove the app’s handling of each response, not Spotify’s or YouTube’s own servers. Run a test alarm on your phone to confirm those end to end.', '',
        '| Result | Group | Type | Test | Time |', '|---|---|---|---|---|'
    ]
    for r in results:
        note = f"<br>_{r['error']}_" if r['error'] else ''
        lines.append(f"| {'✅' if r['status'] == 'PASS' else '❌'} | {r['group']} | {r['kind']} | {r['name']}{note} | {r['ms'] / 1000:.1f}s |")
    lines += ['', 'Re-run with `python3 tests/run_tests.py` (needs `pip install playwright` and `playwright install chromium`).', '']
    (ROOT / 'tests' / 'TEST-REPORT.md').write_text('\n'.join(lines))

if __name__ == '__main__':
    res = asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else ''))
    sys.exit(0 if all(r['status'] == 'PASS' for r in res) else 1)
