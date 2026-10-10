// Pip on screen: a card on the Alarm tab, and the fly-in greeting when the app opens.
import { on } from '../core/events.js';
import { esc, refs, vibrateTap } from '../core/util.js';
import * as profile from '../features/profile.js';
import * as pet from '../features/pet.js';
import * as stats from '../features/stats.js';
import { petLine, greeting } from '../features/messages.js';
import { petSVG } from './art.js';
import { artColours } from './theme.js';
import { PIP_ART } from '../config.js';
import * as audio from '../services/audio.js';
import * as wardrobe from '../features/wardrobe.js';
import { accessoryLayers } from './wardrobe-art.js';

// Pip is drawn in code until real artwork is added to www/img/pip/ (see PIP_ART in config.js).
export const hasArt = (pose) => PIP_ART.includes(pose);
export const artSrc = (pose) => `img/pip/${pose}.webp`;
// With an accessory on, the image and its layers share one wrapper, so they animate together.
function artImg(pose, size, cls = '', label = '') {
  const name = esc(profile.get().petName);
  const { back, front } = accessoryLayers(pose, wardrobe.wearing());
  if (!back && !front) return `<img class="pet pet-img pet-${pose}${cls}" src="${artSrc(pose)}" width="${size}" height="${size}" ${label ? `aria-label="${esc(label)}" ` : ''}alt="${name}" draggable="false" decoding="async">`;
  return `<span class="pet pet-art pet-${pose}${cls}" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(label || name)}">${back}<img src="${artSrc(pose)}" width="${size}" height="${size}" alt="" draggable="false" decoding="async">${front}</span>`;
}
export const petMarkup = (mood, size = 96) => hasArt(mood)
  ? artImg(mood, size, '', `${profile.get().petName} looks ${mood}`)
  : petSVG(mood, artColours(), { size, label: `${profile.get().petName} looks ${mood}`, accessory: wardrobe.wearing() });

export function mountCard(el) {
  el.classList.add('card', 'pet-card');
  let poke = 0, said = null;
  function render() {
    const mood = pet.current();
    const p = profile.get();
    const line = poke ? pokeLine(mood, poke) : said || petLine(mood, { streak: stats.currentStreak(), name: p.name });
    el.innerHTML = `
      <button class="pet-hit" data-ref="hit" aria-label="Poke ${esc(p.petName)}">${petMarkup(mood, 68)}</button>
      <div class="bubble" aria-live="polite"><strong>${esc(p.petName)}</strong><p>${esc(line)}</p></div>`;
    refs(el).hit.onclick = () => {
      poke++;
      vibrateTap(20);
      const snd = mood === 'grumpy' || mood === 'sulking' ? 'grump'
        : mood === 'sleepy' ? 'sleepy'
        : ['roar', 'purr', 'chirp', 'roar'][(poke - 1) % 4];
      audio.playTigerSound(snd);
      render();
      const svg = el.querySelector('.pet');
      svg?.classList.add('boing');
    };
  }
  // Something Pip wants to say right now (e.g. about a new wake-up time), until he's poked or you leave.
  on('pet:say', ({ text }) => { said = text; poke = 0; render(); });
  on('pet:changed', render);
  on('profile:changed', render);
  on('tab:shown', ({ tab }) => { if (tab === 'alarm') { poke = 0; said = null; render(); } });
  render();
}

function pokeLine(mood, n) {
  const lines = mood === 'grumpy' ? ['Don’t poke me.', 'Still grumpy.', 'Hmph.']
    : mood === 'sleepy' ? ['Five more minutes…', 'Shh. Nap o’clock.', 'Zzz… oh, hi.']
    : ['Rawr!', 'That tickles.', 'One tiny roar.', 'I like you too.'];
  return lines[(n - 1) % lines.length];
}

// Pip's flight. He flaps in on a curved, bobbing path, lands, waves and says hello, then flies
// off toward his spot on the Alarm tab. Tap to skip. With reduced motion he just fades in and waves.
// Runs when the app opens, right after setup, when you come back after 30+ minutes away,
// and as a victory lap when you prove your morning.
let flying = null;
export function greet({ afterSetup = false, victory = false, text = null } = {}) {
  if (flying) return flying;
  const p = profile.get();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const line = text || (victory ? `Morning proven${p.name ? `, ${p.name}` : ''}!` : afterSetup ? `Welcome home${p.name ? `, ${p.name}` : ''}!` : greeting(p.name));
  const size = 120;
  flying = new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = `greet${victory ? ' victory' : ''}${reduce ? ' still' : ''}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="greet-pet" style="width:${size}px;height:${size}px">${flyMarkup('fly', size, 1, victory)}</div><p class="greet-text">${esc(line)}</p>`;
    document.body.appendChild(el);
    const bird = el.querySelector('.greet-pet');
    const W = innerWidth, H = innerHeight;
    const land = { x: W / 2 - size / 2, y: Math.max(70, H * 0.26) };
    el.querySelector('.greet-text').style.top = `${land.y + size + 12}px`;
    let done = false, flap = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(flap);
      el.classList.add('leaving');
      // Fly off toward Pip's card if it's on screen, otherwise up and away.
      const card = document.querySelector('[data-tab="alarm"]:not(.hidden) .pet-card .pet-hit')?.getBoundingClientRect();
      const to = card && card.top < H && card.bottom > 0 ? { x: card.left + card.width / 2 - size / 2, y: card.top + card.height / 2 - size / 2, s: card.width / size } : { x: W + 80, y: -size, s: 0.5 };
      if (!reduce && bird.animate) bird.animate([{ transform: `translate(${land.x}px, ${land.y}px) scale(1)` }, { transform: `translate(${to.x}px, ${to.y}px) scale(${to.s})` }], { duration: 320, easing: 'ease-in', fill: 'forwards' });
      setTimeout(() => { el.remove(); flying = null; resolve(); }, reduce ? 0 : 340);
    };
    if (!victory) el.addEventListener('click', finish);
    if (reduce || !bird.animate) {
      bird.style.transform = `translate(${land.x}px, ${land.y}px)`;
      bird.innerHTML = flyMarkup('wave', size);
    } else {
      // Curved path in from the top right, bobbing with each wingbeat.
      const from = victory ? { x: -size, y: H * 0.5 } : { x: W + size * 0.4, y: H * 0.05 };
      const c1 = victory ? { x: W * 0.2, y: H * 0.05 } : { x: W * 0.9, y: H * 0.45 };
      const c2 = victory ? { x: W * 0.95, y: H * 0.15 } : { x: W * 0.15, y: H * 0.05 };
      const frames = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        const x = u ** 3 * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * land.x;
        const y = u ** 3 * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * land.y + Math.sin(t * Math.PI * 7) * 9 * u;
        const tilt = (1 - t) * (victory ? -12 : 14);
        frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scale(${(0.6 + 0.4 * t).toFixed(2)})`, offset: t });
      }
      bird.animate(frames, { duration: victory ? 1300 : 1000, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      flap = flapFrames(bird, size, victory, victory ? 1300 : 1000);
      setTimeout(() => { clearTimeout(flap); if (!done) bird.innerHTML = flyMarkup(victory ? 'ecstatic' : 'wave', size); el.classList.add('landed'); }, victory ? 1300 : 1000);
    }
    setTimeout(finish, victory ? 2600 : 2100);
  });
  return flying;
}

// Pip art for flight: the cub's leap frames from img/pip/ when they're there, otherwise the drawn cub.
// leap-1 is the long stretch mid-air (facing left), leap-2 the tucked-in landing.
function flyMarkup(pose, size, frame = 1, flip = false) {
  const extra = flip ? ' flip' : '';
  if (pose === 'wave') return hasArt('wave') ? artImg('wave', size, ' waving') : petMarkup('happy', size).replace('class="pet ', 'class="pet waving ');
  if (pose === 'fly') return hasArt('leap-1') ? artImg(frame === 1 ? 'leap-1' : 'leap-2', size, ' flying' + (frame === 1 ? extra : '')) : petMarkup('happy', size).replace('class="pet ', `class="pet flying${extra} `);
  return hasArt(pose) ? artImg(pose, size, ' flying') : petMarkup(pose, size).replace('class="pet ', 'class="pet flying ');
}
// Switches to the landing frame part-way through the jump.
function flapFrames(bird, size, flip, duration) {
  bird.innerHTML = flyMarkup('fly', size, 1, flip);
  if (!hasArt('leap-2')) return null;
  return setTimeout(() => { bird.innerHTML = flyMarkup('fly', size, 2, flip); }, duration * 0.62);
}

// Greets you again when you come back after a while (not every time: that would get old).
const AWAY_MS = 30 * 60_000;
let hiddenAt = null;
export function watchReturns(isBusy = () => false) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS && !isBusy() && !document.querySelector('#onboarding') && document.querySelector('#morning')?.classList.contains('hidden') !== false) greet();
    hiddenAt = null;
  });
  // Victory lap once you close your report card (not over it), for real mornings only.
  let proven = false;
  on('morning:finished', (m) => { proven = !m?.test; });
  on('morning:closed', () => { if (proven) { proven = false; setTimeout(() => greet({ victory: true }), 350); } });
}
