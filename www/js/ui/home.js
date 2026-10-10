// Alarm tab: the sky and clock, then the one thing you come here for (wake time + slide to arm),
// then Pip and two quiet rows (sleep, tomorrow's tasks). Everything else is a tap away.
import { on, emit } from '../core/events.js';
import { refs, esc, fmtTime, fmtDur, toast, vibrateTap, plural } from '../core/util.js';
import * as alarm from '../features/alarm.js';
import * as tasks from '../features/tasks.js';
import * as guard from '../features/battery-guard.js';
import * as music from '../features/music.js';
import * as spotify from '../features/sources/spotify.js';
import * as battery from '../services/battery.js';
import * as audio from '../services/audio.js';
import { requestPermission } from '../services/notify.js';
import { sheet, ICONS } from './components.js';
import { scene, skyState } from './scene.js';
import { skyNow } from '../features/daylight.js';
import * as places from '../features/places.js';
import * as tabs from './tabs.js';
import * as native from '../services/native.js';
import * as petView from './pet-view.js';
import * as stats from '../features/stats.js';
import * as profile from '../features/profile.js';
import { alarmMessage } from '../features/messages.js';
import * as sleepView from './sleep-view.js';
import * as recoveryView from './recovery-view.js';
import { icon, weatherIcon } from './icons.js';

const inApp = native.isNative();

const timeParts = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  const s = fmtTime(d);
  const mm = s.match(/^(.*?)(\s?[AaPp]\.?[Mm]\.?)$/);
  return mm ? { main: mm[1], suffix: mm[2].trim() } : { main: s, suffix: '' };
};

export function mount(root) {
  root.innerHTML = `
    <section class="home-hero">
      <div class="clock" data-ref="clock">--:--</div>
      <div class="date" data-ref="date"></div>
      <div class="burst-wrap" data-ref="burst"></div>
      <button class="place-line hidden" data-ref="place" aria-haspopup="dialog"></button>
    </section>

    <div class="card alarm-card">
      <label class="time-pick">
        <span class="label">Wake at</span>
        <span class="value" data-ref="timeShow"></span>
        <input type="time" data-ref="time" aria-label="Wake-up time" required>
      </label>
      <p class="arm-status" data-ref="status" aria-live="polite"></p>
      <div class="slide" data-ref="slide">
        <div class="fill" data-ref="fill"></div>
        <div class="text">Slide to arm</div>
        <button class="thumb" data-ref="thumb" aria-label="Arm alarm. Press Enter, or slide right.">${ICONS.sun}</button>
      </div>
      <div class="armed-box hidden" data-ref="armedBox">
        ${inApp ? '' : '<button class="btn gold" data-ref="night">Night screen</button>'}
        <button class="btn line" data-ref="disarm">Disarm</button>
      </div>
    </div>

    <div class="card notice warn hidden" data-ref="permWarn"></div>
    <div data-ref="pet"></div>
    <div class="hidden" data-ref="recovery"></div>
    <div class="card rows">
      <div data-ref="sleep"></div>
      <button class="row-link" data-ref="edit">${icon('check')}<span class="grow">Tomorrow</span><span class="muted" data-ref="ritual"></span><span class="chev" aria-hidden="true">›</span></button>
    </div>
    <div class="home-foot">
      <button class="btn quiet" data-ref="test">Try a test alarm</button>
      <span class="battery-pill hidden" data-ref="batt"></span>
    </div>`;
  const r = refs(root);

  /* ----- status ----- */
  function statusText(now) {
    const a = alarm.status();
    if (a.testAt) return `Test alarm in ${fmtDur(a.testAt - now)}`;
    if (a.armedAt) return `Armed · rings in ${fmtDur(a.armedAt - now)}`;
    return inApp ? 'Not armed. Slide before bed.' : 'Not armed. Slide, then leave me open.';
  }

  /* ----- sky + place ----- */
  let skyKey = '', lastMinute = -1;
  function paintSky(now = Date.now(), force = false) {
    const { mins, rise, set, city, fx } = skyNow(now);
    const st = skyState(mins, rise, set);
    const key = `${st.phase}|${Math.round(st.lit * 12)}|${Math.round(st.alt * 12)}|${city?.id || ''}|${fx}`;
    if (!force && key === skyKey) return;
    skyKey = key;
    r.burst.innerHTML = scene({ mins, rise, set, city: city?.id || null, fx, seed: 7, label: `${st.label}${city ? ` in ${city.name}` : ''}` });
  }

  // One line under the sky for city themes: the city's time and weather. Tap for today's fact and headline.
  function paintPlace() {
    const c = places.info();
    r.place.classList.toggle('hidden', !c);
    if (!c) return;
    const w = c.weather;
    r.place.innerHTML = `<span class="place-name">${esc(c.name)} <span class="muted">${esc(c.time)}</span></span>${w ? `<span class="wx">${weatherIcon(w.kind, w.isDay, 20)}${w.temp}° ${esc(w.label)}</span>` : ''}<span class="chev" aria-hidden="true">›</span>`;
    r.place.setAttribute('aria-label', `${c.name}, ${c.time}${w ? `, ${w.temp} degrees, ${w.label}` : ''}. More about ${c.name}`);
  }
  r.place.onclick = async () => {
    const c = places.info();
    if (!c) return;
    const parts = [];
    if (c.news) parts.push(`<p class="sheet-line">${icon('news', 18)}<span>${esc(c.news.title)} <button class="link-btn" data-open="${esc(c.news.url)}">Read</button></span></p>`);
    parts.push(`<p class="sheet-line">${icon('bulb', 18)}<span>${esc(c.fact.text)}${c.fact.url ? ` <button class="link-btn" data-open="${esc(c.fact.url)}">Wikipedia</button>` : ''}</span></p>`);
    const done = sheet({ title: c.name, body: parts.join(''), actions: [{ label: 'Close', value: true }] });
    document.querySelector('.sheet')?.addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) native.openUrl(b.dataset.open); });
    await done;
  };

  function render() {
    const a = alarm.status();
    const t = timeParts(a.time);
    r.time.value = a.time;
    r.timeShow.innerHTML = `${esc(t.main)}<small>${esc(t.suffix)}</small>`;
    r.slide.classList.toggle('hidden', a.armed);
    r.armedBox.classList.toggle('hidden', !a.armed);
    r.status.textContent = statusText(Date.now());
  }

  async function renderPerms() {
    if (!inApp) return;
    const st = await native.status();
    const missing = [!st.notifications && 'notifications', !st.exactAlarms && 'exactAlarm', !st.fullScreen && 'fullScreen'].filter(Boolean);
    r.permWarn.classList.toggle('hidden', !missing.length);
    if (!missing.length) return;
    const names = { notifications: 'notifications', exactAlarm: 'exact alarms', fullScreen: 'full-screen alarms' };
    r.permWarn.innerHTML = `<h3>Let me ring when I’m closed</h3><p class="small soft" style="margin-top:4px">Allow ${missing.map((m) => names[m]).join(', ')}.</p><button class="btn gold" data-fix="${missing[0]}" style="margin-top:10px">Fix now</button>`;
    r.permWarn.querySelector('[data-fix]').onclick = async (e) => {
      const which = e.target.dataset.fix;
      if (which === 'notifications') { const res = await native.requestNotifications(); if (!res.granted) native.openSettings('notifications'); }
      else native.openSettings(which);
    };
  }

  function renderRitual() {
    const n = tasks.all().length + (tasks.options().chaos ? 1 : 0);
    r.ritual.textContent = n ? plural(n, 'task') : 'Just the phrase';
  }

  // Only worth a word when it's a problem.
  function renderBattery(b = battery.get()) {
    const low = b.supported && !inApp && !b.charging && b.level <= guard.settings().armBelow;
    r.batt.classList.toggle('hidden', !low);
    if (low) r.batt.innerHTML = `${ICONS.battery(b.level, false)}${b.level}%`;
    r.batt.classList.toggle('low', low);
  }

  /* ----- arming ----- */
  async function armFlow() {
    audio.unlock();
    if (music.status().source === 'spotify') spotify.prepare();
    const check = guard.armCheck();
    if (!check.ok) {
      const choice = await sheet({
        title: `Battery at ${check.level}%`,
        body: `Not charging. At ${check.floor}% I’ll switch the alarm off to save your phone.`,
        actions: [{ label: 'I’ll plug in first', value: 'cancel', style: 'gold' }, { label: 'Arm anyway', value: 'arm' }]
      });
      if (choice !== 'arm') { resetSlide(); return; }
    }
    alarm.arm();
    vibrateTap(30);
    if (inApp) { toast(`Armed for ${fmtTime(new Date(alarm.status().armedAt))}. Sleep well.`); renderPerms(); return; }
    requestPermission();
    if (check.unknown) toast('Can’t read the battery here. Plug in to be safe.', 4000);
    else toast(`Armed for ${fmtTime(new Date(alarm.status().armedAt))}.`);
  }

  /* ----- slide to arm ----- */
  let drag = null;
  const maxX = () => r.slide.clientWidth - r.thumb.offsetWidth - 10;
  const setX = (x) => { r.thumb.style.transform = `translateX(${x}px)`; r.fill.style.width = `${x + 60}px`; };
  function resetSlide() { r.slide.classList.add('snap'); setX(0); setTimeout(() => r.slide.classList.remove('snap'), 260); }
  r.thumb.addEventListener('pointerdown', (e) => {
    drag = { start: e.clientX, x: 0 };
    r.thumb.setPointerCapture(e.pointerId);
    r.slide.classList.remove('snap');
  });
  r.thumb.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.x = Math.max(0, Math.min(maxX(), e.clientX - drag.start));
    setX(drag.x);
  });
  const endDrag = () => {
    if (!drag) return;
    const done = drag.x >= maxX() * 0.85;
    drag = null;
    if (done) { setX(maxX()); armFlow().then(() => setTimeout(() => setX(0), 300)); } else resetSlide();
  };
  r.thumb.addEventListener('pointerup', endDrag);
  r.thumb.addEventListener('pointercancel', endDrag);
  r.thumb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); armFlow(); } });

  /* ----- other controls ----- */
  r.disarm.onclick = () => { alarm.disarm(); toast('Alarm disarmed.'); };
  if (r.night) r.night.onclick = () => emit('night:open');
  r.test.onclick = () => { audio.unlock(); if (music.status().source === 'spotify') spotify.prepare(); alarm.test(); toast('Test alarm in 10 seconds.'); };
  r.time.addEventListener('change', (e) => {
    if (!e.target.value || !alarm.setTime(e.target.value)) { render(); return; }
    emit('pet:say', { text: alarmMessage(e.target.value, { streak: stats.currentStreak(), name: profile.get().name }) });
  });
  r.edit.onclick = () => tabs.show('tasks');

  on('alarm:changed', render);
  on('tasks:changed', renderRitual);
  on('battery:changed', renderBattery);
  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) { render(); renderRitual(); renderPerms(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderPerms(); });
  on('place:changed', () => { paintPlace(); paintSky(Date.now(), true); });
  on('profile:changed', () => { paintPlace(); paintSky(Date.now(), true); });
  on('tick', ({ now }) => {
    const d = new Date(now);
    const minute = Math.floor(now / 60000);
    if (minute !== lastMinute) { lastMinute = minute; paintSky(now); if (places.current()) paintPlace(); }
    // Same format as the wake-up time (12 or 24 h, from the phone), so the two never disagree.
    const t = fmtTime(d), m = t.match(/^(.*?)\s?([AaPp]\.?[Mm]\.?)$/);
    const clock = m ? `${esc(m[1])}<small>${esc(m[2])}</small>` : esc(t);
    if (r.clock.innerHTML !== clock) r.clock.innerHTML = clock;
    r.date.textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    r.status.textContent = statusText(now);
  });
  petView.mountCard(r.pet);
  recoveryView.mount(r.recovery);
  sleepView.mountCard(r.sleep);
  render();
  renderRitual();
  renderBattery();
  renderPerms();
  paintSky(Date.now(), true);
  paintPlace();
  places.refresh();
}
