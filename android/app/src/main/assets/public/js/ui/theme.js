// Applies the chosen theme, accent colour, font and style to the whole app.
// Accent shades are tuned per theme so text always meets WCAG AA contrast (4.5:1).
import { on } from '../core/events.js';
import * as profile from '../features/profile.js';
import * as native from '../services/native.js';

export const THEMES = {
  noir:     { label: 'Noir', note: 'True black. Kindest to your battery.', dark: true,  bg: '#000000', surface: '#0E0D0A', surface2: '#17150F', hair: '#2A261C', hair2: '#3D3727', text: '#F2EADB', text2: '#CBC1AA', muted: '#958C75' },
  ivory:    { label: 'Ivory', note: 'Warm paper, like a good notebook.', dark: false, bg: '#F6F1E7', surface: '#FFFDF8', surface2: '#EFE8DA', hair: '#E2D8C6', hair2: '#CBBEA6', text: '#1D1A14', text2: '#463F33', muted: '#665D4C' },
  midnight: { label: 'Midnight', note: 'Deep navy, calm at night.', dark: true,  bg: '#080E1F', surface: '#0F182E', surface2: '#16213C', hair: '#22304F', hair2: '#324368', text: '#E9EEF8', text2: '#B7C2DA', muted: '#8592AF' },
  dusk:     { label: 'Dusk', note: 'Plum and rose, soft and cosy.', dark: true,  bg: '#160D1B', surface: '#211428', surface2: '#2B1B34', hair: '#3A2646', hair2: '#4D345D', text: '#F6EAF1', text2: '#D7C0CE', muted: '#A88FA1' },
  // City themes: each also gets a skyline, live weather and a local headline (features/places.js).
  newyork:  { label: 'New York', note: 'Steel skyline nights', city: true, dark: true,  bg: '#0A0E14', surface: '#121922', surface2: '#1A2330', hair: '#25303E', hair2: '#364456', text: '#EEF2F7', text2: '#BCC7D4', muted: '#8B98A9' },
  sanfrancisco: { label: 'San Francisco', note: 'Fog and bridge orange', city: true, dark: false, bg: '#ECEFF2', surface: '#FFFFFF', surface2: '#E1E6EB', hair: '#D2D9E0', hair2: '#B7C1CB', text: '#141A20', text2: '#38424C', muted: '#56616C' },
  kerala:   { label: 'Kerala', note: 'Backwaters and palms', city: true, dark: true,  bg: '#05130C', surface: '#0B1E14', surface2: '#11281C', hair: '#1C3828', hair2: '#2A4C39', text: '#EEF5E8', text2: '#C2D6BF', muted: '#8EA790' },
  tokyo:    { label: 'Tokyo', note: 'Indigo nights, sakura', city: true, dark: true,  bg: '#0C0A1D', surface: '#15122C', surface2: '#1D193A', hair: '#29244E', hair2: '#3A3466', text: '#F4EFF9', text2: '#D0C7E1', muted: '#9C92B7' },
  seoul:    { label: 'Seoul', note: 'Hanji paper and hills', city: true, dark: false, bg: '#F3EFE7', surface: '#FFFDF8', surface2: '#E9E2D5', hair: '#DCD2C1', hair2: '#C4B7A1', text: '#1A1B1E', text2: '#42454B', muted: '#5F6269' }
};

export const ACCENTS = {
  gold: { label: 'Gold', h: 40, s: 50 },
  rose: { label: 'Rose', h: 350, s: 58 },
  sage: { label: 'Sage', h: 125, s: 24 },
  sky:  { label: 'Sky', h: 205, s: 62 }
};

export const FONTS = {
  classic:    { label: 'Classic', note: 'Bodoni & Garamond', family: "'Bodoni Moda', serif", weight: 600 },
  modern:     { label: 'Modern', note: 'DM Serif & DM Sans', family: "'DM Serif Display', serif", weight: 400 },
  friendly:   { label: 'Friendly', note: 'Rounded Nunito', family: "'Nunito', sans-serif", weight: 800 },
  typewriter: { label: 'Typewriter', note: 'Courier Prime', family: "'Courier Prime', monospace", weight: 700 },
  techy:      { label: 'Techy', note: 'Space Grotesk, mono clock', family: "'Space Grotesk', sans-serif", weight: 700 },
  kids:       { label: 'Kids’ favourite', note: 'Round, bubbly Fredoka', family: "'Fredoka', sans-serif", weight: 600 },
  formal:     { label: 'Formal', note: 'Engraved Cinzel', family: "'Cinzel', serif", weight: 600 },
  noir:       { label: 'Classic noir', note: '1930s film posters', family: "'Limelight', serif", weight: 400 }
};

export const STYLES = {
  elegant: { label: 'Elegant', note: 'Fine lines, quiet corners' },
  soft:    { label: 'Soft', note: 'Round and cushioned' },
  bold:    { label: 'Bold', note: 'Strong edges, thick lines' }
};

/* ---------- colour maths ---------- */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
// Walks lightness from `start` in `dir` until the colour reaches `min` contrast against `against`.
// `against` may be one colour or a list (page, card, raised card): it must pass on all of them.
function solve(h, s, start, dir, against, min) {
  const list = Array.isArray(against) ? against : [against];
  for (let l = start; l >= 3 && l <= 97; l += dir) {
    const c = hslToHex(h, s, l);
    if (list.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return dir > 0 ? '#FFFFFF' : '#000000';
}

export function palette(themeId, accentId) {
  const t = THEMES[themeId] || THEMES.noir;
  const a = ACCENTS[accentId] || ACCENTS.gold;
  const onAccent = '#15110A';
  const accent = solve(a.h, a.s, t.dark ? 60 : 62, 1, onAccent, 7);        // button fill, dark text on top
  const accentHi = hslToHex(a.h, a.s, Math.min(88, parseFloat(accentL(accent, a)) + 12));
  const grounds = [t.bg, t.surface, t.surface2];
  const accentText = t.dark ? solve(a.h, a.s + 8, 66, 1, grounds, 4.6) : solve(a.h, a.s + 10, 38, -1, grounds, 4.6);
  const accentLine = t.dark ? hslToHex(a.h, a.s - 10, 34) : hslToHex(a.h, a.s - 10, 66);
  const danger = t.dark ? solve(4, 55, 58, 1, grounds, 4.6) : solve(4, 62, 42, -1, grounds, 4.6);
  return {
    '--bg': t.bg, '--surface': t.surface, '--surface-2': t.surface2, '--hair': t.hair, '--hair-2': t.hair2,
    '--text': t.text, '--text-2': t.text2, '--muted': t.muted,
    '--accent': accent, '--accent-hi': accentHi, '--accent-text': accentText, '--accent-line': accentLine, '--on-accent': onAccent,
    '--warm': t.dark ? '#E38E5A' : '#B4552A', '--danger': danger, '--danger-line': t.dark ? '#6E1F21' : '#E4B2AC', '--ok': t.dark ? '#98B48E' : '#3F6B35'
  };
}
function accentL(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return ((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100;
}

/* ---------- apply ---------- */
export function apply(p = profile.get()) {
  const root = document.documentElement;
  const vars = palette(p.theme, p.accent);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = p.theme;
  root.dataset.accent = p.accent;
  root.dataset.font = p.font;
  root.dataset.style = p.style;
  root.style.colorScheme = THEMES[p.theme].dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg']);
  native.setStatusBar(THEMES[p.theme].dark);
  return vars;
}

// Colours for drawing the logo and Pip in the current theme.
export function artColours(p = profile.get()) {
  const v = palette(p.theme, p.accent);
  return { bg: v['--bg'], fg: v['--text'], accent: v['--accent'], body: v['--accent'], belly: THEMES[p.theme].dark ? '#F2EADB' : '#FFFDF8', ink: '#1B1407' };
}

let lastLogo = null;
export function init() {
  apply();
  lastLogo = profile.get().logo;
  on('profile:changed', (p) => {
    apply(p);
    if (p.logo !== lastLogo) { lastLogo = p.logo; native.setIcon(p.logo); }
  });
}
