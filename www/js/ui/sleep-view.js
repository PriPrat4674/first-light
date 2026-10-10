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

const hm = (ts) => fmtTime(new Date(ts));

export function weekChart(w = sleep.week()) {
  if (!w.count) return '<p class="empty-note">No nights logged yet. Tap “Going to sleep” at bedtime, or answer the bedtime nudge.</p>';
  const max = Math.max(10, ...w.nights.map((n) => n.hours));
  const bars = w.nights.map((n) => {
    const c = sleep.classify(n.hours, w.goal);
    const day = new Date(`${n.date}T12:00`).toLocaleDateString([], { weekday: 'short' });
    return `<div class="bar ${c.key}" title="${esc(day)}: ${n.hours} h"><span style="height:${Math.round((n.hours / max) * 100)}%"><b>${n.hours}</b></span><i>${esc(day)}</i></div>`;
  }).join('');
  return `<div class="sleep-chart" role="img" aria-label="Sleep this week, average ${w.average} hours">
    <div class="goal-line" style="bottom:calc(${Math.round((w.goal / max) * 100)}% + 22px)"><em>${w.goal} h goal</em></div>${bars}</div>`;
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
    const last = sleep.lastNight();
    const c = last ? sleep.classify(last.hours) : null;
    const w = sleep.week();
    const advice = sleep.sundayAdvice();
    const sun = sundayKey();
    const override = alarm.status().overrides?.[sun];
    el.innerHTML = `
      <div class="card-head"><h3>Sleep</h3><span class="small muted">${s.schedule.bed} – ${s.schedule.wake}</span></div>
      ${last ? `<div class="sleep-last ${c.key}"><span class="big-emoji" aria-hidden="true">${c.emoji}</span><div><strong>${c.label}</strong><p class="small soft">${esc(c.text)} In bed ${hm(last.bedAt)}, up ${hm(last.wakeAt)}.</p></div></div>`
        : s.pending.bedAt ? `<p class="soft">Sleeping since ${hm(s.pending.bedAt)} 💤 I’ll note when you stop the alarm.</p>`
        : '<p class="soft">Tell me when you go to bed and I’ll work out how long you slept.</p>'}
      ${w.count ? `<p class="small muted" style="margin-top:10px">This week: ${w.average} h average over ${w.count} night${w.count === 1 ? '' : 's'}${w.debt >= 1 ? `, about ${w.debt} h short` : ''}.</p>` : ''}
      ${advice ? `<div class="notice card" style="margin-top:12px">
          <strong>Sunday sleep-in 🛌</strong>
          <p class="small soft" style="margin-top:4px">You’re about ${advice.debt} h short this week. Sleep in ${advice.minutes} minutes on Sunday${override ? ` (alarm moved to ${override})` : ''}. Not till noon: big lie-ins shift your body clock and make Monday harder. An earlier Sunday bedtime helps more.</p>
          ${override ? '<button class="btn quiet" data-ref="undo">Keep my usual time</button>' : `<button class="btn gold" data-ref="sleepin" style="margin-top:10px">Move Sunday’s alarm ${advice.minutes} min later</button>`}
        </div>` : ''}
      ${s.pending.bedAt ? '<button class="btn quiet" data-ref="cancel">I’m not asleep after all</button>' : '<button class="btn line block" data-ref="now" style="margin-top:12px">Going to sleep 😴</button>'}`;
    const r = refs(el);
    if (r.now) r.now.onclick = () => { sleep.goingToSleep(); toast('Sweet dreams 💤 I’ll note when you wake.'); };
    if (r.cancel) r.cancel.onclick = () => { sleep.notTonight(); toast('Okay, not logged.'); };
    if (r.sleepin) r.sleepin.onclick = () => {
      const t = addMinutes(alarm.status().time, advice.minutes);
      if (alarm.setOverride(sun, t)) toast(`Sunday alarm moved to ${t}. Enjoy it 🛌`);
    };
    if (r.undo) r.undo.onclick = () => { alarm.setOverride(sun, null); toast('Sunday is back to your usual time.'); };
  }
  ['sleep:changed', 'alarm:changed'].forEach((e) => on(e, render));
  on('tab:shown', ({ tab }) => { if (tab === 'alarm') render(); });
  render();
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
