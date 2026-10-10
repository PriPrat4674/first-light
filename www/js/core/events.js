// A tiny event bus. Features announce what happened; other parts react.
// A failing listener is logged and skipped, so one broken part can't stop the others.
//
// Events in use:
//   tick                 { now }            every 500 ms
//   alarm:changed        alarm status       time set, armed, disarmed, test scheduled
//   alarm:fire           { test }           the alarm time arrived
//   morning:started      morning snapshot
//   morning:ringing      { songId, escalated, test }
//   morning:dismissed    morning snapshot   correct phrase typed
//   morning:finished     morning snapshot   all tasks done
//   morning:closed
//   morning:changed      morning snapshot   any change, for screens to redraw
//   morning:snoozed      morning snapshot
//   snooze:started { until, count, test } / snooze:ended
//   checkin:scheduled / checkin:open / checkin:countdown { left } / checkin:closed
//   checkin:passed / checkin:missed
//   boost:show { voice, clip }          after a passed check-in, if you saved any
//   battery:changed { supported, level, charging }
//   guard:tripped { level }             battery guard disarmed the alarm
//   music:changed, music:fallback { source, reason }
//   spotify:changed, youtube:changed
//   tasks:changed, songs:changed, boost:changed, streak:changed
//   tab:shown            { tab }
//   night:changed        { shown }
//   storage:error

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      const out = fn(payload);
      if (out && typeof out.catch === 'function') out.catch((e) => console.error(`[${event}]`, e));
    } catch (e) {
      console.error(`[${event}]`, e);
    }
  }
}
