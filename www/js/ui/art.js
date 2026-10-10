// Artwork drawn in code: the four logos and Pip, the streak pet. Pure functions returning SVG.

export const LOGOS = [
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'crescent', label: 'Crescent' },
  { id: 'owl', label: 'Owl' },
  { id: 'bell', label: 'Bell' }
];

// c = { bg, fg, accent } colours. `framed` draws the rounded-square app tile.
export function logoSVG(id, c = {}, { framed = true, size = 64, label = '' } = {}) {
  const bg = c.bg || '#000000', fg = c.fg || '#F2EADB', ac = c.accent || '#C8A55E';
  const tile = framed ? `<rect x="0" y="0" width="100" height="100" rx="24" fill="${bg}"/>` : '';
  const art = {
    sunrise: `
      <g stroke="${ac}" stroke-width="3.2" stroke-linecap="round">
        ${[...Array(9)].map((_, i) => { const a = Math.PI + Math.PI * (i + 0.5) / 9; return `<line x1="${50 + 22 * Math.cos(a)}" y1="${64 + 22 * Math.sin(a)}" x2="${50 + 36 * Math.cos(a)}" y2="${64 + 36 * Math.sin(a)}"/>`; }).join('')}
      </g>
      <path d="M33 64a17 17 0 0 1 34 0z" fill="${ac}"/>
      <line x1="18" y1="65.5" x2="82" y2="65.5" stroke="${fg}" stroke-width="3" stroke-linecap="round"/>
      <path d="M40 76h20" stroke="${fg}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
    crescent: `
      <path d="M58 22a28 28 0 1 0 22 44a23 23 0 1 1-22-44z" fill="${fg}"/>
      <path d="M70 26l2.6 6.4 6.4 2.6-6.4 2.6L70 44l-2.6-6.4-6.4-2.6 6.4-2.6z" fill="${ac}"/>
      <circle cx="80" cy="50" r="2.2" fill="${ac}"/>`,
    owl: `
      <path d="M28 34l6-12 8 9M72 34l-6-12-8 9" fill="${ac}"/>
      <ellipse cx="50" cy="56" rx="26" ry="28" fill="${ac}"/>
      <ellipse cx="50" cy="64" rx="15" ry="16" fill="${fg}" opacity=".9"/>
      <circle cx="39" cy="47" r="9" fill="${bg}"/><circle cx="61" cy="47" r="9" fill="${bg}"/>
      <circle cx="40" cy="48" r="3.4" fill="${fg}"/><circle cx="60" cy="48" r="3.4" fill="${fg}"/>
      <path d="M31 37l15 6M69 37l-15 6" stroke="${bg}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M46 54l4 6 4-6z" fill="${bg}"/>`,
    bell: `
      <circle cx="50" cy="55" r="25" fill="none" stroke="${ac}" stroke-width="5"/>
      <path d="M24 34a10 10 0 0 1 14-12M76 34a10 10 0 0 0-14-12" fill="none" stroke="${ac}" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 42v14l9 6" fill="none" stroke="${fg}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M33 80l-5 6M67 80l5 6" stroke="${ac}" stroke-width="5" stroke-linecap="round"/>`
  }[id] || '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${label || id + ' logo'}">${tile}${art}</svg>`;
}

/* ---------------- Pip the owl ---------------- */
export const MOODS = ['ecstatic', 'happy', 'neutral', 'grumpy', 'sleepy', 'sulking'];

// c = { body, belly, ink, accent }
export function petSVG(mood = 'neutral', c = {}, { size = 120, label = '' } = {}) {
  const body = c.body || '#C8A55E', belly = c.belly || '#F2EADB', ink = c.ink || '#1B1407', ac = c.accent || '#E38E5A';
  const eyes = {
    ecstatic: `<path d="M34 50l3.4 6.8 7.4 1-5.4 5.2 1.3 7.4L34 66.9l-6.7 3.5 1.3-7.4-5.4-5.2 7.4-1z" fill="${ink}" transform="translate(4 -10) scale(.92)"/>
               <path d="M66 50l3.4 6.8 7.4 1-5.4 5.2 1.3 7.4L66 66.9l-6.7 3.5 1.3-7.4-5.4-5.2 7.4-1z" fill="${ink}" transform="translate(2 -10) scale(.92)"/>`,
    happy: `<path d="M32 52q6-8 12 0M56 52q6-8 12 0" fill="none" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/>`,
    neutral: `<circle cx="38" cy="50" r="9" fill="${belly}"/><circle cx="62" cy="50" r="9" fill="${belly}"/>
              <circle cx="39" cy="51" r="4" fill="${ink}"/><circle cx="61" cy="51" r="4" fill="${ink}"/>`,
    grumpy: `<circle cx="38" cy="51" r="9" fill="${belly}"/><circle cx="62" cy="51" r="9" fill="${belly}"/>
             <circle cx="39" cy="53" r="4" fill="${ink}"/><circle cx="61" cy="53" r="4" fill="${ink}"/>
             <path d="M28 40l16 7M72 40l-16 7" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
    sleepy: `<path d="M31 52h13M56 52h13" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/>`,
    sulking: `<circle cx="38" cy="52" r="9" fill="${belly}"/><circle cx="62" cy="52" r="9" fill="${belly}"/>
              <circle cx="38" cy="56" r="3.6" fill="${ink}"/><circle cx="62" cy="56" r="3.6" fill="${ink}"/>
              <path d="M29 47h18M53 47h18" stroke="${body}" stroke-width="7"/>
              <path d="M70 62q2 5-1 7q-3-2-1-7z" fill="#7FB7E8"/>`
  }[mood] || '';
  const beak = mood === 'grumpy' || mood === 'sulking'
    ? `<path d="M45 61h10l-5 5z" fill="${ac}"/>`
    : `<path d="M45 60h10l-5 7z" fill="${ac}"/>`;
  const cheeks = mood === 'ecstatic' || mood === 'happy' ? `<circle cx="29" cy="60" r="4" fill="${ac}" opacity=".45"/><circle cx="71" cy="60" r="4" fill="${ac}" opacity=".45"/>` : '';
  const sticker = {
    ecstatic: `<g class="pet-sticker"><path d="M50 4l10 20H40z" fill="${ac}"/><circle cx="50" cy="4" r="3" fill="${belly}"/><circle cx="45" cy="18" r="1.6" fill="${belly}"/><circle cx="54" cy="14" r="1.6" fill="${belly}"/></g>`,
    sleepy: `<g class="pet-sticker" fill="${belly}" font-family="Georgia,serif" font-weight="700"><text x="78" y="26" font-size="12">z</text><text x="86" y="16" font-size="9">z</text></g>`,
    grumpy: `<g class="pet-sticker" stroke="${belly}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".85"><path d="M18 24q-4-5 0-10M24 20q-4-5 0-10"/><path d="M82 24q4-5 0-10M76 20q4-5 0-10"/></g>`
  }[mood] || '';
  return `<svg class="pet pet-${mood}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${label || `Pip is ${mood}`}">
    ${sticker}
    <path d="M27 30l6-13 9 10M73 30l-6-13-9 10" fill="${body}"/>
    <g class="pet-wing pet-wing-l"><path d="M24 58q-12 8-6 24q8-4 12-14z" fill="${body}" filter="brightness(.9)"/></g>
    <g class="pet-wing pet-wing-r"><path d="M76 58q12 8 6 24q-8-4-12-14z" fill="${body}" filter="brightness(.9)"/></g>
    <ellipse cx="50" cy="58" rx="27" ry="30" fill="${body}"/>
    <ellipse cx="50" cy="68" rx="16" ry="17" fill="${belly}" opacity=".92"/>
    <path d="M42 70q8 6 16 0M44 77q6 4 12 0" fill="none" stroke="${body}" stroke-width="1.6" opacity=".55"/>
    ${eyes}${cheeks}${beak}
    <path d="M42 87l-3 5M58 87l3 5" stroke="${ac}" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
