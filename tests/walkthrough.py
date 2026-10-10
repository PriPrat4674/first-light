#!/usr/bin/env python3
"""
First-time user walkthrough: installs (fresh data), goes through setup and a full first morning
in the Android-app mode, screenshotting every step into tests/walkthrough/.
Usage: python3 tests/walkthrough.py
"""
import asyncio, json, sys
from pathlib import Path
sys.argv = sys.argv[:1]
sys.path.insert(0, str(Path(__file__).parent))
import run_tests as T

OUT = Path(__file__).parent / 'walkthrough'
OUT.mkdir(exist_ok=True)
LOG = []

async def main():
    httpd = T.serve()
    async with T.async_playwright() as p:
        b = await p.chromium.launch(args=T.ARGS)
        a = T.App(b)
        n = [0]
        async def shot(title, full=False):
            n[0] += 1
            name = f'{n[0]:02d}-{title.lower().replace(" ", "-").replace("/", "")[:40]}.png'
            await a.pg.screenshot(path=str(OUT / name), full_page=full)
            LOG.append(f'{n[0]:02d}. {title} — {name}')
        pg = await a.open(onboarded=False, at=T.ms(T.ist(2026, 10, 14, 21, 0)), native={'status': {'notifications': False, 'batteryUnrestricted': False}})
        await a.tick(600)
        await shot('Setup - meet Pip')
        await pg.fill('#onboarding [data-ref=name]', 'Priya'); await shot('Setup - name typed')
        await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - logo')
        await pg.click('[data-pick=logo][data-value=crescent]'); await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - colour')
        await pg.click('[data-pick=accent][data-value=sky]'); await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - theme')
        await pg.click('[data-pick=theme][data-value=midnight]'); await a.tick(200); await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - font')
        await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - style')
        await pg.click('[data-pick=style][data-value=soft]'); await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - sleep schedule')
        await pg.fill('#onboarding [data-ref=bed]', '23:30'); await pg.dispatch_event('#onboarding [data-ref=bed]', 'change')
        await pg.click('[data-ob=next]'); await a.tick(700); await shot('Setup - Android permissions')
        await pg.click('[data-perm=notifications]'); await a.tick(1200); await shot('Setup - notifications allowed')
        await pg.click('[data-ob=next]'); await a.tick(400); await shot('Setup - all set')
        await pg.click('[data-ob=next]'); await a.tick(800); await shot('Alarm tab - first look', full=True)
        await a.tab('tasks'); await pg.click('[data-tpl="0"]'); await a.tick(300); await shot('Tasks - added Make the bed', full=True)
        await a.tab('sounds'); await pg.set_input_files('[data-ref=songInput]', [str(T.FIX / 'song-a.wav')]); await pg.wait_for_timeout(500); await shot('Sounds', full=True)
        await a.tab('settings'); await a.tick(400); await shot('Settings', full=True)
        await a.tab('alarm'); await a.arm_by_keyboard(); await a.tick(400); await shot('Armed')
        # The next morning
        await pg.clock.fast_forward(9 * 3600 * 1000); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__nativeEmit('alarm', { kind: 'wake' })"); await a.tick(600); await shot('Morning - ringing')
        p = await a.phrase(); await pg.type('#morning [data-ref=input]', p[:9] + 'x'); await shot('Morning - typing with a mistake')
        await pg.fill('#morning [data-ref=input]', p); await pg.click('#morning [data-ref=stop]'); await a.tick(400); await shot('Morning - tasks')
        await a.prove_current_task(); await a.tick(300); await shot('Morning - first task proven')
        await a.prove_current_task(); await a.tick(300)
        await pg.click('#morning [data-gate] button.gold') if await pg.query_selector('#morning [data-gate] button.gold') else None
        await a.tick(1500); await shot('Morning - camera') if await a.visible('#camera') else None
        if await a.visible('#camera'):
            await pg.click('#camera [data-act=snap]'); await a.tick(300); await pg.click('#camera [data-act=next]'); await a.tick(300)
        await a.tick(5 * 60_000 + 1000); await shot('Morning - check-in')
        if await a.visible('#checkin'): await pg.click('#checkin [data-ref=yes]'); await a.tick(400)
        await a.tick(10 * 60_000 + 1000)
        while await pg.query_selector('#morning [data-gate] button.gold'):
            await a.prove_current_task(); await a.tick(400)
        await a.tick(1500); await shot('Morning - report card')
        await pg.click('#morning [data-ref=close]'); await a.tick(400)
        await a.tab('progress'); await a.tick(300); await shot('Progress', full=True)
        await a.tab('alarm'); await a.tick(300); await shot('Alarm tab - after first morning', full=True)
        await pg.evaluate("window.__nativeEmit('locked', { pkg: 'com.instagram.android' })"); await a.tick(400); await shot('App lock reminder')
        await pg.click('.sheet [data-i="0"]'); await a.tick(200)
        # Look at another theme
        await a.js('features/profile.js', "(m.setMany({ theme: 'ivory', accent: 'rose', font: 'friendly', style: 'bold', logo: 'owl' }), true)"); await a.tick(300)
        await shot('Ivory, rose, friendly, bold', full=True)
        await a.js('features/profile.js', "(m.setMany({ theme: 'dusk', accent: 'gold', font: 'typewriter', style: 'elegant' }), true)"); await a.tick(300)
        await shot('Dusk, gold, typewriter, elegant', full=True)
        print('errors:', a.errors)
        await b.close()
    httpd.shutdown()
    (OUT / 'steps.txt').write_text('\n'.join(LOG) + '\n')
    print('\n'.join(LOG))

asyncio.run(main())
