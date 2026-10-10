// Streak, totals and history. Test runs never count.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { dayKey } from '../core/util.js';
import { grade } from './report.js';

const EMPTY = { streak: 0, best: 0, wins: 0, lastWin: null, history: [], totals: { snoozes: 0, misses: 0, paused: 0 }, freezes: 1, vacationMode: false };
let s = load('streak', EMPTY);
s.totals = { ...EMPTY.totals, ...(s.totals || {}) };
s.freezes ??= 1;
s.vacationMode ??= false;
if (!Array.isArray(s.history)) s.history = [];

const commit = () => { save('streak', s); emit('streak:changed', get()); };
export const get = () => structuredClone(s);

const daysAgo = (n, now = new Date()) => { const d = new Date(now); d.setDate(d.getDate() - n); return dayKey(d); };

// Vacation pauses the streak. Switching it off picks up where you left off, as long as the
// streak was still alive when the vacation began.
export function setVacation(on) {
  on = !!on;
  if (on === s.vacationMode) return;
  if (on) s.vacationFrom = dayKey();
  else {
    const alive = s.lastWin && s.vacationFrom && s.lastWin >= daysAgo(1, new Date(`${s.vacationFrom}T12:00`));
    if (alive && s.lastWin < daysAgo(1)) s.lastWin = daysAgo(1);
    delete s.vacationFrom;
  }
  s.vacationMode = on;
  commit();
}

// Pure: the streak counts if today or yesterday was proven (or kept by a freeze), or on vacation.
export function currentStreak(now = new Date()) {
  if (!s.lastWin) return 0;
  if (s.vacationMode) return s.streak;
  return s.lastWin === dayKey(now) || s.lastWin === daysAgo(1, now) ? s.streak : 0;
}

// A streak freeze covers exactly one missed day. Runs when the day changes, not on every read.
export function reconcile(now = new Date()) {
  if (s.vacationMode || !s.lastWin || s.streak < 2 || (s.freezes || 0) < 1) return;
  if (s.lastWin !== daysAgo(2, now)) return;
  const missed = daysAgo(1, now);
  s.freezes--;
  s.lastWin = missed;
  s.history = [{ date: missed, outcome: 'frozen' }, ...s.history].slice(0, 60);
  commit();
}
reconcile();
let lastDay = dayKey();
on('tick', ({ now }) => { const k = dayKey(new Date(now)); if (k !== lastDay) { lastDay = k; reconcile(); } });

on('morning:finished', (m) => {
  if (m.test) return;
  const today = dayKey();
  reconcile();
  if (s.lastWin !== today) {
    const prev = currentStreak();
    s.streak = prev + 1;
    s.wins++;
    s.lastWin = today;
    // Earn a freeze back at every 7-day milestone (2 at most).
    if (s.streak % 7 === 0 && (s.freezes || 0) < 2) {
      s.freezes = Math.min(2, (s.freezes || 0) + 1);
    }
  }
  s.best = Math.max(s.best, s.streak);
  s.totals.snoozes += m.snoozes || 0;
  s.totals.misses += m.misses || 0;
  const g = grade(m);
  s.history = [{ date: today, outcome: 'proven', mins: g.mins, snoozes: g.snoozes, misses: g.misses, grade: g.letter }, ...s.history].slice(0, 60);
  commit();
});

on('guard:tripped', ({ level }) => {
  s.totals.paused++;
  s.history = [{ date: dayKey(), outcome: 'paused', level }, ...s.history].slice(0, 60);
  commit();
});
