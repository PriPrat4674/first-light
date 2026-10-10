// The "Still up?" check after the alarm stops. Announces 'checkin:missed' if unanswered.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { clamp } from '../core/util.js';
import { CHECKIN_DEFAULTS, CHECKIN_LIMITS } from '../config.js';

let cfg = load('checkin', CHECKIN_DEFAULTS);
let st = load('checkin-state', { dueAt: null, passed: false });
let open = false; // not saved: after a reload the next tick reopens it

const commit = () => save('checkin-state', st);
const deadline = () => st.dueAt + cfg.windowSec * 1000;

export const settings = () => ({ ...cfg });
export function setSetting(key, value) {
  const [lo, hi] = CHECKIN_LIMITS[key];
  cfg[key] = clamp(Math.round(Number(value) || lo), lo, hi);
  save('checkin', cfg);
  return cfg[key];
}

export const state = () => ({ dueAt: st.dueAt, passed: st.passed, open, deadline: st.dueAt ? deadline() : null });

function clear() {
  const wasOpen = open;
  open = false;
  st.dueAt = null;
  commit();
  if (wasOpen) emit('checkin:closed');
}

on('morning:started', () => { open = false; st = { dueAt: null, passed: false }; commit(); });

on('morning:dismissed', (m) => {
  if (st.passed || (m?.test && !m?.full)) return; // a quick test ends at the phrase
  const speed = m?.speed || 1;
  st.dueAt = Date.now() + Math.max(20_000, (cfg.delayMin * 60_000) / speed);
  commit();
  emit('checkin:scheduled', state());
});

on('morning:finished', clear);
on('morning:closed', clear);

on('tick', ({ now }) => {
  if (!st.dueAt || st.passed) return;
  if (!open && now >= st.dueAt) { open = true; emit('checkin:open', state()); }
  if (!open) return;
  const left = deadline() - now;
  emit('checkin:countdown', { left });
  if (left <= 0) {
    clear();
    emit('checkin:missed');
  }
});

export function confirmAwake() {
  if (!open) return;
  st.passed = true;
  clear();
  emit('checkin:passed');
}
