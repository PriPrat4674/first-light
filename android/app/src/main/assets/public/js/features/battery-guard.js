// Battery guard: stops the app from draining your phone overnight.
// Before arming, it warns if the battery is low and not charging.
// While armed, if the battery falls to the floor without a charger, it disarms and lets the screen sleep.
import { load, save } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { clamp } from '../core/util.js';
import { BATTERY_DEFAULTS, BATTERY_LIMITS, APP_NAME } from '../config.js';
import * as battery from '../services/battery.js';
import { notify } from '../services/notify.js';
import * as alarm from './alarm.js';
import * as morning from './morning.js';
import * as native from '../services/native.js';

let cfg = load('battery', BATTERY_DEFAULTS);

export const settings = () => ({ ...cfg });
export function setSetting(key, value) {
  if (key === 'enabled') { cfg.enabled = !!value; save('battery', cfg); return cfg.enabled; }
  const [lo, hi] = BATTERY_LIMITS[key];
  const n = Number(value);
  cfg[key] = clamp(Number.isFinite(n) ? Math.round(n) : cfg[key], lo, hi);
  // The floor must stay below the arming threshold.
  if (key === 'floor') cfg.floor = Math.min(cfg.floor, cfg.armBelow - 5);
  if (key === 'armBelow') cfg.armBelow = Math.max(cfg.armBelow, cfg.floor + 5);
  save('battery', cfg);
  return cfg[key];
}

// Before arming. ok:false means "warn first"; unknown:true means this browser can't read the battery.
export function armCheck() {
  const b = battery.get();
  if (!cfg.enabled || native.isNative()) return { ok: true };
  if (!b.supported) return { ok: true, unknown: true };
  if (b.charging || b.level >= cfg.armBelow) return { ok: true, level: b.level, charging: b.charging };
  return { ok: false, level: b.level, threshold: cfg.armBelow, floor: cfg.floor };
}

function check(b) {
  if (native.isNative()) return;
  if (!cfg.enabled || !b.supported || b.charging) return;
  if (b.level > cfg.floor) return;
  if (!alarm.status().armed || morning.isActive()) return;
  alarm.disarm();
  emit('guard:tripped', { level: b.level });
  notify(`${APP_NAME} paused`, `Battery at ${b.level}%. The alarm is off so your phone doesn't die. Set a backup alarm.`);
}

on('battery:changed', check);
on('alarm:changed', () => check(battery.get()));
