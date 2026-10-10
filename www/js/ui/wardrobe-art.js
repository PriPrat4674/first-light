// Pip's accessories, drawn to sit on the artwork in www/img/pip/. Every pose has its own spots
// (in a 0–100 box over the 512 px image): where the head top, eyes and neck are, and how it tilts.
// A null spot means that item isn't shown in that pose (no mug mid-leap, no scarf curled up asleep).

// [x, y, rotation°, scale]
const SPOTS = {
  happy:    { crown: [69, 14, 0, 1],    shades: [69.5, 31, -3, 1], scarf: [70, 52, 0, 1.05], mug: [91, 96], aura: [55, 55, 47] },
  neutral:  { crown: [70, 13, 0, 1],    shades: [70, 31, 0, 1],    scarf: [70, 52, 0, 1.05], mug: [92, 96], aura: [55, 55, 47] },
  ecstatic: { crown: [63, 14, 6, 0.95], shades: [65, 30, 6, 0.9],  scarf: [62, 50, 8, 0.9],  mug: null,     aura: [50, 52, 48] },
  grumpy:   { crown: [68, 12, 0, 1],    shades: [68.5, 32, 0, 1],  scarf: [68, 52, 0, 1.05], mug: [93, 97], aura: [55, 55, 47] },
  sleepy:   { crown: [66, 13, -4, 1],   shades: [66, 31, 4, 0.9],  scarf: [60, 56, 0, 1],    mug: [93, 96], aura: [55, 55, 47] },
  sulking:  { crown: [68, 12, 0, 1.05], shades: [68, 33, 0, 1],    scarf: [68, 51, 0, 1.05], mug: [92, 97], aura: [55, 55, 47] },
  wave:     { crown: [60, 11, 10, 0.95], shades: [63, 28, 12, 0.9], scarf: [62, 51, 8, 0.95], mug: [90, 96], aura: [52, 55, 47] },
  sleeping: { crown: [66, 21, 18, 0.85], shades: [77, 44, -20, 0.8], scarf: null,            mug: null,     aura: [55, 58, 46] },
  'leap-1': { crown: [28, 23, -8, 0.75], shades: null,             scarf: [33, 50, 35, 0.55], mug: null,     aura: [48, 52, 46] },
  'leap-2': { crown: [67, 10, 4, 0.95], shades: [68.5, 28, 4, 0.95], scarf: [66, 51, 0, 1],  mug: null,     aura: [55, 55, 47] }
};

// Each item is drawn around its own anchor (0,0): crown at its base, shades between the eyes,
// scarf at the front of the neck, mug at the bottom of its base.
const ART = {
  crown: `<path d="M-11 0-12.5-10.5-6-5 0-13 6-5 12.5-10.5 11 0Z" fill="#F2C14E" stroke="#9A6B12" stroke-width=".7" stroke-linejoin="round"/>
    <path d="M-9.5-1.5-10.4-8-6-4.2" fill="none" stroke="#FFE7A3" stroke-width=".6" stroke-linecap="round" opacity=".8"/>
    <rect x="-11.5" y="-2" width="23" height="3.4" rx="1.2" fill="#E0A82E" stroke="#9A6B12" stroke-width=".6"/>
    <circle cx="0" cy="-13" r="1.5" fill="#D64545"/><circle cx="-12.5" cy="-10.5" r="1.2" fill="#3D7DD8"/><circle cx="12.5" cy="-10.5" r="1.2" fill="#3D7DD8"/>
    <circle cx="0" cy="-.3" r="1.1" fill="#D64545"/><circle cx="-6" cy="-.3" r=".8" fill="#2E9E6B"/><circle cx="6" cy="-.3" r=".8" fill="#2E9E6B"/>`,
  shades: `<path d="M-3.4-1.4q3.4-1.8 6.8 0" fill="none" stroke="#111" stroke-width="1.1"/>
    <path d="M-15.6-2.2-19.5-3.4M15.6-2.2 19.5-3.4" stroke="#111" stroke-width="1" stroke-linecap="round"/>
    <rect x="-15.8" y="-4" width="12.4" height="8.2" rx="3.4" fill="#16161C" stroke="#000" stroke-width=".6" opacity=".94"/>
    <rect x="3.4" y="-4" width="12.4" height="8.2" rx="3.4" fill="#16161C" stroke="#000" stroke-width=".6" opacity=".94"/>
    <path d="M-13.6-2.4-10.6.4M5.6-2.4 8.6.4" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".45"/>`,
  scarf: `<path d="M-18-3q18 8 36 0l1.2 5.6q-19 8.4-38.4 0Z" fill="#C8423B" stroke="#7E211C" stroke-width=".6" stroke-linejoin="round"/>
    <path d="M-12-.6q12 4.6 24 0" fill="none" stroke="#F3E3C3" stroke-width=".9" stroke-dasharray="2.2 1.6"/>
    <path d="M5 3.4 7 18.5l6.2-.8-1.6-15.6Z" fill="#B53A33" stroke="#7E211C" stroke-width=".6" stroke-linejoin="round"/>
    <path d="M7.4 15.6 13 14.9" stroke="#F3E3C3" stroke-width=".9"/>
    <path d="M7.4 18.4 7 20.6M9.4 18.2 9.2 20.4M11.4 18 11.4 20.2M13.2 17.8 13.4 20" stroke="#7E211C" stroke-width=".55" stroke-linecap="round"/>`,
  mug: `<path d="M5.6-9.5q4.4 0 4.4 3.6T5.6-2.3" fill="none" stroke="#5A3B22" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M-6-12.5h11.6v10.2q0 2.3-2.3 2.3h-7q-2.3 0-2.3-2.3Z" fill="#F4EBDD" stroke="#5A3B22" stroke-width=".7"/>
    <ellipse cx="-.2" cy="-12.4" rx="5.6" ry="1.2" fill="#6B3E1F"/>
    <path d="M-3.4-5.6a3.2 3.2 0 0 1 6.4 0Z" fill="var(--accent, #C8A55E)"/><path d="M-4.4-5.6h8.4" stroke="#5A3B22" stroke-width=".5"/>
    <path class="steam" d="M-2.4-15.4q-1.4-2 0-3.8t0-3.8M1.8-15.4q-1.4-2 0-3.8t0-3.8" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".7"/>`
};

function aura([x, y, r]) {
  let ticks = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r0 = r + 1.5, r1 = r + (i % 2 ? 4 : 6.5);
    ticks += `M${(x + r0 * Math.cos(a)).toFixed(1)} ${(y + r0 * Math.sin(a)).toFixed(1)}L${(x + r1 * Math.cos(a)).toFixed(1)} ${(y + r1 * Math.sin(a)).toFixed(1)}`;
  }
  return `<svg class="pet-acc pet-acc-aura" viewBox="-8 -8 116 116" aria-hidden="true">
    <defs><radialGradient id="pip-aura-g"><stop offset=".55" stop-color="#F6C25B" stop-opacity=".0"/><stop offset=".82" stop-color="#F6C25B" stop-opacity=".38"/><stop offset="1" stop-color="#F6C25B" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${x}" cy="${y}" r="${r + 7}" fill="url(#pip-aura-g)"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#F2B544" stroke-width=".9" stroke-dasharray="2.6 3.2" opacity=".85"/>
    <path d="${ticks}" stroke="#F2B544" stroke-width="1.1" stroke-linecap="round" opacity=".85"/></svg>`;
}

// Layers for one pose: { back, front } markup to put behind and in front of the image.
export function accessoryLayers(pose, item) {
  const spot = SPOTS[pose]?.[item];
  if (!spot || item === 'none') return { back: '', front: '' };
  if (item === 'aura') return { back: aura(spot), front: '' };
  const [x, y, rot = 0, s = 1] = spot;
  return { back: '', front: `<svg class="pet-acc pet-acc-${item}" viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${ART[item]}</g></svg>` };
}

// A small picture of just the item, for the wardrobe picker.
export function accessoryIcon(item, size = 40) {
  if (item === 'none') return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55"/><path d="M12 28 28 12" stroke="currentColor" stroke-width="1.6" opacity=".55"/></svg>`;
  if (item === 'aura') return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="#F2B544" stroke-width="1.4" stroke-dasharray="3 3"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4; return `<path d="M${(20 + 13 * Math.cos(a)).toFixed(1)} ${(20 + 13 * Math.sin(a)).toFixed(1)}L${(20 + 17 * Math.cos(a)).toFixed(1)} ${(20 + 17 * Math.sin(a)).toFixed(1)}" stroke="#F2B544" stroke-width="1.6" stroke-linecap="round"/>`; }).join('')}</svg>`;
  const fit = { crown: 'translate(20 27) scale(1.25)', shades: 'translate(20 20) scale(.95)', scarf: 'translate(20 13) scale(.8)', mug: 'translate(19 31) scale(1.55)' }[item];
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><g transform="${fit}">${ART[item]}</g></svg>`;
}
