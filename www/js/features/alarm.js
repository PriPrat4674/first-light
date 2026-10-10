// Alarm scheduling: the wake-up time, armed/disarmed, test alarms.
// Announces 'alarm:fire' when it's time. It doesn't know what happens next.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { DEFAULT_ALARM_TIME, TEST_DELAY_MS, STALE_ALARM_MS } from '../config.js';
import { dayKey } from '../core/util.js';
import * as native from '../services/native.js';

let s = load('alarm', { time: DEFAULT_ALARM_TIME, armedAt: null, testAt: null, overrides: {} });
if (!s.overrides || typeof s.overrides !== 'object') s.overrides = {};

// Uses a one-off time for a specific day if one is set (e.g. a Sunday sleep-in).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function timeFor(d) { return s.overrides[dayKey(d)] || s.time; }
function at(d, hhmm) { const [h, m] = hhmm.split(':').map(Number); const x = new Date(d); x.setHours(h, m, 0, 0); return x.getTime(); }
function nextAt(from = Date.now()) {
  const today = new Date(from);
  const t1 = at(today, timeFor(today));
  if (t1 > from) return t1;
  const tomorrow = new Date(from); tomorrow.setDate(tomorrow.getDate() + 1);
  return at(tomorrow, timeFor(tomorrow));
}

// If the app was closed through the alarm, don't ring hours late on next open.
if (s.armedAt && Date.now() - s.armedAt > STALE_ALARM_MS) s.armedAt = nextAt();
if (s.testAt && Date.now() - s.testAt > STALE_ALARM_MS) s.testAt = null;
save('alarm', s);

export const status = () => ({ time: s.time, armedAt: s.armedAt, testAt: s.testAt, armed: !!s.armedAt, overrides: { ...s.overrides } });

function commit() { save('alarm', s); emit('alarm:changed', status()); }

export function setTime(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(time));
  if (!m || +m[1] > 23 || +m[2] > 59) return false; // keep the current time
  s.time = time;
  if (s.armedAt) s.armedAt = nextAt();
  commit();
  return true;
}
export function arm() { s.armedAt = nextAt(); commit(); }

// One-off wake time for a given date (YYYY-MM-DD). Pass null to remove it.
export function setOverride(date, hhmm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false;
  if (hhmm === null) delete s.overrides[date];
  else if (TIME_RE.test(hhmm)) s.overrides[date] = hhmm;
  else return false;
  // Forget past overrides.
  const today = dayKey();
  for (const k of Object.keys(s.overrides)) if (k < today) delete s.overrides[k];
  if (s.armedAt) s.armedAt = nextAt();
  commit();
  return true;
}
export function disarm() { s.armedAt = null; s.testAt = null; commit(); }
export function test() { s.testAt = Date.now() + TEST_DELAY_MS; commit(); }

on('tick', ({ now }) => {
  if (native.isNative()) return; // in the app, Android's alarm system does the timing
  if (s.testAt && now >= s.testAt) {
    s.testAt = null; commit();
    emit('alarm:fire', { test: true });
    return;
  }
  if (s.armedAt && now >= s.armedAt) {
    s.armedAt = nextAt(now + 60_000); commit();
    emit('alarm:fire', { test: false });
  }
});

// Android fired the alarm: keep our record in step (next day / test done).
on('alarm:fire', ({ fromNative, test }) => {
  if (!fromNative) return;
  if (test) { if (s.testAt) { s.testAt = null; commit(); } return; }
  if (s.armedAt && s.armedAt <= Date.now() + 60_000) { s.armedAt = nextAt(Date.now() + 60_000); commit(); }
});
