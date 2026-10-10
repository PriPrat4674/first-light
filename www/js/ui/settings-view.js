// Settings tab: you, look & feel, sleep, sounds, app lock, check-in, snooze, battery, permissions, erase.
import { on } from '../core/events.js';
import { refs, esc, toast } from '../core/util.js';
import { VERSION, CHECKIN_LIMITS, SNOOZE_LIMITS, BATTERY_LIMITS } from '../config.js';
import * as checkin from '../features/checkin.js';
import * as snooze from '../features/snooze.js';
import * as guard from '../features/battery-guard.js';
import * as profile from '../features/profile.js';
import * as sleep from '../features/sleep.js';
import * as sounds from '../features/sounds.js';
import * as notify from '../services/notify.js';
import * as battery from '../services/battery.js';
import * as native from '../services/native.js';
import { eraseAll } from '../core/storage.js';
import { switchRow, stepperRow, wireSteppers, setStepper, sheet, seg } from './components.js';
import { picker, wirePickers } from './pickers.js';
import * as applockView from './applock-view.js';

const inApp = native.isNative();

export function mount(root) {
  function build() {
    const c = checkin.settings(), z = snooze.settings(), g = guard.settings(), p = profile.get(), sl = sleep.get(), snd = sounds.get();
    const soundChips = (purpose, list) => `<div class="chips" data-sounds="${purpose}">${list.map((x) => `<button class="chip" data-sound="${x.id}" aria-pressed="${snd[purpose] === x.id}">${x.emoji} ${esc(x.label)}</button>`).join('')}</div>`;
    root.innerHTML = `
      <header class="screen-head"><h1>Settings</h1><p>Make it yours${p.name ? `, ${esc(p.name)}` : ''} ✨</p></header>

      <div class="card" data-group="you">
        <h3>You</h3>
        <label class="field" style="margin-top:8px"><span>Your name</span><input type="text" data-ref="name" maxlength="24" value="${esc(p.name)}" placeholder="What should Pip call you?"></label>
        <label class="field" style="margin-top:8px"><span>Your owl’s name</span><input type="text" data-ref="petName" maxlength="24" value="${esc(p.petName)}"></label>
      </div>

      <div class="card" data-group="look">
        <h3>Look & feel</h3>
        <p class="label-line">Logo</p>${picker('logo')}
        <p class="label-line">Colour</p>${picker('accent')}
        <p class="label-line">Theme</p>${picker('theme')}
        <p class="label-line">Font</p>${picker('font')}
        <p class="label-line">Style</p>${picker('style')}
      </div>

      <div class="card" data-group="sleep">
        <h3>Sleep 🌙</h3>
        <label class="time-pick"><span class="label">Bedtime</span><span class="value small-time" data-ref="bedShow">${sl.schedule.bed}</span><input type="time" data-ref="bed" value="${sl.schedule.bed}"></label>
        <label class="time-pick" style="margin-top:6px"><span class="label">Usual wake-up</span><span class="value small-time" data-ref="wakeShow">${sl.schedule.wake}</span><input type="time" data-ref="wake" value="${sl.schedule.wake}"></label>
        ${stepperRow({ key: 'goal', title: 'Sleep goal', desc: '7–9 h recommended for 18–25s', value: sl.schedule.goal, min: 6, max: 10, step: 0.5, unit: ' h' })}
        ${switchRow({ key: 'prompts', title: 'Bedtime nudge', desc: inApp ? 'A notification at bedtime with “Going to sleep / In 30 min”.' : 'A prompt at bedtime while the app is open.', checked: sl.prompts })}
        <p class="label-line">“Still awake?” check, 30 min later</p>
        ${seg('asleep', [{ value: 'warm', label: 'Warm chime' }, { value: 'silent', label: 'Silent' }, { value: 'off', label: 'Off' }], sl.asleepCheck)}
      </div>

      <div class="card" data-group="sounds">
        <h3>Sounds 🎶</h3>
        <p class="label-line">Alarm sound (when you haven’t added songs)</p>${soundChips('alarm', sounds.ALARM_SOUNDS)}
        <p class="label-line">Check-in</p>${soundChips('checkin', sounds.SHORT_SOUNDS)}
        <p class="label-line">Messages & bedtime nudges</p>${soundChips('message', sounds.SHORT_SOUNDS)}
        <p class="small muted italic" style="margin-top:8px">Tap a sound to hear it.</p>
      </div>

      <div class="card" data-group="applock"></div>

      ${inApp ? '<div class="card" data-group="perms"><h3>Android permissions</h3><div data-ref="perms"><p class="muted italic">Checking…</p></div></div>' : ''}

      <div class="card" data-group="checkin">
        <h3>Check-in</h3>
        <p class="soft">A “Still up?” prompt after you stop the alarm. Miss it and the alarm rings again.</p>
        ${stepperRow({ key: 'delayMin', title: 'Ask after', value: c.delayMin, min: CHECKIN_LIMITS.delayMin[0], max: CHECKIN_LIMITS.delayMin[1], unit: ' min' })}
        ${stepperRow({ key: 'windowSec', title: 'Time to answer', value: c.windowSec, min: CHECKIN_LIMITS.windowSec[0], max: CHECKIN_LIMITS.windowSec[1], step: 15, unit: ' s' })}
      </div>
      <div class="card" data-group="snooze">
        <h3>Snooze</h3>
        ${switchRow({ key: 'enabled', title: 'Allow snooze', desc: 'Every snooze goes in the Hall of Shame and makes Pip grumpy.', checked: z.enabled })}
        ${stepperRow({ key: 'minutes', title: 'Snooze length', value: z.minutes, min: SNOOZE_LIMITS.minutes[0], max: SNOOZE_LIMITS.minutes[1], unit: ' min' })}
        ${stepperRow({ key: 'max', title: 'Snoozes per morning', value: z.max, min: SNOOZE_LIMITS.max[0], max: SNOOZE_LIMITS.max[1] })}
      </div>
      ${inApp ? '' : `
      <div class="card" data-group="battery">
        <h3>Battery guard</h3>
        <p class="soft" data-ref="battNow"></p>
        ${switchRow({ key: 'enabled', title: 'Protect my battery', desc: 'Warns before arming on low battery, and switches the alarm off before your phone dies.', checked: g.enabled })}
        ${stepperRow({ key: 'armBelow', title: 'Warn when arming below', value: g.armBelow, min: BATTERY_LIMITS.armBelow[0], max: BATTERY_LIMITS.armBelow[1], step: 5, unit: '%' })}
        ${stepperRow({ key: 'floor', title: 'Switch off at', value: g.floor, min: BATTERY_LIMITS.floor[0], max: BATTERY_LIMITS.floor[1], step: 5, unit: '%' })}
      </div>
      <div class="card">
        <h3>Notifications</h3>
        <p class="soft">Shows the check-in if you’ve switched to another app.</p>
        <button class="btn line" data-ref="notif" style="margin-top:12px"></button>
      </div>`}
      <div class="card">
        <h3>Start over</h3>
        <p class="soft">Erases tasks, songs, clips, sleep log, streaks and settings on this phone.</p>
        <button class="btn ox" data-ref="reset" style="margin-top:12px">Erase all data</button>
      </div>
      <p class="small muted italic" style="text-align:center;margin-top:22px">First Light ${VERSION} ${inApp ? '· Android app' : '· web'}</p>`;
    const r = refs(root);
    const group = (n) => root.querySelector(`[data-group="${n}"]`);

    // You
    r.name.onchange = () => { r.name.value = profile.set('name', r.name.value); toast('Saved.'); };
    r.petName.onchange = () => { r.petName.value = profile.set('petName', r.petName.value); toast(`Say hi to ${r.petName.value} 🦉`); };
    // Look & feel: rebuild after theme/colour changes so previews use the new palette.
    wirePickers(group('look'), (kind) => { if (kind === 'theme' || kind === 'accent') { const y = window.scrollY; build(); window.scrollTo(0, y); } });
    // Sleep
    r.bed.onchange = () => { r.bedShow.textContent = sleep.setSchedule({ bed: r.bed.value }).bed; };
    r.wake.onchange = () => { r.wakeShow.textContent = sleep.setSchedule({ wake: r.wake.value }).wake; };
    wireSteppers(group('sleep'), (k, v) => sleep.setSchedule({ goal: v }).goal);
    group('sleep').addEventListener('change', (e) => { if (e.target.dataset.switch === 'prompts') sleep.setOption('prompts', e.target.checked); });
    group('sleep').querySelector('[data-seg="asleep"]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-value]');
      if (!b) return;
      sleep.setOption('asleepCheck', b.dataset.value);
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    // Sounds
    group('sounds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sound]');
      if (!b) return;
      const purpose = b.closest('[data-sounds]').dataset.sounds;
      sounds.set(purpose, b.dataset.sound);
      sounds.preview(b.dataset.sound);
      b.parentElement.querySelectorAll('[data-sound]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    applockView.mountPanel(group('applock'));
    if (inApp) paintPerms(r.perms);
    // Check-in, snooze
    wireSteppers(group('checkin'), (k, v) => checkin.setSetting(k, v));
    wireSteppers(group('snooze'), (k, v) => snooze.setSetting(k, v));
    group('snooze').addEventListener('change', (e) => { if (e.target.dataset.switch) snooze.setSetting('enabled', e.target.checked); });
    // Web-only: battery guard + notifications
    if (!inApp) {
      const battGroup = group('battery');
      wireSteppers(battGroup, (k, v) => {
        const saved = guard.setSetting(k, v);
        const g2 = guard.settings();
        setStepper(battGroup, 'armBelow', g2.armBelow);
        setStepper(battGroup, 'floor', g2.floor);
        return saved;
      });
      battGroup.addEventListener('change', (e) => { if (e.target.dataset.switch) guard.setSetting('enabled', e.target.checked); });
      const paintNotif = () => {
        const n = notify.permission();
        r.notif.textContent = n === 'unsupported' ? 'Not supported here' : n === 'granted' ? 'Notifications allowed' : n === 'denied' ? 'Blocked in browser settings' : 'Allow notifications';
        r.notif.disabled = n !== 'default';
      };
      paintNotif();
      r.notif.onclick = async () => { await notify.requestPermission(); paintNotif(); };
      paintBattery();
    }
    r.reset.onclick = async () => {
      const ok = await sheet({ title: 'Erase everything?', body: 'Tasks, songs, clips, voice note, sleep log, streaks and settings will be deleted from this phone. This can’t be undone.', actions: [{ label: 'Erase all data', value: true, style: 'ox' }, { label: 'Keep my data', value: false }] });
      if (!ok) return;
      await eraseAll();
      location.reload();
    };
  }

  async function paintPerms(box) {
    const st = await native.status();
    const row = (ok, title, desc, which) => `<div class="perm ${ok ? 'ok' : ''}"><span class="perm-dot">${ok ? '✓' : '!'}</span><span class="grow"><strong>${title}</strong><small>${desc}</small></span>${ok ? '' : `<button class="btn line" data-perm="${which}">Fix</button>`}</div>`;
    box.innerHTML = row(st.notifications, 'Notifications', 'Bedtime nudges and check-ins', 'notifications')
      + row(st.exactAlarms, 'Alarms & reminders', 'Ring at the exact minute', 'exactAlarm')
      + row(st.fullScreen, 'Full-screen alarm', 'Show over the lock screen', 'fullScreen')
      + row(st.batteryUnrestricted, 'Unrestricted battery', 'Stops some phones delaying alarms', 'battery');
    box.onclick = async (e) => {
      const b = e.target.closest('[data-perm]');
      if (!b) return;
      if (b.dataset.perm === 'notifications') { const res = await native.requestNotifications(); if (!res.granted) native.openSettings('notifications'); }
      else native.openSettings(b.dataset.perm);
    };
  }

  function paintBattery() {
    const el = root.querySelector('[data-ref="battNow"]');
    if (!el) return;
    const b = battery.get();
    el.textContent = b.supported ? `Battery now: ${b.level}%${b.charging ? ', charging' : ''}.` : 'This browser can’t read your battery (iPhones can’t). Plug in overnight to be safe.';
  }

  on('battery:changed', paintBattery);
  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) build(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !root.classList.contains('hidden') && inApp) { const box = root.querySelector('[data-ref="perms"]'); if (box) paintPerms(box); }
  });
}
