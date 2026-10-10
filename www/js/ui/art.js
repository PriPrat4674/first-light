// Artwork drawn in code: the four logos and Pip, the streak pet (an original baby tiger cub).
// Pure functions returning SVG.

export const LOGOS = [
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'crescent', label: 'Crescent' },
  { id: 'tiger', label: 'Tiger' },
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
    tiger: `
      <circle cx="29" cy="32" r="10" fill="${ac}"/><circle cx="71" cy="32" r="10" fill="${ac}"/>
      <circle cx="29" cy="32" r="4.6" fill="${bg}"/><circle cx="71" cy="32" r="4.6" fill="${bg}"/>
      <circle cx="50" cy="56" r="28" fill="${ac}"/>
      <path d="M50 30v9M42 32l2 7M58 32l-2 7M23 52h8M24 60h6M77 52h-8M76 60h-6" stroke="${bg}" stroke-width="3.2" stroke-linecap="round"/>
      <ellipse cx="50" cy="66" rx="15" ry="10" fill="${fg}"/>
      <circle cx="40" cy="51" r="3.6" fill="${bg}"/><circle cx="60" cy="51" r="3.6" fill="${bg}"/>
      <path d="M46 60h8l-4 4.5z" fill="${bg}"/>
      <path d="M50 64.5q-3 4-6.5 2M50 64.5q3 4 6.5 2" fill="none" stroke="${bg}" stroke-width="1.8" stroke-linecap="round"/>`,
    bell: `
      <circle cx="50" cy="55" r="25" fill="none" stroke="${ac}" stroke-width="5"/>
      <path d="M24 34a10 10 0 0 1 14-12M76 34a10 10 0 0 0-14-12" fill="none" stroke="${ac}" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 42v14l9 6" fill="none" stroke="${fg}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M33 80l-5 6M67 80l5 6" stroke="${ac}" stroke-width="5" stroke-linecap="round"/>`
  }[id] || '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${label || id + ' logo'}">${tile}${art}</svg>`;
}

/* ---------------- Pip the tiger cub ---------------- */
export const MOODS = ['ecstatic', 'happy', 'neutral', 'grumpy', 'sleepy', 'sulking'];

// A chubby baby tiger: big head, round ears, three forehead stripes, cream muzzle and belly.
// Tigers are orange whatever the theme; the accent colour is used for small touches (party hat).
const FUR = '#E9893B', FUR_DARK = '#C96E26', STRIPE = '#2A1A10', CREAM = '#FBEFD9', NOSE = '#C65F55', BLUSH = '#F39A8F';

// c = { accent, ink }
export function petSVG(mood = 'neutral', c = {}, { size = 120, label = '', accessory = 'none' } = {}) {
  const ink = c.ink || '#1B1407', ac = c.accent || '#C8A55E';
  const eyes = {
    ecstatic: `<path d="M41 39l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill="${ink}"/>
               <path d="M59 39l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill="${ink}"/>`,
    happy: `<path d="M36.5 46q4.5-6 9 0M54.5 46q4.5-6 9 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    neutral: `<ellipse cx="41" cy="45" rx="3.6" ry="4.4" fill="${ink}"/><ellipse cx="59" cy="45" rx="3.6" ry="4.4" fill="${ink}"/>
              <circle cx="42.2" cy="43.4" r="1.3" fill="#fff"/><circle cx="60.2" cy="43.4" r="1.3" fill="#fff"/>`,
    grumpy: `<ellipse cx="41" cy="47" rx="3.4" ry="3" fill="${ink}"/><ellipse cx="59" cy="47" rx="3.4" ry="3" fill="${ink}"/>
             <path d="M35 39.5l10 4M65 39.5l-10 4" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    sleepy: `<path d="M36.5 46h9M54.5 46h9" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    sulking: `<ellipse cx="41" cy="48" rx="3.2" ry="3.6" fill="${ink}"/><ellipse cx="59" cy="48" rx="3.2" ry="3.6" fill="${ink}"/>
              <path d="M36 42.5h9.5M54.5 42.5h9.5" stroke="${FUR_DARK}" stroke-width="2.6" stroke-linecap="round"/>
              <path d="M64.5 51q2 5-1 7q-3-2-1-7z" fill="#7FB7E8"/>`
  }[mood] || '';
  const mouth = {
    ecstatic: `<path d="M44 57q6 8 12 0z" fill="${NOSE}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
    happy: `<path d="M50 55.5q-3 4-6.5 2M50 55.5q3 4 6.5 2" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    grumpy: `<path d="M45 60q5-4 10 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    sulking: `<path d="M45.5 60q4.5-3 9 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`,
    sleepy: `<ellipse cx="50" cy="58.5" rx="2.4" ry="2.8" fill="${ink}" opacity=".85"/>`
  }[mood] || `<path d="M50 55.5q-3 3.5-6 1.8M50 55.5q3 3.5 6 1.8" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  const cheeks = mood === 'ecstatic' || mood === 'happy' ? `<circle cx="33" cy="53" r="3.6" fill="${BLUSH}" opacity=".55"/><circle cx="67" cy="53" r="3.6" fill="${BLUSH}" opacity=".55"/>` : '';
  const sticker = {
    ecstatic: `<g class="pet-sticker"><path d="M50 2l9 16H41z" fill="${ac}"/><circle cx="50" cy="2.5" r="2.8" fill="${CREAM}"/><circle cx="46" cy="13" r="1.4" fill="${CREAM}"/><circle cx="53" cy="10" r="1.4" fill="${CREAM}"/></g>`,
    sleepy: `<g class="pet-sticker" fill="${CREAM}" stroke="${STRIPE}" stroke-width=".6" font-family="Georgia,serif" font-weight="700"><text x="78" y="22" font-size="12">z</text><text x="87" y="12" font-size="9">z</text></g>`,
    grumpy: `<g class="pet-sticker" stroke="${FUR_DARK}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".9"><path d="M14 24q-4-5 0-10M20 20q-4-5 0-10"/><path d="M86 24q4-5 0-10M80 20q4-5 0-10"/></g>`
  }[mood] || '';

  const accLayer = {
    mug: `<g class="pet-acc-mug"><rect x="62" y="74" width="13" height="15" rx="3.5" fill="#C0392B" stroke="${ink}" stroke-width="1.2"/><path d="M75 77h3.5q2 0 2 3.5t-2 3.5h-3.5" fill="none" stroke="#C0392B" stroke-width="2.2" stroke-linecap="round"/><path d="M66 70q1.5 -3 3 -1.5t2.5 -3" fill="none" stroke="${CREAM}" stroke-width="1.2" stroke-linecap="round" opacity="0.85"/></g>`,
    scarf: `<g class="pet-acc-scarf"><path d="M30 63q20 7 40 0q3 7-5 9q-15 3-30 0z" fill="#E74C3C" stroke="${ink}" stroke-width="1.2"/><rect x="58" y="66" width="9" height="17" rx="2" fill="#C0392B" stroke="${ink}" stroke-width="1.2"/><line x1="58" y1="81" x2="67" y2="81" stroke="#F1C40F" stroke-width="1.8"/></g>`,
    shades: `<g class="pet-acc-shades"><path d="M33 39h16v10q-8 2-16 0z" fill="#1A1A1A" stroke="${ink}" stroke-width="1.2"/><path d="M51 39h16v10q-8 2-16 0z" fill="#1A1A1A" stroke="${ink}" stroke-width="1.2"/><line x1="49" y1="43" x2="51" y2="43" stroke="#555" stroke-width="2"/><line x1="35" y1="41" x2="42" y2="47" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/></g>`,
    crown: `<g class="pet-acc-crown"><path d="M37 23l3 -11l10 5l10 -5l3 11z" fill="#F1C40F" stroke="#D4AC0D" stroke-width="1.4"/><circle cx="40" cy="12" r="2" fill="#E74C3C"/><circle cx="50" cy="17" r="2.2" fill="#3498DB"/><circle cx="60" cy="12" r="2" fill="#E74C3C"/></g>`,
    aura: `<g class="pet-acc-aura" stroke="#F39C12" stroke-width="1.8" stroke-linecap="round" opacity="0.85"><circle cx="50" cy="50" r="47" fill="none" stroke-dasharray="4,6" opacity="0.6"/><line x1="50" y1="2" x2="50" y2="6"/><line x1="84" y1="16" x2="81" y2="19"/><line x1="98" y1="50" x2="94" y2="50"/><line x1="84" y1="84" x2="81" y2="81"/><line x1="16" y1="16" x2="19" y2="19"/><line x1="2" y1="50" x2="6" y2="50"/><line x1="16" y1="84" x2="19" y2="81"/></g>`
  }[accessory] || '';

  return `<svg class="pet pet-${mood}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${label || `Pip is ${mood}`}">
    ${accLayer.includes('pet-acc-aura') ? accLayer : ''}
    ${sticker}
    <g class="pet-tail"><path d="M68 84q18 2 20-14q1-8-5-11" fill="none" stroke="${FUR}" stroke-width="6" stroke-linecap="round"/>
      <path d="M86.4 76.5l-5-2M88.2 68.5l-5.2.2" stroke="${STRIPE}" stroke-width="2.2" stroke-linecap="round"/><circle cx="83" cy="59" r="3.6" fill="${STRIPE}"/></g>
    <ellipse cx="50" cy="76" rx="22" ry="17" fill="${FUR}"/>
    <path d="M30 72q5 1 7 4M70 72q-5 1-7 4M31 81q4 0 6 3M69 81q-4 0-6 3" fill="none" stroke="${STRIPE}" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="50" cy="79" rx="11.5" ry="11" fill="${CREAM}"/>
    <ellipse cx="40" cy="91" rx="7" ry="4.5" fill="${CREAM}"/><ellipse cx="60" cy="91" rx="7" ry="4.5" fill="${CREAM}"/>
    <g class="pet-paw pet-paw-l"><ellipse cx="38" cy="83" rx="5.5" ry="4.6" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="1"/></g>
    <g class="pet-paw pet-paw-r"><ellipse cx="62" cy="83" rx="5.5" ry="4.6" fill="${CREAM}" stroke="${FUR_DARK}" stroke-width="1"/></g>
    <circle cx="29" cy="25" r="9" fill="${FUR}"/><circle cx="71" cy="25" r="9" fill="${FUR}"/>
    <circle cx="29.5" cy="25.5" r="4.4" fill="${STRIPE}"/><circle cx="70.5" cy="25.5" r="4.4" fill="${STRIPE}"/>
    <circle cx="50" cy="45" r="24" fill="${FUR}"/>
    <path d="M50 22v8M43 23.5l2 6M57 23.5l-2 6M26.5 41h6.5M27 48h5M73.5 41H67M73 48h-5" stroke="${STRIPE}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="50" cy="56" rx="13" ry="8.5" fill="${CREAM}"/>
    ${cheeks}${eyes}
    <path d="M46.5 51.5h7l-3.5 4z" fill="${NOSE}"/>
    ${mouth}
    ${accLayer && !accLayer.includes('pet-acc-aura') ? accLayer : ''}
  </svg>`;
}
