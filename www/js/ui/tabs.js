// Bottom tab bar. Shows one section and announces 'tab:shown' so that view can draw itself.
import { emit } from '../core/events.js';
import { $$, vibrateTap } from '../core/util.js';

const ICON = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const TABS = [
  { id: 'alarm', label: 'Alarm', icon: ICON('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3 2 6M19 3l3 3"/>') },
  { id: 'tasks', label: 'Tasks', icon: ICON('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>') },
  { id: 'sounds', label: 'Sounds', icon: ICON('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>') },
  { id: 'progress', label: 'Progress', icon: ICON('<path d="M4 20h16"/><path d="M12 16a5 5 0 0 0 5-5H7a5 5 0 0 0 5 5z"/><path d="M12 3v3M4.9 6.9l1.4 1.4M19.1 6.9l-1.4 1.4"/>') },
  { id: 'settings', label: 'Settings', icon: ICON('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>') }
];

let nav, current = null;

export function mount(navEl) {
  nav = navEl;
  nav.setAttribute('role', 'tablist');
  nav.innerHTML = TABS.map((t) => `<button role="tab" data-go="${t.id}" aria-selected="false">${t.icon}${t.label}</button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b && b.dataset.go !== current) { vibrateTap(); show(b.dataset.go); }
  });
}

export function show(id) {
  current = id;
  $$('[data-tab]').forEach((s) => s.classList.toggle('hidden', s.dataset.tab !== id));
  $$('[data-go]', nav).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.go === id)));
  window.scrollTo(0, 0);
  emit('tab:shown', { tab: id });
}
