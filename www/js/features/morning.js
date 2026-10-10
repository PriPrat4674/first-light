// The morning itself: ringing ⇄ snoozed → tasks → done → closed.
// Starts on 'alarm:fire', rings again on 'checkin:missed' and 'snooze:ended'.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { dayKey, pick, norm } from '../core/util.js';
import { DISMISS_PHRASES, RETRY_PHRASES } from '../config.js';
import * as tasks from './tasks.js';
import * as snoozeRules from './snooze.js';

const ACTIVE = ['ringing', 'snoozed', 'tasks'];
let m = load('morning', null);
if (m) { m.snoozes ??= 0; m.rings ??= 1; m.misses ??= 0; }

const snapshot = () => (m ? structuredClone(m) : null);
const commit = () => save('morning', m);
const changed = () => emit('morning:changed', snapshot());

export const get = snapshot;
export const isActive = () => !!m && ACTIVE.includes(m.phase);
export const phrase = () => (m?.escalated ? m.retryPhrase : m?.phrase);

export function currentTask() {
  return m?.phase === 'tasks' ? m.tasks[m.completed.length] ?? null : null;
}
export function currentUnlocksAt() {
  const i = m.completed.length;
  return tasks.unlocksAt(m.tasks[i], i ? m.completed[i - 1].at : 0);
}

function start(test) {
  if (isActive()) return false;
  m = {
    date: dayKey(), test: !!test, startedAt: Date.now(), phase: 'ringing', rings: 0,
    escalated: false, misses: 0, snoozes: 0, tasks: tasks.forToday(), completed: [],
    phrase: pick(DISMISS_PHRASES), retryPhrase: null
  };
  commit();
  emit('morning:started', snapshot());
  ring();
  return true;
}

function ring() {
  m.phase = 'ringing';
  m.rings++;
  commit();
  emit('morning:ringing', { escalated: m.escalated, test: m.test, fresh: m.rings === 1 });
  changed();
}

// Re-sends the ringing signal, e.g. after the user taps to allow sound.
export function replaySound() {
  if (m?.phase === 'ringing') emit('morning:ringing', { escalated: m.escalated, test: m.test, fresh: false });
}

// Returns true when the typed text matches and the alarm stops.
export function dismiss(text) {
  if (m?.phase !== 'ringing' || !norm(text) || norm(text) !== norm(phrase())) return false;
  m.phase = 'tasks';
  m.escalated = false;
  commit();
  emit('morning:dismissed', snapshot());
  if (!m.tasks.length) finish(); else changed();
  return true;
}

export const canSnooze = () => m?.phase === 'ringing' && !m.escalated && snoozeRules.canSnooze();

// Returns when the alarm comes back, or null if a snooze isn't allowed right now.
export function snooze() {
  if (!canSnooze()) return null;
  const until = snoozeRules.request();
  if (!until) return null;
  m.phase = 'snoozed';
  m.snoozes++;
  m.snoozeUntil = until;
  commit();
  emit('morning:snoozed', snapshot());
  changed();
  return until;
}

export function completeTask(taskId) {
  const t = currentTask();
  if (!t || t.id !== taskId || Date.now() < currentUnlocksAt()) return false;
  m.completed.push({ id: taskId, at: Date.now() });
  if (m.completed.length >= m.tasks.length) { finish(); return true; }
  commit();
  changed();
  return true;
}

function finish() {
  m.phase = 'done';
  m.doneAt = Date.now();
  commit();
  emit('morning:finished', snapshot());
  changed();
}

export function close() {
  if (!m || m.phase === 'closed') return;
  m.phase = 'closed';
  commit();
  emit('morning:closed');
  changed();
}

// Picks up where things were after the app reopens.
export function resume() {
  if (!m) return;
  if (isActive() && m.phase !== 'ringing' && m.date !== dayKey()) { close(); return; }
  if (m.phase === 'ringing') { m.rings = Math.max(1, m.rings); ring(); } else changed();
}

on('alarm:fire', ({ test }) => start(test));

on('snooze:ended', () => { if (m?.phase === 'snoozed') { m.snoozeUntil = null; ring(); } });

on('checkin:missed', () => {
  if (!isActive()) return;
  m.misses++;
  m.escalated = true;
  m.retryPhrase = pick(RETRY_PHRASES);
  ring();
});
