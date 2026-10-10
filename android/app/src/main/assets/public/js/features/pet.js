// Pip's mood. Happy when you're consistent, grumpy when you snooze, sulky when a streak breaks.
import { on, emit } from '../core/events.js';
import { dayKey } from '../core/util.js';
import * as stats from './stats.js';
import * as morning from './morning.js';
import * as sleep from './sleep.js';

// Pure: everything it needs is passed in, so it's easy to test.
export function moodFor({ hour, streak, wins, provenToday, snoozesToday, missesToday, morningActive, shortNight }) {
  if (morningActive && (snoozesToday > 0 || missesToday > 0)) return 'grumpy';
  if (!morningActive && (hour >= 22 || hour < 4)) return 'sleepy';
  if (snoozesToday > 0 || missesToday > 0) return 'grumpy';
  if (streak >= 7) return 'ecstatic';
  if (provenToday || streak >= 2) return 'happy';
  if (wins > 0 && streak === 0) return 'sulking';
  if (shortNight) return 'sleepy';
  return 'neutral';
}

export function current(now = new Date()) {
  const st = stats.get();
  const m = morning.get();
  const today = m && m.date === dayKey(now) ? m : null;
  const n = sleep.lastNight(now);
  return moodFor({
    hour: now.getHours(),
    streak: stats.currentStreak(now),
    wins: st.wins,
    provenToday: st.lastWin === dayKey(now),
    snoozesToday: today && !today.test ? today.snoozes || 0 : 0,
    missesToday: today && !today.test ? today.misses || 0 : 0,
    morningActive: morning.isActive(),
    shortNight: !!n && sleep.classify(n.hours)?.key === 'short'
  });
}

let last = null;
const check = () => { const m = current(); if (m !== last) { last = m; emit('pet:changed', m); } };
['streak:changed', 'morning:changed', 'sleep:changed'].forEach((e) => on(e, check));
on('tick', ({ now }) => { if (now % 60_000 < 1000) check(); });
