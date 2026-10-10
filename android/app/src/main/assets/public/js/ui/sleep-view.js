// Sleep on screen: the Alarm-tab card (last night, this week, Sunday sleep-in),
// the bedtime prompts, and the weekly chart on the Progress tab.
import { on } from '../core/events.js';
import { esc, refs, toast, dayKey, fmtTime } from '../core/util.js';
import * as sleep from '../features/sleep.js';
import * as alarm from '../features/alarm.js';
import * as profile from '../features/profile.js';
import * as sounds from '../features/sounds.js';
import * as native from '../services/native.js';
import { sheet } from './components.js';
import { NAP_PRESETS, NAP_LIMITS } from '../config.js';
import { petMarkup } from './pet-view.js';

const hm = (ts) => fmtTime(new Date(ts));
const fmtNap = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${Math.round(h * 10) / 10} h`);

// A short, kind line under the sleep goal.
export function goalNote(goal) {
  if (goal < 5) return 'That’s a tough schedule. I’ll help you through it 💛';
  if (goal < 7) return 'A little under the 7–9 h most people need. We’ll make it work 🌙';
  if (goal <= 9) return 'Right in the healthy range ✨';
  return 'Plenty of rest. Lovely 😌';
}

export function weekChart(w = sleep.week()) {
  if (!w.count) return '<p class="empty-note">No sleep logged yet. Tap “Going to sleep” tonight 🌙</p>';
  const max = Math.max(10, w.goal + 1, ...w.nights.map((n) => n.total));
  const bars = w.nights.map((n) => {
    const c = sleep.classify(n.total, w.goal);
    const day = new Date(`${n.date}T12:00`).toLocaleDateString([], { weekday: 'short' });
    const napPart = n.nap ? `<em class="nap-part" style="height:${Math.round((n.nap / n.total) * 100)}%"></em>` : '';
    return `<div class="bar ${c.key}" title="${esc(day)}: ${n.total} h${n.nap ? ` incl. ${fmtNap(n.nap)} nap` : ''}"><span style="height:${Math.round((n.total / max) * 100)}%">${napPart}<b>${n.total}</b></span><i>${esc(day)}</i></div>`;
  }).join('');
  return `<div class="sleep-chart" role="img" aria-label="Sleep this week, average ${w.average} hours">
    <div class="goal-line" style="bottom:calc(${Math.round((w.goal / max) * 100)}% + 22px)"><em>${w.goal} h goal</em></div>${bars}</div>
    ${w.nights.some((n) => n.nap) ? '<p class="small muted legend-nap"><i></i>Naps</p>' : ''}`;
}

function sundayKey(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return dayKey(d);
}
function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function mountCard(el) {
  el.classList.add('card', 'sleep-card');
  function render() {
    const s = sleep.get();
    const nap = sleep.napState();
    const last = sleep.lastNight();
    const c = last ? sleep.classify(last.hours) : null;
    const napToday = sleep.todayNapHours();
    const advice = sleep.sundayAdvice();
    const sun = sundayKey();
    const override = alarm.status().overrides?.[sun];
    let body;
    const cub = `<span class="sleep-cub" aria-hidden="true">${petMarkup('sleeping', 64)}</span>`;
    if (nap) body = `${cub}<p class="soft">Napping till ${hm(nap.endAt)} 💤</p><button class="btn line block" data-ref="wakeNap" style="margin-top:12px">I’m up</button>`;
    else if (s.pending.bedAt) body = `${cub}<p class="soft">Asleep since ${hm(s.pending.bedAt)} 💤</p><button class="btn quiet" data-ref="cancel">Not asleep after all</button>`;
    else body = `${last ? `<div class="sleep-last ${c.key}"><span class="big-emoji" aria-hidden="true">${c.emoji}</span><div><strong>${c.label}</strong><p class="small soft">${last.hours} h · ${hm(last.bedAt)} → ${hm(last.wakeAt)}</p></div></div>` : ''}
      ${napToday ? `<p class="small soft" style="margin-top:6px">+ ${fmtNap(napToday)} nap today 😴</p>` : ''}
      <button class="btn line block" data-ref="now" style="margin-top:12px">Going to sleep 😴</button>`;
    el.innerHTML = `
      <div class="card-head"><h3>Sleep</h3><span class="small muted">${s.schedule.bed} – ${s.schedule.wake}</span></div>
      ${body}
      ${advice && !nap ? `<div class="notice card" style="margin-top:12px">
          <strong>Sunday sleep-in 🛌</strong>
          <p class="small soft" style="margin-top:4px">Short week. Sleep in ${advice.minutes} min on Sunday${override ? ` (alarm at ${override})` : ''}, not till noon.</p>
          ${override ? '<button class="btn quiet" data-ref="undo">Keep my usual time</button>' : `<button class="btn gold" data-ref="sleepin" style="margin-top:10px">Move Sunday’s alarm ${advice.minutes} min</button>`}
        </div>` : ''}`;
    const r = refs(el);
    if (r.now) r.now.onclick = () => goingToSleepFlow();
    if (r.wakeNap) r.wakeNap.onclick = () => { const n = sleep.endNap(); toast(n ? `Nap logged: ${fmtNap(n.hours)} 😴` : 'Nap cancelled.'); };
    if (r.cancel) r.cancel.onclick = () => { sleep.notTonight(); toast('Okay, not logged.'); };
    if (r.sleepin) r.sleepin.onclick = () => {
      const t = addMinutes(alarm.status().time, advice.minutes);
      if (alarm.setOverride(sun, t)) toast(`Sunday alarm moved to ${t}. Enjoy 🛌`);
    };
    if (r.undo) r.undo.onclick = () => { alarm.setOverride(sun, null); toast('Sunday is back to normal.'); };
  }
  ['sleep:changed', 'alarm:changed'].forEach((e) => on(e, render));
  on('tab:shown', ({ tab }) => { if (tab === 'alarm') render(); });
  render();
}

// "Going to sleep": at night it starts tracking the night; in the day it offers a nap timer.
export async function goingToSleepFlow({ at = Date.now() } = {}) {
  if (sleep.isSleepTime(at)) { sleep.goingToSleep(at); toast('Sweet dreams 💤'); return 'night'; }
  const mins = await napSheet();
  if (mins === 'night') { sleep.goingToSleep(at); toast('Sweet dreams 💤'); return 'night'; }
  if (!mins) return null;
  const n = sleep.startNap(mins, at);
  if (n) toast(`Nap timer set. I’ll wake you at ${hm(n.endAt)} ⏰`);
  return n ? 'nap' : null;
}

// Pick a nap length: presets, or your own with − / +.
export function napSheet() {
  return new Promise((resolve) => {
    let custom = 25;
    const back = document.createElement('div');
    back.className = 'sheet-backdrop';
    back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="nap-title">
      <h2 id="nap-title">Taking a nap? 😴</h2>
      <p>How long should I let you sleep?</p>
      <div class="chips nap-chips">${NAP_PRESETS.map((m) => `<button class="chip" data-nap="${m}">${m < 60 ? `${m} min` : m === 60 ? '1 h' : `${m / 60} h`}</button>`).join('')}</div>
      <div class="stepper-row" style="margin-top:12px"><span class="label"><strong>Or exactly</strong></span>
        <span class="stepper"><button type="button" data-d="-5" aria-label="5 minutes less">−</button><output data-ref="out">${custom} min</output><button type="button" data-d="5" aria-label="5 minutes more">+</button></span></div>
      <div class="actions"><button class="btn gold block" data-go>Start nap</button><button class="btn quiet" data-night>No, I’m going to bed</button></div></div>`;
    const out = back.querySelector('[data-ref="out"]');
    const done = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    back.addEventListener('click', (e) => {
      if (e.target === back) return done(null);
      const chip = e.target.closest('[data-nap]');
      if (chip) return done(Number(chip.dataset.nap));
      const d = e.target.closest('[data-d]');
      if (d) { custom = Math.min(NAP_LIMITS[1], Math.max(NAP_LIMITS[0], custom + Number(d.dataset.d))); out.textContent = `${custom} min`; return; }
      if (e.target.closest('[data-go]')) return done(custom);
      if (e.target.closest('[data-night]')) return done('night');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    back.querySelector('.chip')?.focus();
  });
}

// Bedtime prompts in the browser version (the app uses notifications with the same buttons).
export function mountPrompts() {
  on('sleep:prompt', async ({ kind }) => {
    const name = profile.get().name;
    if (!native.isNative()) sounds.preview(sounds.get().message);
    if (kind === 'asleep') {
      const v = await sheet({ title: 'Drifting off? 🌙', body: 'If you’re still awake, tap below. If not… why are you reading this? Sleep well 💤', actions: [{ label: 'Still awake', value: 'awake' }, { label: 'Going to sleep now', value: 'sleep', style: 'gold' }] });
      if (v === 'awake') { sleep.stillAwake(); toast('No worries. I’ll check again softly in 30 🫶'); }
      return;
    }
    const v = await sheet({
      title: kind === 'later' ? '30 minutes are up 🌙' : `Heading to bed${name ? `, ${name}` : ''}? 🌙`,
      body: kind === 'later' ? 'Time to put the phone down. Tomorrow-you says thanks 🫶' : 'It’s your bedtime. A good morning starts tonight.',
      actions: [{ label: 'Going to sleep 😴', value: 'sleep', style: 'gold' }, { label: 'In 30 minutes', value: 'later' }, ...(kind === 'later' ? [] : [{ label: 'Not tonight', value: 'skip' }])]
    });
    if (v === 'sleep') { sleep.goingToSleep(); toast('Sweet dreams 💤'); }
    else if (v === 'later') { sleep.later(30); toast('Okie, I’ll remind you in 30 🫶'); }
    else if (v === 'skip') { sleep.notTonight(); toast('Okay. Don’t stay up too late 🌙'); }
  });
}
