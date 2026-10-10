// "Running on little sleep" plan on the Alarm tab. Appears only after a short night.
import { on } from '../core/events.js';
import { esc } from '../core/util.js';
import * as recovery from '../features/recovery.js';
import * as tabs from './tabs.js';

export function mount(el) {
  let open = null;
  function render() {
    const a = recovery.active();
    el.classList.toggle('hidden', !a);
    if (!a) { el.innerHTML = ''; return; }
    const done = recovery.done();
    el.className = 'card recovery';
    el.innerHTML = `
      <div class="card-head"><h3>Short on sleep? Here’s your plan 🧃</h3><span class="small muted">${done.length}/${recovery.TIPS.length}</span></div>
      <p class="small soft">You slept about ${a.hours} h. These are cheap, student-friendly, and backed by research. Tick them off as you go.</p>
      <ul class="tips">${recovery.TIPS.map((t) => `
        <li class="${done.includes(t.id) ? 'done' : ''}">
          <button class="tip-check" data-tip="${t.id}" aria-pressed="${done.includes(t.id)}" aria-label="Mark “${esc(t.title)}” done">${done.includes(t.id) ? '✓' : ''}</button>
          <div class="grow">
            <button class="tip-title" data-open="${t.id}" aria-expanded="${open === t.id}"><span aria-hidden="true">${t.emoji}</span> ${esc(t.title)}</button>
            <p class="small soft">${esc(t.body)}</p>
            ${open === t.id ? `<p class="small why"><strong>Why:</strong> ${esc(t.why)} <a href="${t.url}" target="_blank" rel="noopener">${esc(t.source)}</a></p>${t.id === 'scroll' ? '<button class="btn quiet" data-locklink>Set up app lock</button>' : ''}` : ''}
          </div>
        </li>`).join('')}</ul>`;
  }
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-tip]');
    if (c) { recovery.toggle(c.dataset.tip); render(); return; }
    const o = e.target.closest('[data-open]');
    if (o) { open = open === o.dataset.open ? null : o.dataset.open; render(); return; }
    if (e.target.closest('[data-locklink]')) tabs.show('settings');
  });
  ['sleep:changed', 'recovery:changed'].forEach((ev) => on(ev, render));
  on('tab:shown', ({ tab }) => { if (tab === 'alarm') render(); });
  render();
}
