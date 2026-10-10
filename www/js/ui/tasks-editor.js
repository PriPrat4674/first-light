// Tasks tab: build your morning ritual. Tap a task to edit it.
import { on } from '../core/events.js';
import { esc, toast, vibrateTap } from '../core/util.js';
import { TASK_TEMPLATES, MAX_TASKS, MAX_GAP_MIN } from '../config.js';
import * as tasks from '../features/tasks.js';
import { ICONS, switchRow, stepperRow, wireSteppers } from './components.js';

export function mount(root) {
  let open = null; // id of the expanded task

  root.innerHTML = `
    <header class="screen-head"><h1>Morning tasks</h1><p>Prove each one with a live photo, in order. Waits stop you from rushing through and crawling back to bed.</p></header>
    <div data-list></div>
    <div class="card">
      <h3>Add a task</h3>
      <div class="chips" data-chips>${TASK_TEMPLATES.map((t, i) => `<button class="chip" data-tpl="${i}">${esc(t.name)}</button>`).join('')}<button class="chip" data-tpl="custom">Something else…</button></div>
      <p class="small muted italic hidden" data-full style="margin-top:10px">That’s the maximum of ${MAX_TASKS} tasks.</p>
    </div>
    <div class="card" data-chaos></div>`;
  const listEl = root.querySelector('[data-list]');
  const chaosEl = root.querySelector('[data-chaos]');

  function card(t, i, n) {
    const expanded = open === t.id;
    return `
      <div class="task-card" data-id="${t.id}">
        <div class="task-head">
          <span class="n">${i + 1}</span>
          <button class="title" data-toggle aria-expanded="${expanded}"><strong>${esc(t.name)}</strong><span>${esc(t.proof)}${t.gapMin ? ` · ${t.gapMin} min after the last` : ''}</span></button>
          <span class="soft" aria-hidden="true">${expanded ? ICONS.up : ICONS.down}</span>
        </div>
        ${expanded ? `<div class="task-body">
          <label class="field"><span>Task</span><input type="text" data-f="name" value="${esc(t.name)}" maxlength="60" autocomplete="off"><div class="error hidden" data-err="name">A task needs a name.</div></label>
          <label class="field"><span>The photo must show</span><input type="text" data-f="proof" value="${esc(t.proof)}" maxlength="120" autocomplete="off"><div class="error hidden" data-err="proof">Describe what the photo should show.</div></label>
          ${stepperRow({ key: 'gapMin', title: 'Wait before this task', desc: i === 0 ? 'Counted from when the alarm stops' : 'After the previous task', value: t.gapMin || 0, min: 0, max: MAX_GAP_MIN, step: 5, unit: ' min' })}
          <div class="task-tools">
            <button class="btn line" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${ICONS.up}</button>
            <button class="btn line" data-act="down" ${i === n - 1 ? 'disabled' : ''} aria-label="Move down">${ICONS.down}</button>
            <button class="btn line" data-act="del" aria-label="Delete task">${ICONS.bin} Delete</button>
          </div>
        </div>` : ''}
      </div>`;
  }

  function render() {
    const list = tasks.all();
    listEl.innerHTML = list.length
      ? list.map((t, i) => card(t, i, list.length)).join('')
      : '<div class="card"><p class="soft italic">No tasks yet. Add one below, or the alarm stops as soon as you type the phrase.</p></div>';
    const body = listEl.querySelector('.task-body');
    if (body) wireSteppers(body, (key, v) => tasks.update(open, { [key]: v })?.gapMin ?? v);
    const full = !tasks.canAdd();
    root.querySelectorAll('[data-tpl]').forEach((b) => { b.disabled = full; });
    root.querySelector('[data-full]').classList.toggle('hidden', !full);
    renderChaos();
  }

  function renderChaos() {
    chaosEl.innerHTML = switchRow({ key: 'chaos', title: 'Chaos task', desc: 'Adds one random task at the end each morning, like “photograph something yellow.”', checked: tasks.options().chaos });
  }

  listEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) { const id = t.closest('.task-card').dataset.id; open = open === id ? null : id; vibrateTap(); render(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.task-card').dataset.id;
    if (b.dataset.act === 'up') tasks.move(id, -1);
    if (b.dataset.act === 'down') tasks.move(id, 1);
    if (b.dataset.act === 'del') { tasks.remove(id); open = null; toast('Task deleted.'); }
    render();
  });

  // Field edits save on change, without redrawing, so typing isn't interrupted.
  listEl.addEventListener('change', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const id = e.target.closest('.task-card').dataset.id;
    const err = listEl.querySelector(`[data-err="${f}"]`);
    if (!e.target.value.trim()) {
      err.classList.remove('hidden');
      e.target.value = tasks.all().find((x) => x.id === id)?.[f] || '';
      return;
    }
    err.classList.add('hidden');
    const saved = tasks.update(id, { [f]: e.target.value });
    const head = e.target.closest('.task-card').querySelector('.title');
    head.querySelector('strong').textContent = saved.name;
    head.querySelector('span').textContent = saved.proof + (saved.gapMin ? ` · ${saved.gapMin} min after the last` : '');
  });

  root.querySelector('[data-chips]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    const tpl = b.dataset.tpl === 'custom' ? undefined : TASK_TEMPLATES[Number(b.dataset.tpl)];
    const id = tasks.add(tpl);
    if (!id) { toast(`You can have up to ${MAX_TASKS} tasks.`); return; }
    vibrateTap();
    open = b.dataset.tpl === 'custom' ? id : null;
    render();
    if (open) listEl.querySelector('[data-f="name"]')?.select();
    else toast(`Added “${tpl.name}.”`);
  });

  chaosEl.addEventListener('change', (e) => { if (e.target.dataset.switch === 'chaos') tasks.setChaos(e.target.checked); });

  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) render(); });
}
