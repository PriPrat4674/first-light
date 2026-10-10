// Pip on screen: a card on the Alarm tab, and the fly-in greeting when the app opens.
import { on } from '../core/events.js';
import { esc, refs, vibrateTap } from '../core/util.js';
import * as profile from '../features/profile.js';
import * as pet from '../features/pet.js';
import * as stats from '../features/stats.js';
import { petLine, greeting } from '../features/messages.js';
import { petSVG } from './art.js';
import { artColours } from './theme.js';

export const petMarkup = (mood, size = 96) => petSVG(mood, artColours(), { size, label: `${profile.get().petName} looks ${mood}` });

export function mountCard(el) {
  el.classList.add('card', 'pet-card');
  let poke = 0;
  function render() {
    const mood = pet.current();
    const p = profile.get();
    const line = poke ? pokeLine(mood, poke) : petLine(mood, { streak: stats.currentStreak(), name: p.name });
    el.innerHTML = `
      <button class="pet-hit" data-ref="hit" aria-label="Poke ${esc(p.petName)}">${petMarkup(mood, 88)}</button>
      <div class="bubble" aria-live="polite"><strong>${esc(p.petName)}</strong><p>${esc(line)}</p></div>`;
    refs(el).hit.onclick = () => {
      poke++;
      vibrateTap(15);
      render();
      const svg = el.querySelector('.pet');
      svg?.classList.add('boing');
    };
  }
  on('pet:changed', render);
  on('profile:changed', render);
  on('tab:shown', ({ tab }) => { if (tab === 'alarm') { poke = 0; render(); } });
  render();
}

function pokeLine(mood, n) {
  const lines = mood === 'grumpy' ? ['Don’t poke me, I’m sulking 😤', 'Still grumpy. Prove a morning and we’ll talk 🙄', 'Hmph 😒']
    : mood === 'sleepy' ? ['Five more minutes… 😴', 'Shh, it’s nap o’clock 🥱', 'Zzz… huh? Oh, hi 🌙']
    : ['Hoot! 🦉', 'That tickles 🤭', 'Again? Okay, one more hoot 🎶', 'I like you too 💛'];
  return lines[(n - 1) % lines.length];
}

// The greeting: Pip flies in, says hello, then the app appears. Tap to skip.
export function greet() {
  const p = profile.get();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'greet';
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="greet-pet">${petMarkup('happy', 132)}</div><p class="greet-text">${esc(greeting(p.name))}</p>`;
    document.body.appendChild(el);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add('leaving');
      setTimeout(() => { el.remove(); resolve(); }, reduce ? 0 : 350);
    };
    el.addEventListener('click', finish);
    setTimeout(finish, reduce ? 900 : 2100);
  });
}
