// The whole-app sky. Behind every screen sits a soft gradient that follows the time of day where
// your theme lives (dawn rose, noon blue, golden-hour amber, dusk violet, plain night), and for the
// city themes, that city's live weather (rain, fog, cloud, snow, storms).
// Tints are gentle and checked against the theme's text colours, so contrast never drops.
// Noir stays true black at night, as promised to OLED batteries.
import { on } from '../core/events.js';
import * as profile from '../features/profile.js';
import { skyNow } from '../features/daylight.js';
import { skyState } from './scene.js';
import { palette, THEMES, contrast } from './theme.js';

// Per phase: [top colour, strength], [bottom colour, strength]. 'A' = accent, 'W' = warm.
const DARK = {
  night: null,
  dawn: [['#3B2E5A', 0.22], ['#E9967A', 0.24]],
  morning: [['#4F7FB8', 0.16], ['A', 0.16]],
  noon: [['#5E9AD6', 0.2], ['#8DB8E0', 0.1]],
  afternoon: [['#5E9AD6', 0.15], ['A', 0.12]],
  golden: [['#6B4A7A', 0.14], ['W', 0.26]],
  dusk: [['#2A2350', 0.2], ['#8E6AAE', 0.2]]
};
const LIGHT = {
  night: [['#1E2A4A', 0.12], ['#1E2A4A', 0.05]],
  dawn: [['#B7A6D6', 0.16], ['#E9967A', 0.16]],
  morning: [['#9EC3EA', 0.18], ['A', 0.1]],
  noon: [['#8EC0F0', 0.22], ['#CFE3F5', 0.12]],
  afternoon: [['#8EC0F0', 0.16], ['A', 0.1]],
  golden: [['#C9A9C9', 0.14], ['W', 0.16]],
  dusk: [['#7C6BA8', 0.16], ['#C58FB0', 0.12]]
};
const WEATHER = { rain: ['#5A6B7D', 0.22], storm: ['#3A4352', 0.3], fog: ['#9AA3AD', 0.24], snow: ['#D4DEE8', 0.18], cloud: ['#7D8794', 0.14] };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t));

let layer = null, lastKey = '';

// Works out the three gradient stops for now. Exported for tests.
export function skyColours(themeId, accentId, phase, fx) {
  const t = THEMES[themeId] || THEMES.noir;
  const v = palette(themeId, accentId);
  const bg = v['--bg'];
  if (themeId === 'noir' && phase === 'night' && !fx) return { top: bg, mid: bg, low: bg };
  const plan = (t.dark ? DARK : LIGHT)[phase];
  const pick = (c) => (c === 'A' ? v['--accent'] : c === 'W' ? v['--warm'] : c);
  // Weaken the tint until every stop keeps the theme's text readable.
  for (let k = 1; k > 0.05; k *= 0.8) {
    let top = plan ? mix(bg, pick(plan[0][0]), plan[0][1] * k) : bg;
    let low = plan ? mix(bg, pick(plan[1][0]), plan[1][1] * k) : bg;
    if (fx && WEATHER[fx]) { const [c, s] = WEATHER[fx]; top = mix(top, c, s * k); low = mix(low, c, s * k * 0.6); }
    const mid = mix(top, low, 0.5);
    const ok = [top, mid, low].every((c) => contrast(v['--text'], c) >= 7 && contrast(v['--accent-text'], c) >= 4.5 && contrast(v['--muted'], c) >= 3);
    if (ok) return { top, mid, low };
  }
  return { top: bg, mid: bg, low: bg };
}

export function paint(now = Date.now(), force = false) {
  if (!layer) return;
  const p = profile.get();
  const { mins, rise, set, fx } = skyNow(now);
  const phase = skyState(mins, rise, set).phase;
  const key = `${p.theme}|${p.accent}|${phase}|${fx}`;
  if (!force && key === lastKey) return;
  lastKey = key;
  const c = skyColours(p.theme, p.accent, phase, fx);
  const root = document.documentElement;
  root.style.setProperty('--sky-top', c.top);
  root.style.setProperty('--sky-low', c.low);
  root.style.setProperty('--sky-bg', `linear-gradient(180deg, ${c.top} 0%, ${c.mid} 55%, ${c.low} 100%)`);
  root.dataset.skyPhase = phase;
  if (fx) root.dataset.skyFx = fx; else delete root.dataset.skyFx;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.top);
}

export function init() {
  layer = document.createElement('div');
  layer.id = 'sky-bg';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="sky-fx"></div>';
  document.body.prepend(layer);
  document.documentElement.classList.add('sky-on');
  paint(Date.now(), true);
  on('tick', ({ now }) => { if (now % 60_000 < 1000) paint(now); });
  on('profile:changed', () => paint(Date.now(), true));
  on('place:changed', () => paint(Date.now(), true));
}
