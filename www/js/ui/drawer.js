// The ☰ menu: the occasional settings, one group per page. The everyday screens stay in the bottom bar.
import { esc, vibrateTap } from '../core/util.js';
import { APP_NAME } from '../config.js';
import * as native from '../services/native.js';
import * as profile from '../features/profile.js';
import * as tabs from './tabs.js';
import { petMarkup } from './pet-view.js';

const inApp = native.isNative();
// Each menu item opens Settings showing only these cards (data-group values in settings-view.js).
export const GROUPS = [
  { id: 'look', icon: '🎨', title: 'Look & feel', cards: ['look'] },
  { id: 'sleep', icon: '🌙', title: 'Sleep schedule', cards: ['sleep'] },
  { id: 'applock', icon: '🔒', title: 'App lock', cards: ['applock'] },
  { id: 'rules', icon: '⏰', title: 'Snooze & check-in', cards: ['snooze', 'checkin'] },
  { id: 'sounds', icon: '🔔', title: 'Notification sounds', cards: ['sounds'] },
  ...(inApp ? [{ id: 'perms', icon: '✅', title: 'Permissions', cards: ['perms'] }] : [{ id: 'battery', icon: '🔋', title: 'Battery & alerts', cards: ['battery', 'notif'] }]),
  { id: 'you', icon: '🐯', title: 'You & Pip', cards: ['you'] },
  { id: 'reset', icon: '🧹', title: 'Start over', cards: ['reset'] },
  { id: 'about', icon: 'ℹ️', title: 'About', cards: ['about'] }
];
export const titleFor = (id) => GROUPS.find((g) => g.id === id)?.title || null;
export const cardsFor = (id) => GROUPS.find((g) => g.id === id)?.cards || null;

let el = null, lastFocus = null;

export function open() {
  close();
  lastFocus = document.activeElement;
  const p = profile.get();
  el = document.createElement('div');
  el.className = 'drawer-backdrop';
  el.innerHTML = `<nav class="drawer" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="drawer-head">${petMarkup('happy', 54)}<div><strong>${p.name ? `Hi, ${esc(p.name)}` : 'Hi there'}</strong><span class="small muted">${APP_NAME}</span></div>
        <button class="icon-btn" data-close aria-label="Close menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <ul class="drawer-list">${GROUPS.map((g) => `<li><button data-group-go="${g.id}"><span class="d-ico" aria-hidden="true">${g.icon}</span>${esc(g.title)}</button></li>`).join('')}</ul>
    </nav>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el?.classList.add('open'));
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-group-go]');
    if (b) { vibrateTap(); close(); tabs.show('settings', { group: b.dataset.groupGo }); }
  });
  document.addEventListener('keydown', onKey);
  el.querySelector('[data-group-go]')?.focus();
}

function onKey(e) { if (e.key === 'Escape') close(); }

export function close() {
  if (!el) return;
  document.removeEventListener('keydown', onKey);
  el.remove();
  el = null;
  lastFocus?.focus?.();
}
export const isOpen = () => !!el;
