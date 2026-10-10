// App lock (Android app only): chosen apps stay closed until your morning is proven.
// The lock starts when the alarm rings and ends when you finish your tasks,
// or automatically after `maxHours`, so you're never stuck. Phone and messages are never locked.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { clamp, norm } from '../core/util.js';
import * as native from '../services/native.js';

export const EMERGENCY_PHRASE = 'I need my apps right now';
let cfg = load('applock', { enabled: false, packages: [], labels: {}, maxHours: 3 });
if (!Array.isArray(cfg.packages)) cfg.packages = [];
let log = load('applock-log', []);
if (!Array.isArray(log)) log = [];

const commit = () => { save('applock', cfg); emit('applock:changed', get()); sync(); };
export const get = () => structuredClone(cfg);

// "com.instagram.android" → "Instagram" when we don't know the real label.
export function labelFor(pkg, given) {
  if (given && given !== pkg) return given;
  if (cfg.labels[pkg]) return cfg.labels[pkg];
  const skip = new Set(['com', 'org', 'net', 'android', 'app', 'apps', 'google', 'mobile', 'www']);
  const part = String(pkg).split('.').reverse().find((x) => x && !skip.has(x.toLowerCase())) || String(pkg);
  return part.charAt(0).toUpperCase() + part.slice(1);
}
export const emergencies = () => log.slice();

export function setEnabled(on_) { cfg.enabled = !!on_; commit(); return cfg.enabled; }
export function setMaxHours(h) { const n = Number(h); cfg.maxHours = clamp(Number.isFinite(n) ? Math.round(n) : cfg.maxHours, 1, 6); commit(); return cfg.maxHours; }
export function toggleApp(pkg, label = pkg) {
  if (typeof pkg !== 'string' || !/^[\w.]+$/.test(pkg)) return null;
  if (cfg.packages.includes(pkg)) cfg.packages = cfg.packages.filter((p) => p !== pkg);
  else { cfg.packages = [...cfg.packages, pkg].slice(0, 30); cfg.labels[pkg] = String(label).slice(0, 40); }
  commit();
  return cfg.packages.includes(pkg);
}

export function sync() {
  native.configureLock({ enabled: cfg.enabled && cfg.packages.length > 0, packages: cfg.packages, maxHours: cfg.maxHours });
}

// Returns true if the phrase matched and apps were unlocked.
export function emergencyUnlock(text) {
  if (norm(text) !== norm(EMERGENCY_PHRASE)) return false;
  native.unlock();
  log = [{ at: Date.now() }, ...log].slice(0, 100);
  save('applock-log', log);
  emit('applock:unlocked', { emergency: true });
  return true;
}

on('morning:started', (m) => { if (!m.test && cfg.enabled && cfg.packages.length) native.lockNow(); });
on('morning:finished', () => { native.unlock(); emit('applock:unlocked', { emergency: false }); });
on('morning:closed', () => native.unlock());
