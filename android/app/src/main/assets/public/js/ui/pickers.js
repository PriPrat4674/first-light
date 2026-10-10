// Appearance pickers shared by first-run setup and Settings.
import { esc, vibrateTap } from '../core/util.js';
import * as profile from '../features/profile.js';
import { LOGOS, logoSVG } from './art.js';
import { THEMES, ACCENTS, FONTS, STYLES, palette, artColours } from './theme.js';
import { SKYLINES } from './scene.js';

function option(kind, value, current, inner, label) {
  return `<button type="button" class="pick pick-${kind}" data-pick="${kind}" data-value="${value}" aria-pressed="${value === current}" aria-label="${esc(label)}">${inner}</button>`;
}

export function picker(kind, current = profile.get()[kind]) {
  const p = profile.get();
  if (kind === 'logo') {
    const c = artColours(p);
    return `<div class="picks picks-4">${LOGOS.map((l) => option('logo', l.id, current, `${logoSVG(l.id, { bg: c.bg, fg: c.fg, accent: c.accent }, { size: 64 })}<span>${l.label}</span>`, `${l.label} logo`)).join('')}</div>`;
  }
  if (kind === 'accent') {
    return `<div class="picks picks-4">${Object.entries(ACCENTS).map(([id, a]) => {
      const v = palette(p.theme, id);
      return option('accent', id, current, `<i class="swatch" style="background:linear-gradient(180deg, ${v['--accent-hi']}, ${v['--accent']})"></i><span>${a.label}</span>`, `${a.label} colour`);
    }).join('')}</div>`;
  }
  if (kind === 'theme') {
    const tile = ([id, t]) => {
      const v = palette(id, p.accent);
      const city = t.city && SKYLINES[id] ? `<svg class="mini-city" viewBox="0 120 400 80" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style="color:${t.text}">${SKYLINES[id]()}</svg>` : '';
      const mini = `<span class="mini" style="background:${t.bg};border-color:${t.hair2}"><b style="color:${t.text};font-family:${FONTS[p.font].family}">6:30</b><i style="background:${v['--accent']}"></i>${city || `<em style="background:${t.surface2}"></em>`}</span>`;
      return option('theme', id, current, `${mini}<span><strong>${t.label}</strong><small>${t.note}</small></span>`, `${t.label} theme`);
    };
    const all = Object.entries(THEMES);
    return `<p class="pick-group">Moods</p><div class="picks picks-2">${all.filter(([, t]) => !t.city).map(tile).join('')}</div>
      <p class="pick-group">Cities <span class="muted">· live weather & local news</span></p><div class="picks picks-2">${all.filter(([, t]) => t.city).map(tile).join('')}</div>`;
  }
  if (kind === 'font') {
    return `<div class="picks picks-2">${Object.entries(FONTS).map(([id, f]) => option('font', id, current,
      `<span class="font-sample" style="font-family:${f.family};font-weight:${f.weight}">Aa 6:30</span><span><strong>${f.label}</strong><small>${f.note}</small></span>`, `${f.label} font`)).join('')}</div>`;
  }
  if (kind === 'style') {
    const radius = { elegant: '12px', soft: '999px', bold: '6px' }, border = { elegant: '1px', soft: '0px', bold: '2px' };
    return `<div class="picks picks-3">${Object.entries(STYLES).map(([id, st]) => option('style', id, current,
      `<span class="style-sample" style="border-radius:${radius[id]};border-width:${border[id]}">Button</span><span><strong>${st.label}</strong><small>${st.note}</small></span>`, `${st.label} style`)).join('')}</div>`;
  }
  return '';
}

// Clicking any picker inside root saves the choice; onPick(kind, value) runs afterwards.
export function wirePickers(root, onPick = () => {}) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    vibrateTap();
    const { pick: kind, value } = b.dataset;
    if (profile.set(kind, value) === null) return;
    root.querySelectorAll(`[data-pick="${kind}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.value === value)));
    onPick(kind, value);
  });
}
