// Snooze rules and the Hall of Shame. A limited number of snoozes per morning,
// and every one is recorded forever.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { clamp } from '../core/util.js';
import { SNOOZE_DEFAULTS, SNOOZE_LIMITS } from '../config.js';

let cfg = load('snooze', SNOOZE_DEFAULTS);
let st = load('snooze-state', { until: null, count: 0, test: false });
let shame = load('shame', []);
if (!Array.isArray(shame)) shame = [];

const commit = () => save('snooze-state', st);

export const settings = () => ({ ...cfg });
export function setSetting(key, value) {
  if (key === 'enabled') { cfg.enabled = !!value; save('snooze', cfg); return cfg.enabled; }
  const [lo, hi] = SNOOZE_LIMITS[key];
  const n = Number(value);
  cfg[key] = clamp(Number.isFinite(n) ? Math.round(n) : cfg[key], lo, hi);
  save('snooze', cfg);
  return cfg[key];
}

export const state = () => ({ ...st, left: Math.max(0, cfg.max - st.count) });
export const canSnooze = () => cfg.enabled && st.count < cfg.max;
export const hallOfShame = () => shame.slice();

// Returns the time the alarm comes back, or null if snoozing isn't allowed.
export function request() {
  if (!canSnooze()) return null;
  st.count++;
  st.until = Date.now() + cfg.minutes * 60_000;
  commit();
  shame = [{ at: Date.now(), test: st.test }, ...shame].slice(0, 200);
  save('shame', shame);
  emit('snooze:started', { until: st.until, count: st.count, test: st.test });
  return st.until;
}

// "I'm up": end the snooze early.
export function endNow() {
  if (!st.until) return;
  st.until = null;
  commit();
  emit('snooze:ended');
}

on('morning:started', (m) => { st = { until: null, count: 0, test: !!m.test }; commit(); });
const clear = () => { if (st.until) { st.until = null; commit(); } };
on('morning:finished', clear);
on('morning:closed', clear);

on('tick', ({ now }) => {
  if (st.until && now >= st.until) { st.until = null; commit(); emit('snooze:ended'); }
});
