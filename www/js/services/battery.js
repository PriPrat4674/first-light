// Reads the phone's battery level. Works in Chrome on Android; not available on iPhone.
import { emit } from '../core/events.js';

let info = { supported: false, level: null, charging: null };

export const get = () => ({ ...info });

function update(b) {
  info = { supported: true, level: Math.round(b.level * 100), charging: !!b.charging };
  emit('battery:changed', get());
}

export async function start() {
  if (!navigator.getBattery) { emit('battery:changed', get()); return; }
  try {
    const b = await navigator.getBattery();
    update(b);
    b.addEventListener('levelchange', () => update(b));
    b.addEventListener('chargingchange', () => update(b));
  } catch {
    emit('battery:changed', get());
  }
}
