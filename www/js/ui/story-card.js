// A 1080×1920 story image of a real proven morning, in your theme's colours and fonts.
import { toast } from '../core/util.js';
import * as profile from '../features/profile.js';
import * as stats from '../features/stats.js';
import { doneMessage } from '../features/messages.js';
import { saveOrShare } from '../services/files.js';
import { palette, FONTS, THEMES } from './theme.js';
import { artSrc, hasArt } from './pet-view.js';
import { motifImage } from './icons.js';

const W = 1080, H = 1920;

function loadImage(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

// result: { letter, mins, snoozes } from a proven morning. Returns a PNG blob.
export async function createStoryCardBlob(result) {
  const p = profile.get();
  const v = palette(p.theme, p.accent);
  const dark = THEMES[p.theme]?.dark !== false;
  const display = FONTS[p.font]?.family || 'serif';
  const weight = FONTS[p.font]?.weight || 600;
  const body = getComputedStyle(document.documentElement).getPropertyValue('--body').trim() || 'serif';
  await Promise.all([document.fonts?.load(`${weight} 80px ${display}`), document.fonts?.load(`400 40px ${body}`)].map((x) => x?.catch?.(() => {})));

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Sky: the theme's background melting into a sunrise glow at the bottom.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, v['--bg']);
  g.addColorStop(0.55, v['--surface']);
  g.addColorStop(1, dark ? mix(v['--bg'], v['--accent'], 0.35) : mix(v['--bg'], v['--accent'], 0.25));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W / 2, 1500, 40, W / 2, 1500, 700);
  sun.addColorStop(0, hexA(v['--accent'], 0.45)); sun.addColorStop(1, hexA(v['--accent'], 0));
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = v['--accent-text'];
  ctx.font = `${weight} 40px ${display}`;
  ctx.fillText('FIRST LIGHT', W / 2, 170);

  // Pip, celebrating (or soldiering on).
  const pose = result.letter?.startsWith('A') ? 'ecstatic' : 'happy';
  const pip = hasArt(pose) ? await loadImage(artSrc(pose)) : null;
  if (pip) ctx.drawImage(pip, W / 2 - 300, 250, 600, 600);

  ctx.fillStyle = v['--accent-text'];
  ctx.font = `${weight} 300px ${display}`;
  ctx.fillText(result.letter, W / 2, 1150);

  ctx.fillStyle = v['--text'];
  ctx.font = `${weight} 64px ${display}`;
  ctx.fillText('Morning proven', W / 2, 1260);
  ctx.fillStyle = v['--text-2'];
  ctx.font = `400 40px ${body}`;
  wrap(ctx, doneMessage(result.letter, p.name), W / 2, 1330, 820, 52);

  const streak = stats.currentStreak();
  const facts = [[`${result.mins}`, 'minutes'], [`${result.snoozes}`, result.snoozes === 1 ? 'snooze' : 'snoozes'], [`${streak}`, 'day streak']];
  facts.forEach(([n, label], i) => {
    const x = 200 + i * 340;
    ctx.fillStyle = v['--text'];
    ctx.font = `${weight} 96px ${display}`;
    ctx.fillText(n, x, 1580);
    ctx.fillStyle = v['--muted'];
    ctx.font = `400 34px ${body}`;
    ctx.fillText(label, x, 1630);
  });

  const motif = await motifImage(p.theme, v['--accent-text'], 120);
  if (motif) ctx.drawImage(motif, W / 2 - 60, 1700, 120, 120);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

function wrap(ctx, text, x, y, max, lh) {
  let line = '';
  for (const word of String(text).split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) { ctx.fillText(line, x, y); line = word; y += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexA = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const mix = (a, b, t) => `rgb(${rgb(a).map((x, i) => Math.round(x + (rgb(b)[i] - x) * t)).join(',')})`;

// The most recent proven morning, or null if there isn't one yet.
export function lastProven() {
  const h = stats.get().history.find((x) => x.outcome === 'proven');
  return h ? { letter: h.grade, mins: h.mins, snoozes: h.snoozes || 0 } : null;
}

export async function shareStoryCard(result) {
  if (!result?.letter) { toast('Prove a morning first.'); return; }
  try {
    const blob = await createStoryCardBlob(result);
    if (!blob) throw new Error('no image');
    const how = await saveOrShare(blob, `first-light-${new Date().toISOString().slice(0, 10)}.png`, { title: 'My morning', preferShare: true });
    if (how === 'saved') toast('Image saved.');
    else if (how === 'failed') toast('Couldn’t share the image.');
  } catch {
    toast('Couldn’t make the image.');
  }
}

