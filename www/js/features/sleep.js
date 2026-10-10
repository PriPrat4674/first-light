// Sleep tracking without a watch. You tell First Light when you go to bed (from the bedtime
// prompt), and it notes when you stop the alarm. That's time in bed, not measured sleep.
// Guidance: 7–9 h for adults 18–25 (National Sleep Foundation, Hirshkowitz et al. 2015).
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { dayKey, clamp } from '../core/util.js';
import * as native from '../services/native.js';

const HALF_HOUR = 30 * 60_000;
const DEFAULTS = {
  schedule: { bed: '23:00', wake: '06:30', goal: 8 },
  prompts: true,
  asleepCheck: 'warm', // 'warm' | 'silent' | 'off'
  pending: { bedAt: null, laterUntil: null, asleepAt: null, promptedOn: null },
  nights: []
};
let s = load('sleep', DEFAULTS);
s.schedule = { ...DEFAULTS.schedule, ...(s.schedule || {}) };
s.pending = { ...DEFAULTS.pending, ...(s.pending || {}) };
if (!Array.isArray(s.nights)) s.nights = [];

const commit = () => { save('sleep', s); emit('sleep:changed', get()); };
export const get = () => structuredClone(s);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ---------- settings ---------- */
export function setSchedule({ bed, wake, goal } = {}) {
  if (bed !== undefined && TIME_RE.test(bed)) s.schedule.bed = bed;
  if (wake !== undefined && TIME_RE.test(wake)) s.schedule.wake = wake;
  if (goal !== undefined && Number.isFinite(Number(goal))) s.schedule.goal = clamp(Math.round(Number(goal) * 2) / 2, 6, 10);
  commit();
  syncNative();
  return { ...s.schedule };
}
export function setOption(key, value) {
  if (key === 'prompts') s.prompts = !!value;
  else if (key === 'asleepCheck' && ['warm', 'silent', 'off'].includes(value)) s.asleepCheck = value;
  else return null;
  commit();
  syncNative();
  return s[key];
}

/** Next time the clock reads HH:MM (today if still ahead, otherwise tomorrow). */
export function nextOccurrence(hhmm, from = Date.now()) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(from); d.setHours(h, m, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function syncNative() {
  if (!native.isNative()) return;
  if (s.prompts) native.schedule('bedtime', nextOccurrence(s.schedule.bed), 'bedtime', true);
  else native.cancel('bedtime');
  native.setSounds({ asleep: s.asleepCheck });
}

/* ---------- bedtime answers ---------- */
export function goingToSleep(at = Date.now(), { fromNative = false } = {}) {
  s.pending.bedAt = at;
  s.pending.laterUntil = null;
  s.pending.asleepAt = s.asleepCheck === 'off' ? null : at + HALF_HOUR;
  s.pending.promptedOn = dayKey(new Date(at));
  commit();
  if (!fromNative && native.isNative() && s.asleepCheck !== 'off') native.schedule('asleep', at + HALF_HOUR, 'asleep');
}

export function later(minutes = 30, at = Date.now(), { fromNative = false } = {}) {
  s.pending.laterUntil = at + minutes * 60_000;
  s.pending.promptedOn = dayKey(new Date(at));
  commit();
  if (!fromNative && native.isNative()) native.schedule('later', s.pending.laterUntil, 'later');
  return s.pending.laterUntil;
}

export function notTonight(at = Date.now()) {
  s.pending = { ...s.pending, bedAt: null, laterUntil: null, asleepAt: null, promptedOn: dayKey(new Date(at)) };
  commit();
}

// "Still awake" pushes your bedtime to now, and checks once more later.
export function stillAwake(at = Date.now(), { fromNative = false } = {}) {
  if (!s.pending.bedAt) return;
  s.pending.bedAt = at;
  s.pending.asleepAt = at + HALF_HOUR;
  commit();
  if (!fromNative && native.isNative()) native.schedule('asleep', at + HALF_HOUR, 'asleep');
}

// Answers given on notifications while the app was closed.
export function applyNativeEvents(events = []) {
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.type === 'sleep') goingToSleep(e.at, { fromNative: true });
    else if (e.type === 'later') later(30, e.at, { fromNative: true });
    else if (e.type === 'skip') notTonight(e.at);
    else if (e.type === 'awake') stillAwake(e.at, { fromNative: true });
  }
}

/* ---------- waking up ---------- */
export function recordWake(at = Date.now()) {
  const bedAt = s.pending.bedAt;
  s.pending.bedAt = null;
  s.pending.asleepAt = null;
  s.pending.laterUntil = null;
  if (!bedAt) { commit(); return null; }
  const hours = (at - bedAt) / 3_600_000;
  if (hours < 1 || hours > 16) { commit(); return null; } // not a real night
  const night = { date: dayKey(new Date(at)), bedAt, wakeAt: at, hours: Math.round(hours * 10) / 10 };
  s.nights = [night, ...s.nights.filter((n) => n.date !== night.date)].slice(0, 90);
  commit();
  emit('sleep:night', night);
  return night;
}

/* ---------- reading the log ---------- */
export function lastNight(now = new Date()) {
  const n = s.nights[0];
  return n && n.date === dayKey(now) ? { ...n } : null;
}

export function classify(hours, goal = s.schedule.goal) {
  if (hours == null) return null;
  if (hours < Math.min(goal - 1, 6.5)) return { key: 'short', emoji: '🥱', label: 'Short night', text: `${hours} h is well under your ${goal} h goal.` };
  if (hours < goal - 0.25) return { key: 'bit-short', emoji: '😐', label: 'A little short', text: `${hours} h, a bit under your ${goal} h goal.` };
  if (hours > Math.max(goal + 1.5, 9.5)) return { key: 'long', emoji: '🛌', label: 'Long night', text: `${hours} h is more than usual. Fine now and then; if it’s often, notice how you feel.` };
  return { key: 'good', emoji: '😊', label: 'Well rested', text: `${hours} h. Right on your ${goal} h goal.` };
}

// Nights from the last 7 days.
export function week(now = Date.now()) {
  const since = now - 7 * 86_400_000;
  const nights = s.nights.filter((n) => n.wakeAt > since);
  const goal = s.schedule.goal;
  const total = nights.reduce((a, n) => a + n.hours, 0);
  const debt = nights.reduce((a, n) => a + Math.max(0, goal - n.hours), 0);
  return {
    count: nights.length,
    average: nights.length ? Math.round((total / nights.length) * 10) / 10 : null,
    debt: Math.round(debt * 10) / 10,
    nights: nights.slice().reverse(),
    goal
  };
}

/**
 * Weekend sleep-in suggestion, shown Saturday afternoon to Sunday morning.
 * Capped at 2 hours: sleeping until noon shifts your body clock ("social jetlag") and doesn't
 * undo a week of short sleep (Depner et al., Current Biology 2019).
 */
export function sundayAdvice(now = new Date()) {
  const day = now.getDay(), hour = now.getHours();
  const inWindow = (day === 6 && hour >= 12) || (day === 0 && hour < 12);
  if (!inWindow) return null;
  const w = week(now.getTime());
  if (w.count < 3 || w.debt < 2) return null;
  const minutes = clamp(Math.round((w.debt * 60) / 3 / 15) * 15, 30, 120);
  return { minutes, debt: w.debt, average: w.average };
}

/* ---------- in-app prompts (browser version; the APK uses notifications) ---------- */
on('tick', ({ now }) => {
  if (native.isNative() || !s.prompts) return;
  const today = dayKey(new Date(now));
  const p = s.pending;
  if (p.laterUntil && now >= p.laterUntil) { p.laterUntil = null; commit(); emit('sleep:prompt', { kind: 'later' }); return; }
  if (p.asleepAt && now >= p.asleepAt) { p.asleepAt = null; commit(); emit('sleep:prompt', { kind: 'asleep' }); return; }
  const [h, m] = s.schedule.bed.split(':').map(Number);
  const b = new Date(now); b.setHours(h, m, 0, 0);
  const bedToday = b.getTime();
  if (!p.bedAt && p.promptedOn !== today && now >= bedToday && now < bedToday + 90 * 60_000) {
    p.promptedOn = today; commit(); emit('sleep:prompt', { kind: 'bedtime' });
  }
});

on('morning:dismissed', (m) => { if (!m.test && m.rings >= 1) recordWake(Date.now()); });
