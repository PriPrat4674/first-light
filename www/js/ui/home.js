// Alarm tab: clock, wake-up time, slide to arm, tomorrow's tasks.
import { on, emit } from '../core/events.js';
import { refs, esc, fmtTime, fmtDur, toast, vibrateTap } from '../core/util.js';
import { APP_NAME } from '../config.js';
import * as alarm from '../features/alarm.js';
import * as tasks from '../features/tasks.js';
import * as guard from '../features/battery-guard.js';
import * as music from '../features/music.js';
import * as spotify from '../features/sources/spotify.js';
import * as battery from '../services/battery.js';
import * as audio from '../services/audio.js';
import { requestPermission } from '../services/notify.js';
import { sunburst, setSunburst, sheet, ICONS } from './components.js';
import * as tabs from './tabs.js';
import * as native from '../services/native.js';
import * as profile from '../features/profile.js';
import * as stats from '../features/stats.js';
import { alarmMessage } from '../features/messages.js';
import * as petView from './pet-view.js';
import * as sleepView from './sleep-view.js';
import * as recoveryView from './recovery-view.js';

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
      <div class="brand">${APP_NAME}</div>
      <div class="clock" data-ref="clock">--:--</div>
      <div class="date" data-ref="date"></div>
      <div class="burst-wrap" data-ref="burst">${sunburst({ lit: 0.15, label: 'Sunrise' })}</div>
    </section>

    <div class="card alarm-card">
      <label class="time-pick">
        <span class="label">Wake at</span>
        <span class="value" data-ref="timeShow"></span>
        <input type="time" data-ref="time" aria-label="Wake-up time" required>
      </label>
      <p class="alarm-msg" data-ref="msg"></p>
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

      <div class="row between" style="margin-top:10px">
        <button class="btn quiet" data-ref="test">Try a test alarm</button>
        <span class="battery-pill hidden" data-ref="batt"></span>
      </div>
    </div>

    <div class="card notice warn hidden" data-ref="permWarn"></div>
    <div data-ref="pet"></div>
    <div class="hidden" data-ref="recovery"></div>
    <div data-ref="sleep"></div>

    <div class="card">
      <div class="card-head"><h3>Tomorrow’s ritual</h3><button class="btn quiet" data-ref="edit">Edit</button></div>
      <ol class="ritual" data-ref="ritual"></ol>
    </div>

    <div class="card notice">
      <h3>Before bed</h3>
      <p class="soft" style="margin-top:6px">${inApp
        ? `Slide to arm, then lock your phone and sleep. ${APP_NAME} rings even when it’s closed, using Android’s own alarm system, so it won’t drain your battery overnight 🔋`
        : `Arm the alarm and leave ${APP_NAME} open on its night screen. It’s pure black, which uses very little power on most phones. Plug in if you can. If the battery falls to the guard level unplugged, the alarm switches itself off so your phone survives the night.`}</p>
    </div>`;
  const r = refs(root);

  /* ----- status ----- */
  function statusText(now) {
    const a = alarm.status();
    if (a.testAt) return `Test alarm in ${fmtDur(a.testAt - now)}.`;
    if (a.armedAt) return `Armed. Rings in ${fmtDur(a.armedAt - now)}.`;
    return 'Not armed. Slide to arm before you sleep.';
  }

  function render() {
    const a = alarm.status();
    const t = timeParts(a.time);
    r.time.value = a.time;
    r.timeShow.innerHTML = `${esc(t.main)}<small>${esc(t.suffix)}</small>`;
    r.slide.classList.toggle('hidden', a.armed);
    r.armedBox.classList.toggle('hidden', !a.armed);
    r.status.textContent = statusText(Date.now());
    r.msg.textContent = alarmMessage(a.time, { date: new Date(a.armedAt || Date.now() + 12 * 3600_000), streak: stats.currentStreak(), name: profile.get().name });
    setSunburst(r.burst.querySelector('svg'), a.armed ? 1 : 0.15, a.armed);
  }

  async function renderPerms() {
    if (!inApp) return;
    const st = await native.status();
    const missing = [!st.notifications && 'notifications', !st.exactAlarms && 'exactAlarm', !st.fullScreen && 'fullScreen'].filter(Boolean);
    r.permWarn.classList.toggle('hidden', !missing.length);
    if (!missing.length) return;
    const names = { notifications: 'notifications', exactAlarm: 'exact alarms', fullScreen: 'full-screen alarms' };
    r.permWarn.innerHTML = `<h3>One quick fix ⚠️</h3><p class="small soft" style="margin-top:4px">Allow ${missing.map((m) => names[m]).join(', ')} so your alarm can ring with the app closed.</p><button class="btn gold" data-fix="${missing[0]}" style="margin-top:10px">Fix now</button>`;
    r.permWarn.querySelector('[data-fix]').onclick = async (e) => {
      const which = e.target.dataset.fix;
      if (which === 'notifications') { const res = await native.requestNotifications(); if (!res.granted) native.openSettings('notifications'); }
      else native.openSettings(which);
    };
  }

  function renderRitual() {
    const list = tasks.all();
    const chaos = tasks.options().chaos;
    r.ritual.innerHTML = list.length
      ? list.map((t, i) => `<li><span class="n">${i + 1}</span><span>${esc(t.name)}</span>${t.gapMin ? `<span class="gap">${t.gapMin} min wait</span>` : ''}</li>`).join('')
        + (chaos ? `<li class="chaos"><span class="n">${list.length + 1}</span><span class="italic">A surprise chaos task</span></li>` : '')
      : '<li class="muted italic">No tasks yet. The alarm stops as soon as you type the phrase.</li>';
  }

  function renderBattery(b = battery.get()) {
    if (!b.supported || inApp) { r.batt.classList.add('hidden'); return; }
    const low = !b.charging && b.level <= guard.settings().armBelow;
    r.batt.classList.remove('hidden');
    r.batt.classList.toggle('low', low);
    r.batt.innerHTML = `${ICONS.battery(b.level, b.charging)}${b.level}%${b.charging ? ' charging' : ''}`;
  }

  /* ----- arming ----- */
  async function armFlow() {
    audio.unlock();
    if (music.status().source === 'spotify') spotify.prepare();
    const check = guard.armCheck();
    if (!check.ok) {
      const choice = await sheet({
        title: `Battery at ${check.level}%`,
        body: `Your phone isn’t charging. Keeping the night screen on could drain it. If it reaches ${check.floor}%, the alarm turns itself off to protect your phone.`,
        actions: [{ label: 'I’ll plug in first', value: 'cancel', style: 'gold' }, { label: 'Arm anyway', value: 'arm' }]
      });
      if (choice !== 'arm') { resetSlide(); return; }
    }
    alarm.arm();
    vibrateTap(30);
    if (inApp) { toast(`Armed for ${fmtTime(new Date(alarm.status().armedAt))}. I’ll ring even if the app is closed ⏰`); renderPerms(); return; }
    requestPermission();
    if (check.unknown) toast('This browser can’t read your battery. Plug in to be safe.', 4000);
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
  r.test.onclick = () => { audio.unlock(); if (music.status().source === 'spotify') spotify.prepare(); alarm.test(); toast('A test alarm rings in 10 seconds.'); };
  r.time.addEventListener('change', (e) => { if (!e.target.value || !alarm.setTime(e.target.value)) render(); });
  r.edit.onclick = () => tabs.show('tasks');

  on('alarm:changed', render);
  on('tasks:changed', renderRitual);
  on('battery:changed', renderBattery);
  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) { render(); renderRitual(); renderPerms(); } });
  on('profile:changed', render);
  on('streak:changed', render);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderPerms(); });
  on('tick', ({ now }) => {
    const d = new Date(now);
    r.clock.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
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
}
