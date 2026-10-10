// Progress tab: your streak, a five-week calendar (tap a day for its story), sleep, and three numbers.
// Snoozes and the day-by-day history live inside the calendar, so nothing is said twice.
import { on } from '../core/events.js';
import { refs, esc, dayKey, plural } from '../core/util.js';
import * as stats from '../features/stats.js';
import * as snooze from '../features/snooze.js';
import { sunburst, info, sheet } from './components.js';
import * as sleep from '../features/sleep.js';
import * as native from '../services/native.js';
import * as applock from '../features/applock.js';
import * as profile from '../features/profile.js';
import { weekChart } from './sleep-view.js';
import { petMarkup } from './pet-view.js';
import * as pet from '../features/pet.js';
import { shareStoryCard, lastProven } from './story-card.js';
import { icon, motif } from './icons.js';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function mount(root) {
  root.innerHTML = `
    <section class="streak-hero">
      <div style="max-width:300px;margin:0 auto" data-ref="burst"></div>
      <div class="big" data-ref="streak">0</div>
      <div class="cap" data-ref="cap"></div>
      <button class="btn line small hidden" data-ref="shareStory" style="margin-top:12px">${icon('share', 18)} Share my morning</button>
    </section>
    <div class="card empty-card hidden" data-ref="empty"></div>
    <div class="card" data-ref="calCard">
      <div class="card-head"><h3>Last five weeks</h3></div>
      <div class="cal" data-ref="cal"></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Proven</span><span><i class="dot-snooze"></i>Snoozed</span>${native.isNative() ? '' : '<span><i style="border:1px solid var(--danger)"></i>Battery pause</span>'}</div>
    </div>
    <div class="card" data-ref="sleepCard">
      <div class="card-head"><h3>Sleep this week ${info('Sleep', 'Time in bed, from “Going to sleep” to stopping the alarm, plus naps. Not a medical measurement.')}</h3><span class="small muted" data-ref="sleepAvg"></span></div>
      <div data-ref="sleepChart"></div>
    </div>
    <div class="stat-grid three" data-ref="grid"></div>
    <p class="small muted hidden" data-ref="unlocks" style="margin-top:10px;text-align:center"></p>`;
  const r = refs(root);
  let byDay = new Map(), snoozesByDay = new Map();

  function calendar() {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today); start.setDate(today.getDate() - mondayOffset - 28);
    let html = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 35; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = dayKey(d);
      if (d > today) { html += '<div class="day blank"></div>'; continue; }
      const h = byDay.get(key);
      const snoozed = snoozesByDay.get(key) || 0;
      const label = `${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}: ${h?.outcome || 'no record'}${snoozed ? `, ${plural(snoozed, 'snooze')}` : ''}`;
      html += `<button class="day ${h?.outcome || ''} ${key === dayKey() ? 'today' : ''}${snoozed ? ' snoozed' : ''}" data-day="${key}" aria-label="${esc(label)}">${d.getDate()}</button>`;
    }
    return html;
  }

  // One day's story, from the calendar.
  r.cal.addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    const key = b.dataset.day;
    const h = byDay.get(key), sn = snoozesByDay.get(key) || 0;
    const date = new Date(`${key}T12:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    const lines = h?.outcome === 'proven' ? [`Grade ${esc(h.grade || '–')}`, `Proven in ${plural(h.mins, 'minute')}`, h.misses ? plural(h.misses, 'missed check-in') : '']
      : h?.outcome === 'paused' ? [`Alarm paused at ${h.level}% battery`]
      : h?.outcome === 'frozen' ? ['A streak freeze kept your streak']
      : ['No proven morning'];
    if (sn) lines.push(plural(sn, 'snooze'));
    sheet({ title: date, body: `<ul class="day-facts">${lines.filter(Boolean).map((l) => `<li>${l}</li>`).join('')}</ul>`, actions: [{ label: 'Close', value: true }] });
  });

  function render() {
    const s = stats.get();
    const streak = stats.currentStreak();
    byDay = new Map();
    for (const h of [...s.history].reverse()) if (!byDay.has(h.date) || h.outcome === 'proven') byDay.set(h.date, h);
    snoozesByDay = new Map();
    for (const x of snooze.hallOfShame()) if (!x.test) { const k = dayKey(new Date(x.at)); snoozesByDay.set(k, (snoozesByDay.get(k) || 0) + 1); }

    r.streak.textContent = streak;
    const freezes = s.freezes || 0;
    r.cap.textContent = `${streak === 1 ? 'morning' : 'mornings'} in a row${s.vacationMode ? ' · paused for vacation' : freezes ? ` · ${plural(freezes, 'freeze')} left` : ''}`;
    r.burst.innerHTML = `<div class="progress-pet">${petMarkup(pet.current(), 104)}</div>` + sunburst({ lit: Math.min(1, streak / 7), risen: streak >= 7, label: `${streak} of 7 days toward a full sunrise` });
    r.shareStory.classList.toggle('hidden', !lastProven());

    const fresh = !s.history.length;
    r.empty.classList.toggle('hidden', !fresh);
    r.calCard.classList.toggle('hidden', fresh);
    r.grid.classList.toggle('hidden', fresh);
    if (fresh) r.empty.innerHTML = `${motif(profile.get().theme, 'alt', 56)}<p class="soft">Your first proven morning shows up here.</p>`;

    const w = sleep.week();
    r.sleepCard.classList.toggle('hidden', fresh && !w.count);
    r.sleepAvg.textContent = w.count ? `${w.average} h average` : '';
    r.sleepChart.innerHTML = weekChart(w);
    r.cal.innerHTML = calendar();

    const proven = s.history.filter((h) => h.outcome === 'proven');
    const avg = proven.length ? Math.round(proven.reduce((a, h) => a + h.mins, 0) / proven.length) : null;
    r.grid.innerHTML = [[s.best, 'Best streak'], [s.wins, 'Mornings proven'], [avg == null ? '–' : `${avg}m`, 'Average time']]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    // In the app, emergency unlocks of App Lock are worth an honest mention, but only if there are any.
    const unlocks = native.isNative() ? applock.emergencies().length : 0;
    r.unlocks.classList.toggle('hidden', !unlocks);
    r.unlocks.textContent = `Emergency unlocks: ${unlocks}`;
  }

  r.shareStory.onclick = () => shareStoryCard(lastProven());

  on('streak:changed', render);
  on('sleep:changed', render);
  on('pet:changed', render);
  on('snooze:started', render);
  on('profile:changed', render);
  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) render(); });
}
