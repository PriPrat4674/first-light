// First-run setup: name → logo → colour → theme → font → style → sleep → (app) permissions → done.
// Every choice applies instantly, so the setup screen restyles itself as you go.
import { esc, refs, toast, vibrateTap } from '../core/util.js';
import * as profile from '../features/profile.js';
import * as sleep from '../features/sleep.js';
import * as alarm from '../features/alarm.js';
import * as native from '../services/native.js';
import { picker, wirePickers } from './pickers.js';
import { stepperRow, wireSteppers } from './components.js';
import { petMarkup } from './pet-view.js';
import { logoSVG } from './art.js';
import { artColours } from './theme.js';

const STEPS = ['name', 'logo', 'accent', 'theme', 'font', 'style', 'sleep', ...(native.isNative() ? ['permissions'] : []), 'done'];

const TITLES = {
  logo: ['Pick your logo', 'It’s what you’ll tap every night. Pick the one that feels like yours.'],
  accent: ['Choose a colour', 'Your accent for buttons, highlights and the sunrise.'],
  theme: ['Choose a theme', 'Noir is pure black, the kindest to your battery on most phones.'],
  font: ['Choose a font', 'How your clock and words look.'],
  style: ['Choose a style', 'The shape and feel of buttons and cards.']
};

export function run() {
  return new Promise((resolve) => {
    let i = 0;
    const el = document.createElement('div');
    el.id = 'onboarding';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Set up First Light');
    document.body.appendChild(el);

    function nav(nextLabel = 'Next', { canSkip = false } = {}) {
      return `<div class="ob-nav">
        ${i > 0 ? '<button class="btn quiet" data-ob="back">Back</button>' : '<span></span>'}
        <div class="row">${canSkip ? '<button class="btn quiet" data-ob="skip">Skip</button>' : ''}<button class="btn gold" data-ob="next">${nextLabel}</button></div>
      </div>`;
    }
    const dots = () => `<div class="ob-dots" aria-label="Step ${i + 1} of ${STEPS.length}">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'past' : ''}"></i>`).join('')}</div>`;

    function render() {
      const step = STEPS[i];
      const p = profile.get();
      let body = '';
      if (step === 'name') {
        body = `
          <div class="ob-hero">${petMarkup('happy', 120)}</div>
          <h1>Hi! I’m ${esc(p.petName)} 🦉</h1>
          <p class="soft">I’ll get you out of bed and keep you out. First, what should I call you?</p>
          <label class="field" style="margin-top:18px"><span>Your name</span><input type="text" data-ref="name" maxlength="24" autocomplete="given-name" value="${esc(p.name)}" placeholder="e.g. Priya"></label>
          ${nav('Next', { canSkip: true })}`;
      } else if (TITLES[step]) {
        const [t, sub] = TITLES[step];
        body = `<h1>${t}</h1><p class="soft">${sub}</p><div class="ob-picker">${picker(step)}</div>
          ${step === 'logo' ? '<p class="small muted italic" style="margin-top:10px">In the Android app, your home-screen icon changes too.</p>' : ''}
          ${nav()}`;
      } else if (step === 'sleep') {
        const sc = sleep.get().schedule;
        body = `<h1>Your sleep schedule</h1><p class="soft">I’ll nudge you at bedtime and track how long you sleep. No smartwatch needed 🌙</p>
          <div class="card" data-sleep>
            <label class="time-pick"><span class="label">I usually sleep at</span><span class="value small-time" data-ref="bedShow">${esc(sc.bed)}</span><input type="time" data-ref="bed" value="${sc.bed}"></label>
            <label class="time-pick" style="margin-top:8px"><span class="label">and wake at</span><span class="value small-time" data-ref="wakeShow">${esc(sc.wake)}</span><input type="time" data-ref="wake" value="${sc.wake}"></label>
            ${stepperRow({ key: 'goal', title: 'Sleep goal', desc: '7–9 hours is recommended for 18–25s', value: sc.goal, min: 6, max: 10, step: 0.5, unit: ' h' })}
          </div>
          ${nav()}`;
      } else if (step === 'permissions') {
        body = `<h1>Let me ring with the app closed</h1><p class="soft">Android needs a few permissions so your alarm works even when your phone is locked.</p>
          <div class="card" data-ref="perms"><p class="muted italic">Checking…</p></div>
          ${nav('Next', { canSkip: true })}`;
      } else if (step === 'done') {
        const c = artColours(p);
        body = `<div class="ob-hero">${petMarkup('ecstatic', 140)}</div>
          <h1>All set${p.name ? `, ${esc(p.name)}` : ''}! 🎉</h1>
          <p class="soft">Your alarm is set for ${esc(sleep.get().schedule.wake)}. Arm it tonight, and I’ll see you in the morning ☀️</p>
          <div class="ob-icon">${logoSVG(p.logo, c, { size: 76 })}<span class="small muted">Your icon</span></div>
          ${nav('Let’s go')}`;
      }
      el.innerHTML = `<div class="ob-inner">${dots()}<div class="ob-step" data-step="${step}">${body}</div></div>`;
      wire(step);
    }

    function wire(step) {
      const r = refs(el);
      if (r.name) { r.name.focus(); r.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(1); }); }
      if (TITLES[step]) wirePickers(el.querySelector('.ob-picker'), () => { if (step === 'theme' || step === 'accent') render(); });
      if (step === 'sleep') {
        const box = el.querySelector('[data-sleep]');
        r.bed.onchange = () => { const v = sleep.setSchedule({ bed: r.bed.value }); r.bedShow.textContent = v.bed; };
        r.wake.onchange = () => { const v = sleep.setSchedule({ wake: r.wake.value }); r.wakeShow.textContent = v.wake; };
        wireSteppers(box, (k, v) => sleep.setSchedule({ goal: v }).goal);
      }
      if (step === 'permissions') paintPerms(r.perms);
      el.querySelector('[data-ob="back"]')?.addEventListener('click', () => go(-1));
      el.querySelector('[data-ob="skip"]')?.addEventListener('click', () => go(1, true));
      el.querySelector('[data-ob="next"]').addEventListener('click', () => go(1));
    }

    async function paintPerms(box) {
      const st = await native.status();
      const row = (ok, title, desc, which) => `<div class="perm ${ok ? 'ok' : ''}"><span class="perm-dot">${ok ? '✓' : '!'}</span><span class="grow"><strong>${title}</strong><small>${desc}</small></span>${ok ? '' : `<button class="btn line" data-perm="${which}">Allow</button>`}</div>`;
      box.innerHTML = [
        row(st.notifications, 'Notifications', 'Bedtime nudges and check-ins', 'notifications'),
        row(st.exactAlarms, 'Alarms & reminders', 'Ring at the exact minute', 'exactAlarm'),
        row(st.fullScreen, 'Full-screen alarm', 'Show the alarm over your lock screen', 'fullScreen'),
        row(st.batteryUnrestricted, 'Unrestricted battery', 'Stops some phones from delaying alarms', 'battery')
      ].join('');
      box.onclick = async (e) => {
        const b = e.target.closest('[data-perm]');
        if (!b) return;
        if (b.dataset.perm === 'notifications') {
          const res = await native.requestNotifications();
          if (!res.granted) await native.openSettings('notifications');
        } else await native.openSettings(b.dataset.perm);
        setTimeout(() => paintPerms(box), 800);
      };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.body.contains(box)) paintPerms(box); }, { once: true });
    }

    function go(dir, skipped = false) {
      const step = STEPS[i];
      if (step === 'name' && dir > 0) profile.set('name', skipped ? '' : refs(el).name.value);
      if (step === 'sleep' && dir > 0) alarm.setTime(sleep.get().schedule.wake);
      vibrateTap();
      if (step === 'done' && dir > 0) {
        profile.set('onboarded', true);
        el.classList.add('leaving');
        setTimeout(() => { el.remove(); resolve(); }, 300);
        return;
      }
      i = Math.max(0, Math.min(STEPS.length - 1, i + dir));
      render();
      el.scrollTo(0, 0);
    }

    render();
  });
}
