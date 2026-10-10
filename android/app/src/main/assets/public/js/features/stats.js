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

export function setVacation(on) {
  s.vacationMode = !!on;
  commit();
}

// The streak counts if yesterday or today was proven, or protected by freeze / vacation mode.
export function currentStreak(now = new Date()) {
  if (!s.lastWin) return 0;
  if (s.vacationMode) return s.streak;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const yKey = dayKey(y), nowKey = dayKey(now);
  if (s.lastWin === nowKey || s.lastWin === yKey) return s.streak;

  // Auto Grace Day / Streak Freeze protection
  if ((s.freezes || 0) > 0 && s.streak > 1) {
    s.freezes--;
    s.lastWin = yKey;
    s.history = [{ date: yKey, outcome: 'frozen' }, ...s.history].slice(0, 60);
    commit();
    return s.streak;
  }
  return 0;
}

on('morning:finished', (m) => {
  if (m.test) return;
  const today = dayKey();
  if (s.lastWin !== today) {
    const prev = currentStreak();
    s.streak = prev + 1;
    s.wins++;
    s.lastWin = today;
    // Earn 1 freeze back on every 7-day milestone (max 2)
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
