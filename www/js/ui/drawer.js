// The ☰ menu: the occasional settings, one group per page. The everyday screens stay in the bottom bar.
import { esc, vibrateTap } from '../core/util.js';
import { APP_NAME } from '../config.js';
import * as native from '../services/native.js';
import * as profile from '../features/profile.js';
import * as tabs from './tabs.js';
import { petMarkup } from './pet-view.js';
import { icon } from './icons.js';

const inApp = native.isNative();
// Each menu item opens Settings showing only these cards (data-group values in settings-view.js).
export const GROUPS = [
  { id: 'look', icon: 'palette', title: 'Look & feel', cards: ['look'], section: 'You' },
  { id: 'you', icon: 'paw', title: 'You & Pip', cards: ['you'], section: 'You' },
  { id: 'rules', icon: 'alarm', title: 'Alarm rules', cards: ['stop', 'snooze', 'checkin'], section: 'Alarm' },
  { id: 'sounds', icon: 'bell', title: 'Sounds', cards: ['sounds'], section: 'Alarm' },
  { id: 'applock', icon: 'lock', title: 'App lock', cards: ['applock'], section: 'Alarm' },
  ...(inApp ? [{ id: 'perms', icon: 'shield', title: 'Permissions', cards: ['perms'], section: 'Alarm' }] : [{ id: 'battery', icon: 'battery', title: 'Battery & alerts', cards: ['battery', 'notif'], section: 'Alarm' }]),
  { id: 'sleep', icon: 'moon', title: 'Sleep schedule', cards: ['sleep'], section: 'Alarm' },
  { id: 'backup', icon: 'archive', title: 'Backup & restore', cards: ['backup'], section: 'Data' },
  { id: 'reset', icon: 'reset', title: 'Start over', cards: ['reset'], section: 'Data' },
  { id: 'about', icon: 'info', title: 'About', cards: ['about'], section: 'Data' }
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
      ${[...new Set(GROUPS.map((g) => g.section))].map((sec) => `<p class="drawer-sec">${esc(sec)}</p><ul class="drawer-list">${GROUPS.filter((g) => g.section === sec).map((g) => `<li><button data-group-go="${g.id}"><span class="d-ico">${icon(g.icon, 20)}</span>${esc(g.title)}</button></li>`).join('')}</ul>`).join('')}
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
