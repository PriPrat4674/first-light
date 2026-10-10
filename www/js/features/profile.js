// Who you are and how you like the app to look. Set during first-run setup, editable in Settings.
import { load, save } from '../core/storage.js';
import { emit } from '../core/events.js';

export const CHOICES = {
  logo: ['sunrise', 'crescent', 'tiger', 'bell'],
  accent: ['gold', 'rose', 'sage', 'sky'],
  theme: ['noir', 'ivory', 'midnight', 'dusk', 'newyork', 'sanfrancisco', 'kerala', 'tokyo', 'seoul'],
  font: ['classic', 'modern', 'friendly', 'typewriter', 'techy', 'kids', 'formal', 'noir'],
  style: ['elegant', 'soft', 'bold'],
  accessory: ['none', 'mug', 'scarf', 'shades', 'crown', 'aura']
};

const DEFAULTS = { name: '', petName: 'Pip', logo: 'sunrise', accent: 'gold', theme: 'noir', font: 'classic', style: 'elegant', onboarded: false, accessory: 'none', pipVoiceEnabled: true };
let p = load('profile', DEFAULTS);
if (p.logo === 'owl') p.logo = 'tiger'; // Pip used to be an owl
p.accessory ??= 'none';
p.pipVoiceEnabled ??= true;
// Repair anything unknown (e.g. data from an older version).
for (const [k, list] of Object.entries(CHOICES)) if (!list.includes(p[k])) p[k] = DEFAULTS[k];

export const get = () => ({ ...p });
const cleanName = (v, fallback) => {
  const s = String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return s || fallback;
};

// Returns the saved value, or null if it was rejected.
export function set(key, value) {
  if (key === 'name') p.name = cleanName(value, '');
  else if (key === 'petName') p.petName = cleanName(value, 'Pip');
  else if (key === 'onboarded') p.onboarded = !!value;
  else if (key === 'pipVoiceEnabled') p.pipVoiceEnabled = !!value;
  else if (CHOICES[key]) { if (!CHOICES[key].includes(value)) return null; p[key] = value; }
  else return null;
  save('profile', p);
  emit('profile:changed', get());
  return p[key];
}

export function setMany(values) {
  for (const [k, v] of Object.entries(values)) set(k, v);
  return get();
}
