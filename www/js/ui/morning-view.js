// The full-screen morning: ringing, snoozed, task chain, report card. Each screen is its own function.
import { on } from '../core/events.js';
import { esc, refs, fmtTime, fmtDur, plural, vibrateTap } from '../core/util.js';
import { APP_NAME } from '../config.js';
import * as morning from '../features/morning.js';
import * as checkin from '../features/checkin.js';
import * as snooze from '../features/snooze.js';
import * as stats from '../features/stats.js';
import { grade } from '../features/report.js';
import * as audio from '../services/audio.js';
import * as camera from './camera.js';
import { sunburst, setSunburst } from './components.js';
import { petMarkup } from './pet-view.js';
import { doneMessage, greeting } from '../features/messages.js';
import * as profile from '../features/profile.js';
import * as applock from '../features/applock.js';
import * as native from '../services/native.js';

let root, r;

export function mount(el) {
  root = el;
  root.className = 'hidden';
  root.innerHTML = `
    <div class="m-top"><span>${APP_NAME}</span><span data-ref="clock"></span></div>
    <div class="m-body" data-ref="body"></div>
    <div class="m-burst" data-ref="burst">${sunburst({ lit: 0, label: 'Your sunrise' })}</div>`;
  r = refs(root);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Morning');

  on('morning:changed', render);
  on('checkin:scheduled', () => { if (morning.get()?.phase === 'tasks') render(); });
  on('checkin:passed', () => { if (morning.get()?.phase === 'tasks') render(); });
  on('tick', ({ now }) => {
    if (root.classList.contains('hidden')) return;
    r.clock.textContent = fmtTime(new Date(now));
    const ring = r.body.querySelector('[data-ring-clock]');
    if (ring) ring.textContent = fmtTime(new Date(now));
    const left = r.body.querySelector('[data-snooze-left]');
    if (left) left.textContent = fmtDur((morning.get()?.snoozeUntil || now) - now);
    updateGate(false);
  });
}

function setSky(lit, risen = false) {
  root.style.setProperty('--dawn', lit);
  setSunburst(r.burst.querySelector('svg'), lit, risen);
}

function render() {
  const m = morning.get();
  if (!m || m.phase === 'closed') { root.classList.add('hidden'); return; }
  root.classList.remove('hidden');
  r.clock.textContent = fmtTime(new Date());
  ({ ringing: ringingScreen, snoozed: snoozedScreen, tasks: tasksScreen, done: doneScreen })[m.phase]?.(m);
}

/* ---------- Ringing ---------- */
function ringingScreen(m) {
  setSky(0);
  const target = morning.phrase();
  const sn = snooze.state();
  r.body.innerHTML = `
    ${audio.isUnlocked() ? '' : '<button class="btn ox block" data-ref="tap" style="margin-top:12px">Tap to start the alarm sound</button>'}
    <div class="ring-time shake" data-ring-clock>${fmtTime(new Date())}</div>
    <p class="ring-sub">${m.escalated ? 'You missed your check-in. Round two 😤' : m.rings > 1 ? 'Snooze is over. Up you get ☀️' : `${esc(greeting(profile.get().name, new Date().getHours()))} No easy way out.`}</p>
    <div class="phrase-box">
      <p class="small soft italic">Type this to stop the alarm</p>
      <p class="phrase" data-ref="phrase" aria-label="${esc(target)}">${[...target].map((c) => `<span class="ch">${esc(c)}</span>`).join('')}</p>
      <input class="phrase-input" type="text" data-ref="input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Start typing…" aria-label="Type the phrase to stop the alarm">
      <button class="btn gold block" data-ref="stop" style="margin-top:12px">Stop alarm</button>
      ${morning.canSnooze() ? `<button class="btn quiet snooze-line" data-ref="snooze">Snooze ${snooze.settings().minutes} min · ${sn.left} left</button>` : ''}
    </div>`;
  const b = refs(r.body);
  const chars = [...b.phrase.querySelectorAll('.ch')];
  const paint = () => {
    const typed = b.input.value;
    chars.forEach((span, i) => {
      span.className = 'ch' + (i < typed.length ? (typed[i].toLowerCase() === target[i].toLowerCase() ? ' ok' : ' bad') : i === typed.length ? ' next' : '');
    });
  };
  const tryStop = () => {
    if (morning.dismiss(b.input.value)) { vibrateTap(40); return; }
    b.input.classList.remove('shake'); void b.input.offsetWidth; b.input.classList.add('shake');
    b.input.placeholder = b.input.value ? 'Not quite. Try again.' : 'Type the phrase first.';
    b.input.value = '';
    paint();
    audio.beep(220, 0.3);
  };
  paint();
  b.input.addEventListener('input', paint);
  b.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryStop(); });
  b.input.addEventListener('paste', (e) => e.preventDefault());
  b.input.addEventListener('drop', (e) => e.preventDefault());
  b.stop.onclick = tryStop;
  if (b.snooze) b.snooze.onclick = () => morning.snooze();
  if (b.tap) b.tap.onclick = () => { audio.unlock(); b.tap.remove(); morning.replaySound(); };
}

/* ---------- Snoozed ---------- */
function snoozedScreen(m) {
  setSky(0);
  r.body.innerHTML = `
    <div class="big-head">Snoozed.</div>
    <p class="ring-sub">Ringing again in</p>
    <div class="countdown" data-snooze-left>${fmtDur((m.snoozeUntil || Date.now()) - Date.now())}</div>
    <p class="soft" style="margin-top:14px">This one is in the Hall of Shame now. Forever.</p>
    <button class="btn gold block" data-ref="up" style="margin-top:auto">I’m up. Ring now so I can stop it</button>`;
  refs(r.body).up.onclick = () => snooze.endNow();
}

/* ---------- Tasks ---------- */
function tasksScreen(m) {
  const done = m.completed.length, total = m.tasks.length;
  setSky(total ? 0.12 + 0.6 * (done / total) : 0.7);
  const c = checkin.state();
  r.body.innerHTML = `
    <h2 style="margin-top:4vh;font-size:2.2rem">Prove you’re up</h2>
    <p class="ring-sub">${done} of ${total} done. The sun rises with every proof.</p>
    ${!c.passed && c.dueAt ? `<p class="small muted italic" style="margin-top:6px">Check-in at ${fmtTime(new Date(c.dueAt))}. Keep ${APP_NAME} open.</p>` : ''}
    <ol class="chain">${m.tasks.map((t, i) => {
      const state = i < done ? 'done' : i === done ? 'current' : 'later';
      const meta = i === done
        ? `<div class="t-meta">Photo must show: ${esc(t.proof)}</div><div data-gate></div>`
        : i > done && t.gapMin ? `<div class="t-meta">${t.gapMin} min after the previous task</div>` : '';
      return `<li class="${state}"><span class="dot">${i < done ? '✓' : i + 1}</span><div style="flex:1"><div class="t-name">${esc(t.name)}${t.chaos ? '<span class="tag">chaos</span>' : ''}</div>${meta}</div></li>`;
    }).join('')}</ol>
    <div style="height:38vh"></div>`;
  updateGate(true);
}

// The current task's button: a countdown while it's locked, then "Take proof photo".
function updateGate(force) {
  const gate = r.body.querySelector('[data-gate]');
  const task = morning.currentTask();
  if (!gate || !task) return;
  const wait = morning.currentUnlocksAt() - Date.now();
  const state = wait > 0 ? 'wait' : 'open';
  if (!force && state === 'open' && gate.dataset.state === 'open') return;
  gate.dataset.state = state;
  if (state === 'wait') {
    gate.innerHTML = `<button class="btn line" disabled>Unlocks in ${fmtDur(wait)}</button>`;
    return;
  }
  gate.innerHTML = '<button class="btn gold">Take proof photo</button>';
  gate.firstChild.onclick = async () => {
    if (await camera.takeProof(task)) { vibrateTap(30); morning.completeTask(task.id); }
  };
}

/* ---------- Done ---------- */
function doneScreen(m) {
  setSky(1, true);
  const g = grade(m);
  const streak = stats.currentStreak();
  r.body.innerHTML = `
    <div class="done-pet">${petMarkup(g.letter.startsWith('A') ? 'ecstatic' : g.letter.startsWith('B') ? 'happy' : 'grumpy', 110)}<span class="stamp" aria-hidden="true">${g.letter.startsWith('A') ? '⭐' : g.letter.startsWith('B') ? '👏' : '💪'}</span></div>
    <div class="big-head" style="margin-top:2vh">Morning proven.</div>
    <p class="ring-sub">${esc(doneMessage(g.letter, profile.get().name))}</p>
    <p class="small soft" style="margin-top:6px">${m.test ? 'A test run, so it doesn’t count toward your streak.' : `Streak: ${plural(streak, 'morning')} 🔥`}${!m.test && native.isNative() && applock.get().enabled ? ' · Your apps are unlocked 🔓' : ''}</p>
    <div class="cert" aria-label="Report card">
      <div class="cert-inner">
        <div class="grade">${esc(g.letter)}</div>
        <div class="line">${esc(g.line)}</div>
        <div class="facts">${plural(g.mins, 'minute')} · ${plural(g.snoozes, 'snooze')} · ${plural(g.misses, 'missed check-in')}</div>
      </div>
    </div>
    <button class="btn gold block" data-ref="close" style="margin-top:auto">Close</button>`;
  refs(r.body).close.onclick = () => morning.close();
}
