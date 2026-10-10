// Streak, totals and history. Test runs never count.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { dayKey } from '../core/util.js';
import { grade } from './report.js';

const EMPTY = { streak: 0, best: 0, wins: 0, lastWin: null, history: [], totals: { snoozes: 0, misses: 0, paused: 0 } };
let s = load('streak', EMPTY);
s.totals = { ...EMPTY.totals, ...(s.totals || {}) };
if (!Array.isArray(s.history)) s.history = [];

const commit = () => { save('streak', s); emit('streak:changed', get()); };
export const get = () => structuredClone(s);

// The streak only counts if yesterday or today was proven.
export function currentStreak(now = new Date()) {
  if (!s.lastWin) return 0;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  return s.lastWin === dayKey(now) || s.lastWin === dayKey(y) ? s.streak : 0;
}

on('morning:finished', (m) => {
  if (m.test) return;
  const today = dayKey();
  if (s.lastWin !== today) {
    s.streak = currentStreak() + 1;
    s.wins++;
    s.lastWin = today;
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
