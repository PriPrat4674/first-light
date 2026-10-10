// Pip's wardrobe: accessories you unlock with your best streak. Once unlocked, always unlocked.
import * as profile from './profile.js';
import * as stats from './stats.js';

export const ITEMS = [
  { id: 'mug', label: 'Mug', days: 7 },
  { id: 'scarf', label: 'Scarf', days: 14 },
  { id: 'shades', label: 'Shades', days: 30 },
  { id: 'crown', label: 'Crown', days: 50 },
  { id: 'aura', label: 'Aura', days: 100 }
];

const best = () => Math.max(stats.get().best || 0, stats.currentStreak());
export const isUnlocked = (id) => id === 'none' || (ITEMS.find((i) => i.id === id)?.days ?? Infinity) <= best();

// What Pip is wearing right now. A locked choice (e.g. from an old backup) shows nothing.
export function wearing() {
  const a = profile.get().accessory || 'none';
  return isUnlocked(a) ? a : 'none';
}

export function wear(id) {
  if (!isUnlocked(id)) return null;
  return profile.set('accessory', id);
}
