// Settings, opened from the ☰ menu one group at a time (see drawer.js GROUPS).
// Cards: you, look, sleep, sounds, applock, perms (app) / battery + notif (web), checkin, snooze, reset, about.
import { on } from '../core/events.js';
import { refs, esc, toast } from '../core/util.js';
import { VERSION, CHECKIN_LIMITS, SNOOZE_LIMITS, BATTERY_LIMITS, SLEEP_GOAL_LIMITS } from '../config.js';
import * as checkin from '../features/checkin.js';
import * as snooze from '../features/snooze.js';
import * as guard from '../features/battery-guard.js';
import * as profile from '../features/profile.js';
import * as sleep from '../features/sleep.js';
import * as sounds from '../features/sounds.js';
import * as places from '../features/places.js';
import * as notify from '../services/notify.js';
import * as battery from '../services/battery.js';
import * as native from '../services/native.js';
import { eraseAll } from '../core/storage.js';
import { switchRow, stepperRow, wireSteppers, setStepper, sheet, seg, info } from './components.js';
import { picker, wirePickers } from './pickers.js';
import * as applockView from './applock-view.js';
import * as tabs from './tabs.js';
import { cardsFor } from './drawer.js';
import { goalNote } from './sleep-view.js';

const inApp = native.isNative();

export function mount(root) {
  let group = null;

  function build() {
    const want = cardsFor(group); // null = every card
    const show = (id) => !want || want.includes(id);
    const c = checkin.settings(), z = snooze.settings(), g = guard.settings(), p = profile.get(), sl = sleep.get(), snd = sounds.get();
    const soundChips = (purpose, list) => `<div class="chips" data-sounds="${purpose}">${list.map((x) => `<button class="chip" data-sound="${x.id}" aria-pressed="${snd[purpose] === x.id}">${x.emoji} ${esc(x.label)}</button>`).join('')}</div>`;
    const cards = {
      you: `<div class="card" data-group="you">
        <label class="field"><span>Your name</span><input type="text" data-ref="name" maxlength="24" value="${esc(p.name)}" placeholder="What should Pip call you?"></label>
        <label class="field" style="margin-top:8px"><span>Your cub’s name</span><input type="text" data-ref="petName" maxlength="24" value="${esc(p.petName)}"></label>
      </div>`,
      look: `<div class="card" data-group="look">
        <p class="label-line">Logo</p>${picker('logo')}
        <p class="label-line">Colour</p>${picker('accent')}
        <p class="label-line">Theme</p>${picker('theme')}
        <p class="label-line">Font</p>${picker('font')}
        <p class="label-line">Style</p>${picker('style')}
      </div>`,
      sleep: `<div class="card" data-group="sleep">
        <label class="time-pick"><span class="label">Bedtime</span><span class="value small-time" data-ref="bedShow">${sl.schedule.bed}</span><input type="time" data-ref="bed" value="${sl.schedule.bed}"></label>
        <label class="time-pick" style="margin-top:6px"><span class="label">Wake-up</span><span class="value small-time" data-ref="wakeShow">${sl.schedule.wake}</span><input type="time" data-ref="wake" value="${sl.schedule.wake}"></label>
        ${stepperRow({ key: 'goal', title: 'Sleep goal', value: sl.schedule.goal, min: SLEEP_GOAL_LIMITS[0], max: SLEEP_GOAL_LIMITS[1], step: 0.5, unit: ' h' })}
        <p class="small soft goal-note" data-ref="goalNote">${esc(goalNote(sl.schedule.goal))}</p>
        ${switchRow({ key: 'prompts', title: 'Bedtime nudge', checked: sl.prompts })}
        <p class="label-line">“Drifting off?” check ${info('Drifting off?', 'Thirty minutes after you say you’re going to sleep, I check in quietly. If you’re still awake, tap it and I’ll move your bedtime.')}</p>
        ${seg('asleep', [{ value: 'warm', label: 'Warm chime' }, { value: 'silent', label: 'Silent' }, { value: 'off', label: 'Off' }], sl.asleepCheck)}
      </div>`,
      sounds: `<div class="card" data-group="sounds">
        <p class="label-line">Alarm ${info('Alarm sound', 'Plays when you haven’t added your own songs, or if your music can’t start.')}</p>${soundChips('alarm', sounds.ALARM_SOUNDS)}
        <p class="label-line">Check-in</p>${soundChips('checkin', sounds.SHORT_SOUNDS)}
        <p class="label-line">Nudges</p>${soundChips('message', sounds.SHORT_SOUNDS)}
      </div>`,
      applock: '<div class="card" data-group="applock"></div>',
      perms: inApp ? '<div class="card" data-group="perms"><div data-ref="perms"><p class="muted italic">Checking…</p></div></div>' : '',
      snooze: `<div class="card" data-group="snooze">
        <h3>Snooze ${info('Snooze', 'Every snooze goes in your Hall of Shame and makes Pip grumpy.')}</h3>
        ${switchRow({ key: 'enabled', title: 'Allow snooze', checked: z.enabled })}
        ${stepperRow({ key: 'minutes', title: 'Length', value: z.minutes, min: SNOOZE_LIMITS.minutes[0], max: SNOOZE_LIMITS.minutes[1], unit: ' min' })}
        ${stepperRow({ key: 'max', title: 'Per morning', value: z.max, min: SNOOZE_LIMITS.max[0], max: SNOOZE_LIMITS.max[1] })}
      </div>`,
      checkin: `<div class="card" data-group="checkin">
        <h3>Check-in ${info('Check-in', 'A “Still up?” after you stop the alarm. Miss it and the alarm comes back.')}</h3>
        ${stepperRow({ key: 'delayMin', title: 'Ask after', value: c.delayMin, min: CHECKIN_LIMITS.delayMin[0], max: CHECKIN_LIMITS.delayMin[1], unit: ' min' })}
        ${stepperRow({ key: 'windowSec', title: 'Time to answer', value: c.windowSec, min: CHECKIN_LIMITS.windowSec[0], max: CHECKIN_LIMITS.windowSec[1], step: 15, unit: ' s' })}
      </div>`,
      battery: inApp ? '' : `<div class="card" data-group="battery">
        <h3>Battery guard ${info('Battery guard', 'Warns before arming on low battery, and switches the alarm off before your phone dies.')}</h3>
        <p class="small soft" data-ref="battNow"></p>
        ${switchRow({ key: 'enabled', title: 'Protect my battery', checked: g.enabled })}
        ${stepperRow({ key: 'armBelow', title: 'Warn below', value: g.armBelow, min: BATTERY_LIMITS.armBelow[0], max: BATTERY_LIMITS.armBelow[1], step: 5, unit: '%' })}
        ${stepperRow({ key: 'floor', title: 'Switch off at', value: g.floor, min: BATTERY_LIMITS.floor[0], max: BATTERY_LIMITS.floor[1], step: 5, unit: '%' })}
      </div>`,
      notif: inApp ? '' : `<div class="card" data-group="notif">
        <h3>Alerts ${info('Alerts', 'Lets the check-in reach you if you’ve switched to another app.')}</h3>
        <button class="btn line" data-ref="notif" style="margin-top:12px"></button>
      </div>`,
      reset: `<div class="card" data-group="reset">
        <p class="soft">Wipes everything on this phone and starts fresh.</p>
        <button class="btn ox" data-ref="reset" style="margin-top:12px">Erase all data</button>
      </div>`,
      about: `<div class="card" data-group="about">
        <p><strong>First Light ${VERSION}</strong> <span class="muted">${inApp ? '· Android app' : '· web'}</span></p>
        <p class="small soft" style="margin-top:8px">${esc(places.CREDITS)}.</p>
        <p class="small soft" style="margin-top:6px">Spotify and YouTube are trademarks of their owners and are used only to link to their content.</p>
        <p class="small soft" style="margin-top:6px">Fonts under the SIL Open Font License.</p>
      </div>`
    };
    const order = ['you', 'look', 'sleep', 'sounds', 'applock', 'perms', 'snooze', 'checkin', 'battery', 'notif', 'reset', 'about'];
    root.innerHTML = `
      <header class="page-head"><button class="btn quiet back-link" data-ref="back">← Back</button>${group ? '' : '<h1>Settings</h1>'}</header>
      ${order.filter(show).map((k) => cards[k]).join('')}`;
    const r = refs(root);
    const card = (n) => root.querySelector(`[data-group="${n}"]`);
    r.back.onclick = () => tabs.back();

    if (card('you')) {
      r.name.onchange = () => { r.name.value = profile.set('name', r.name.value); toast('Saved.'); };
      r.petName.onchange = () => { r.petName.value = profile.set('petName', r.petName.value); toast(`Say hi to ${r.petName.value} 🐯`); };
    }
    // Look & feel: rebuild after theme/colour changes so previews use the new palette.
    if (card('look')) wirePickers(card('look'), (kind) => { if (kind === 'theme' || kind === 'accent') { const y = window.scrollY; build(); window.scrollTo(0, y); } });
    if (card('sleep')) {
      r.bed.onchange = () => { r.bedShow.textContent = sleep.setSchedule({ bed: r.bed.value }).bed; };
      r.wake.onchange = () => { r.wakeShow.textContent = sleep.setSchedule({ wake: r.wake.value }).wake; };
      wireSteppers(card('sleep'), (k, v) => { const goal = sleep.setSchedule({ goal: v }).goal; r.goalNote.textContent = goalNote(goal); return goal; });
      card('sleep').addEventListener('change', (e) => { if (e.target.dataset.switch === 'prompts') sleep.setOption('prompts', e.target.checked); });
      card('sleep').querySelector('[data-seg="asleep"]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-value]');
        if (!b) return;
        sleep.setOption('asleepCheck', b.dataset.value);
        b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
    }
    if (card('sounds')) card('sounds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sound]');
      if (!b) return;
      const purpose = b.closest('[data-sounds]').dataset.sounds;
      sounds.set(purpose, b.dataset.sound);
      sounds.preview(b.dataset.sound);
      b.parentElement.querySelectorAll('[data-sound]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    if (card('applock')) applockView.mountPanel(card('applock'));
    if (card('perms')) paintPerms(r.perms);
    if (card('checkin')) wireSteppers(card('checkin'), (k, v) => checkin.setSetting(k, v));
    if (card('snooze')) {
      wireSteppers(card('snooze'), (k, v) => snooze.setSetting(k, v));
      card('snooze').addEventListener('change', (e) => { if (e.target.dataset.switch) snooze.setSetting('enabled', e.target.checked); });
    }
    if (card('battery')) {
      const battGroup = card('battery');
      wireSteppers(battGroup, (k, v) => {
        const saved = guard.setSetting(k, v);
        const g2 = guard.settings();
        setStepper(battGroup, 'armBelow', g2.armBelow);
        setStepper(battGroup, 'floor', g2.floor);
        return saved;
      });
      battGroup.addEventListener('change', (e) => { if (e.target.dataset.switch) guard.setSetting('enabled', e.target.checked); });
      paintBattery();
    }
    if (card('notif')) {
      const paintNotif = () => {
        const n = notify.permission();
        r.notif.textContent = n === 'unsupported' ? 'Not supported here' : n === 'granted' ? 'Alerts allowed ✓' : n === 'denied' ? 'Blocked in browser settings' : 'Allow alerts';
        r.notif.disabled = n !== 'default';
      };
      paintNotif();
      r.notif.onclick = async () => { await notify.requestPermission(); paintNotif(); };
    }
    if (card('reset')) r.reset.onclick = async () => {
      const ok = await sheet({ title: 'Erase everything?', body: 'Tasks, songs, clips, sleep log, streaks and settings. This can’t be undone.', actions: [{ label: 'Erase all data', value: true, style: 'ox' }, { label: 'Keep my data', value: false }] });
      if (!ok) return;
      await eraseAll();
      location.reload();
    };
  }

  async function paintPerms(box) {
    const st = await native.status();
    const row = (ok, title, which) => `<div class="perm ${ok ? 'ok' : ''}"><span class="perm-dot">${ok ? '✓' : '!'}</span><span class="grow"><strong>${title}</strong></span>${ok ? '' : `<button class="btn line" data-perm="${which}">Allow</button>`}</div>`;
    box.innerHTML = row(st.notifications, 'Nudge you', 'notifications')
      + row(st.exactAlarms, 'Ring on time', 'exactAlarm')
      + row(st.fullScreen, 'Wake your screen', 'fullScreen')
      + row(st.batteryUnrestricted, 'Stay awake overnight', 'battery');
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
    el.textContent = b.supported ? `Battery now: ${b.level}%${b.charging ? ', charging' : ''}.` : 'Can’t read your battery here. Plug in overnight.';
  }

  on('battery:changed', paintBattery);
  on('tab:shown', ({ tab, group: gr }) => { if (tab === root.dataset.tab) { group = gr; build(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !root.classList.contains('hidden') && inApp) { const box = root.querySelector('[data-ref="perms"]'); if (box) paintPerms(box); }
  });
}
