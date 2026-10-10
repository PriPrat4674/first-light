// The app's pictures instead of emoji.
//  icon(name):   plain line icons for actions and settings, drawn in the text colour.
//  weatherIcon(): the sky's condition, with the sun or moon in your accent colour.
//  motif(theme):  a small drawing that belongs to the theme: a houseboat for Kerala, the torch
//                 for New York, a torii gate for Tokyo… Used for celebrations and empty states.
// All original geometric drawings; no copied artwork.

const line = (paths, size = 22, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3 2 6M19 3l3 3"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4M6 10v4M10 10v4"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="14" cy="6" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M12 11.5c-2.8 0-5 3-5 5.2 0 1.6 1.2 2.3 2.6 2.3 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.4 0 2.6-.7 2.6-2.3 0-2.2-2.2-5.2-5-5.2z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  steps: '<path d="M8 3c-1.7 0-3 2-3 4.5S6 11 7.5 11 10 9.5 10 7 9.7 3 8 3zM6 13h3.5v2.2a1.75 1.75 0 0 1-3.5 0z"/><path d="M16 9c1.7 0 3 2 3 4.5S18 17 16.5 17 14 15.5 14 13s.3-4 2-4zM14.5 19H18v.6a1.75 1.75 0 0 1-3.5 0z"/>',
  shake: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 18h2M4.5 8v8M19.5 8v8M2 10.5v3M22 10.5v3"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 0-3-1-5.5.5-8z"/>',
  bed: '<path d="M3 18V6M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10" r="1.6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8M20 20v-4.5h-4.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  news: '<rect x="3" y="5" width="15" height="14" rx="1.5"/><path d="M18 9h3v8.5a1.5 1.5 0 0 1-3 0M6.5 9h8M6.5 12.5h8M6.5 16h5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".6"/><circle cx="15" cy="15" r=".6"/><circle cx="15" cy="9" r=".6"/><circle cx="9" cy="15" r=".6"/>',
  zzz: '<path d="M4 9h5l-5 6h5M13 4h4l-4 5h4M15 14h5l-5 6h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3v2a4 4 0 0 0 1.6 3.2L12 10l2.4-1.8A4 4 0 0 0 16 5V3M8 21v-2a4 4 0 0 1 1.6-3.2L12 14l2.4 1.8A4 4 0 0 1 16 19v2"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  phoneOff: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M3 3l18 18"/>',
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5c0 1 1 1.5 1 2.5M12 3.5c0 1 1 1.5 1 2.5"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l7-7"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  rocket: '<path d="M12 15c-2-2-3-5-1-9 2-2 5-3 9-3 0 4-1 7-3 9-4 2-7 1-9-1z"/><path d="M9 13l-4 1 2-4M11 15l-1 4 4-2M15 8h.01"/>',
  walk: '<circle cx="13" cy="4" r="1.8"/><path d="M10 21l2-6-2-3 1-4 3 2 3 1M12 15l3 2 1 4M11 8l-3 2-1 3"/>'
};

export const icon = (name, size = 22) => line(ICONS[name] || ICONS.info, size);

/* ---------- weather ---------- */
const CLOUD = 'M6.5 19h11a4.5 4.5 0 0 0 .5-9A6 6 0 0 0 6.6 11.5 3.8 3.8 0 0 0 6.5 19z';
const CLOUD_UP = 'M6.5 14.5h11a4.5 4.5 0 0 0 .5-9A6 6 0 0 0 6.6 7 3.8 3.8 0 0 0 6.5 14.5z';
const SUN_DISC = '<circle cx="12" cy="12" r="4.2" fill="var(--accent)" stroke="var(--accent-text)"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke="var(--accent-text)"/>';
const MOON_FILL = '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent-text)"/>';
const WEATHER = {
  clear: (day) => (day ? SUN_DISC : MOON_FILL),
  mostlyClear: (day) => (day ? SUN_DISC : MOON_FILL) + '<path d="M15 20h5" opacity=".6"/>',
  partly: (day) => `<g transform="translate(-3 -3) scale(.75)">${day ? SUN_DISC : MOON_FILL}</g><path d="M8 20h9.5a3.6 3.6 0 0 0 .4-7.2A4.8 4.8 0 0 0 8.6 14 3 3 0 0 0 8 20z" fill="var(--surface, transparent)"/>`,
  cloud: () => `<path d="${CLOUD}"/>`,
  fog: () => `<path d="${CLOUD_UP}"/><path d="M4 18h16M7 21.5h10"/>`,
  drizzle: () => `<path d="${CLOUD_UP}"/><path d="M8.5 18v.5M12.5 18v.5M16.5 18v.5M10.5 21v.5M14.5 21v.5"/>`,
  rain: () => `<path d="${CLOUD_UP}"/><path d="M9 17l-1.5 4M13 17l-1.5 4M17 17l-1.5 4"/>`,
  snow: () => `<path d="${CLOUD_UP}"/><path d="M8.5 18.5h.01M12 20.5h.01M15.5 18.5h.01M10 22.5h.01M14 22.5h.01" stroke-width="2.4"/>`,
  storm: () => `<path d="${CLOUD_UP}"/><path d="M13 15l-3 4h3l-2 4" stroke="var(--accent-text)"/>`
};
// kind: one of the keys above (places.describeWeather gives it).
export function weatherIcon(kind, isDay = true, size = 22) {
  return line((WEATHER[kind] || WEATHER.cloud)(isDay), size, 'ico wx-ico');
}

/* ---------- theme motifs (48×48) ---------- */
// Strokes use currentColor; the accent parts use `A` (swapped for a real colour when drawn on canvas).
const A = 'var(--accent)';
const MOTIFS = {
  kerala: {
    // A kettuvallam (houseboat) on the backwaters.
    main: `<path d="M2 29q22 9 44 0l-4 6.5H6z" fill="${A}" fill-opacity=".9"/><path d="M7 29.5v-5q17-11 34 0v5"/><path d="M13 30v-8M19 30.5v-10M25 30.5v-10.5M31 30.5v-10M37 30v-8M7 24.5h34" opacity=".75"/><path d="M44 29 47 15"/><path d="M5 41h9M18 42.5h12M33 41h9"/>`,
    // A nilavilakku, the brass oil lamp, three flames lit.
    alt: `<path d="M24 12q-2.6-3.6 0-8 2.6 4.4 0 8zM16.5 15q-1.8-2.6 0-5.6 1.8 3 0 5.6zM31.5 15q-1.8-2.6 0-5.6 1.8 3 0 5.6z" fill="${A}"/><path d="M13 16q11 6 22 0M16 16v1M32 16v1M24 19v18M21 24h6M20 30h8M15 42h18l-4-5H19z"/>`
  },
  newyork: {
    // Liberty's torch.
    main: `<path d="M24 3q6 5 3 11-3 3-6 0-3-6 3-11z" fill="${A}"/><path d="M16 15h16l-3.5 6h-9z"/><path d="M21 21h6v17h-6zM18 38h12v5H18z"/><path d="M21 27h6M21 33h6"/>`,
    // A yellow cab.
    alt: `<path d="M6 30v-6l5-7h20l6 7h5v6z" fill="${A}" fill-opacity=".85"/><path d="M6 30v-6l5-7h20l6 7h5v6zM12 24l3-5h7v5zM26 24v-5h4l3.5 5zM20 13h8v4h-8z"/><circle cx="13" cy="31" r="3.5"/><circle cx="34" cy="31" r="3.5"/>`
  },
  sanfrancisco: {
    // A Golden Gate tower with its cables.
    main: `<path d="M15 44V6M33 44V6" stroke="${A}" stroke-width="3"/><path d="M15 12q9-3 18 0M15 21q9-3 18 0M15 30q9-3 18 0"/><path d="M2 30q12-4 13-24M33 6q1 20 13 24M2 36h44"/><path d="M6 41h7M30 42h12"/>`,
    // A cable car on a hill.
    alt: `<path d="M8 33l32-10" opacity=".55"/><path d="M10 22h28v12H10z" fill="${A}" fill-opacity=".8"/><path d="M10 22h28v12H10zM8 22h32M14 26h5v4h-5zM21.5 26h5v4h-5zM29 26h5v4h-5zM24 22v-6M20 16h8"/><circle cx="15" cy="36" r="2"/><circle cx="33" cy="36" r="2"/>`
  },
  tokyo: {
    // A torii gate.
    main: `<path d="M5 9q19 5 38 0l-1.2 4.6Q24 17 6.2 13.6z" fill="${A}"/><path d="M10 19h28M14 13.5V44M34 13.5V44M22.5 14h3v5h-3zM11 44h6M31 44h6"/>`,
    // A sakura blossom.
    alt: `<g fill="${A}" fill-opacity=".85">${[0, 72, 144, 216, 288].map((r) => `<path transform="rotate(${r} 24 24)" d="M24 24q-7-6-4-13.5 2 1.5 4 .5 2 1 4-.5 3 7.5-4 13.5z"/>`).join('')}</g><circle cx="24" cy="24" r="2.4"/><path d="M24 21v-3M21.5 22.5l-2-2M26.5 22.5l2-2"/>`
  },
  seoul: {
    // N Seoul Tower on Namsan.
    main: `<path d="M3 44q21-11 42 0"/><path d="M22 38V19h4v19z"/><path d="M17 19h14l-2.5-6h-9z" fill="${A}"/><path d="M24 13V3M21 8h6"/>`,
    // A hanok roof with upturned eaves.
    alt: `<path d="M3 21q6 1 10-5h22q4 6 10 5l-4.5 4H7.5z" fill="${A}" fill-opacity=".85"/><path d="M3 21q6 1 10-5h22q4 6 10 5l-4.5 4H7.5zM9 25v17h30V25M21 42v-9h6v9M13 30h5v5h-5zM30 30h5v5h-5z"/>`
  },
  noir: {
    // An art-deco sunburst.
    main: `<path d="M12 34a12 12 0 0 1 24 0z" fill="${A}"/>${[-75, -50, -25, 0, 25, 50, 75].map((d) => `<path transform="rotate(${d} 24 34)" d="M24 19V8"/>`).join('')}<path d="M4 34h40M10 39h28"/>`,
    alt: `<path d="M14 40a10 10 0 0 1 20 0z" fill="${A}"/>${[-60, -30, 0, 30, 60].map((d) => `<path transform="rotate(${d} 24 40)" d="M24 27v-9"/>`).join('')}<path d="M6 40h36"/>`
  },
  ivory: {
    // A fountain-pen nib.
    main: `<path d="M24 4 14 20l4 20h12l4-20z" fill="${A}" fill-opacity=".85"/><path d="M24 4 14 20l4 20h12l4-20zM24 4v20"/><circle cx="24" cy="26" r="2.2"/><path d="M18 40h12v4H18z"/>`,
    alt: `<path d="M10 8h22l6 6v26H10z"/><path d="M32 8v6h6M15 20h18M15 26h18M15 32h11"/><path d="M15 14h10" stroke="${A}" stroke-width="2.4"/>`
  },
  midnight: {
    // A crescent moon with stars.
    main: `<path d="M34 30A13 13 0 1 1 20 10a10.5 10.5 0 0 0 14 20z" fill="${A}" fill-opacity=".85"/><path d="m36 8 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1zM40 22l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>`,
    alt: `<path d="M30 36A11 11 0 1 1 18 18a9 9 0 0 0 12 18z" fill="${A}" fill-opacity=".85"/><path d="m34 10 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z"/>`
  },
  dusk: {
    // A rose.
    main: `<path d="M24 26c-6 0-9-4-9-9 3 1 5 0 6-3 2 2 4 2 6 0 1 3 3 4 6 3 0 5-3 9-9 9z" fill="${A}" fill-opacity=".9"/><path d="M24 26c-6 0-9-4-9-9 3 1 5 0 6-3 2 2 4 2 6 0 1 3 3 4 6 3 0 5-3 9-9 9zM21 17q3 3 6 0M24 26v18M24 34q-6-1-8-6 6 0 8 6zM24 38q6-1 8-6-6 0-8 6z"/>`,
    alt: `<path d="M24 30c-5 0-8-3.5-8-8 2.5 1 4.5 0 5.5-2.5 1.7 1.7 3.3 1.7 5 0 1 2.5 3 3.5 5.5 2.5 0 4.5-3 8-8 8z" fill="${A}" fill-opacity=".9"/><path d="M24 30v14"/>`
  }
};

export function motif(theme, which = 'main', size = 48) {
  const m = MOTIFS[theme] || MOTIFS.noir;
  return `<svg class="motif motif-${theme}" viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m[which] || m.main}</svg>`;
}

// The same drawing as an image, for canvas (story card). Colours are baked in.
export function motifImage(theme, color, size = 120, which = 'main') {
  const svg = motif(theme, which, size).replaceAll('currentColor', color).replaceAll('var(--accent)', color);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
  });
}
