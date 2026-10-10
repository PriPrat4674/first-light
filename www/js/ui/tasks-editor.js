// Tasks tab: build your morning ritual. Tap a task to edit it.
import { on } from '../core/events.js';
import { esc, toast, vibrateTap } from '../core/util.js';
import { TASK_TEMPLATES, MAX_TASKS, MAX_GAP_MIN } from '../config.js';
import * as tasks from '../features/tasks.js';
import { ICONS, switchRow, stepperRow, wireSteppers, info } from './components.js';
import { icon } from './icons.js';

const kindIcon = (t) => icon(t.kind === 'steps' ? 'steps' : t.kind === 'shake' ? 'shake' : 'camera', 18);
const proofText = (t) => (t.kind === 'steps' ? `Walk ${t.target || 25} steps` : t.kind === 'shake' ? `Shake ${t.target || 25} times` : t.proof);

export function mount(root) {
  let open = null; // id of the expanded task

  root.innerHTML = `
    <p class="intro soft">Done in order after the alarm. ${info('Morning tasks', 'Photo tasks need a live photo. Motion tasks count real steps or shakes. A wait (like 10 minutes for tea) stops you rushing back to bed.')}</p>
    <div data-list></div>
    <button class="btn line block add-task" data-add>${icon('plus', 20)} Add a task</button>
    <p class="small muted italic hidden" data-full style="margin-top:10px">That’s the maximum of ${MAX_TASKS} tasks.</p>
    <div class="card" data-chaos></div>`;
  const listEl = root.querySelector('[data-list]');
  const chaosEl = root.querySelector('[data-chaos]');

  function card(t, i, n) {
    const expanded = open === t.id;
    return `
      <div class="task-card" data-id="${t.id}">
        <div class="task-head">
          <span class="n">${i + 1}</span>
          <button class="title" data-toggle aria-expanded="${expanded}"><strong>${esc(t.name)}</strong><span>${kindIcon(t)}${esc(proofText(t))}${t.gapMin ? ` · ${t.gapMin} min wait` : ''}</span></button>
          <span class="soft" aria-hidden="true">${expanded ? ICONS.up : ICONS.down}</span>
        </div>
        ${expanded ? `<div class="task-body">
          <label class="field"><span>Task</span><input type="text" data-f="name" value="${esc(t.name)}" maxlength="60" autocomplete="off"><div class="error hidden" data-err="name">A task needs a name.</div></label>
          ${t.kind === 'steps' || t.kind === 'shake' ? '' : `<label class="field"><span>The photo must show</span><input type="text" data-f="proof" value="${esc(t.proof)}" maxlength="120" autocomplete="off"><div class="error hidden" data-err="proof">Describe what the photo should show.</div></label>`}
          ${stepperRow({ key: 'gapMin', title: 'Wait first', desc: i === 0 ? 'After the alarm stops' : 'After the last task', value: t.gapMin || 0, min: 0, max: MAX_GAP_MIN, step: 5, unit: ' min' })}
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
      : '<div class="card empty-card"><p class="soft">No tasks. Typing the phrase ends the alarm.</p></div>';
    const body = listEl.querySelector('.task-body');
    if (body) wireSteppers(body, (key, v) => tasks.update(open, { [key]: v })?.gapMin ?? v);
    const full = !tasks.canAdd();
    root.querySelector('[data-add]').disabled = full;
    root.querySelector('[data-full]').classList.toggle('hidden', !full);
    renderChaos();
  }

  function renderChaos() {
    chaosEl.innerHTML = switchRow({ key: 'chaos', title: 'Chaos task', desc: 'One surprise, like “something yellow”', checked: tasks.options().chaos });
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
    head.querySelector('span').innerHTML = kindIcon(saved) + esc(proofText(saved)) + (saved.gapMin ? ` · ${saved.gapMin} min wait` : '');
  });

  // Add: a sheet of ready-made tasks, photo ones first, then motion, then your own.
  root.querySelector('[data-add]').onclick = () => {
    const back = document.createElement('div');
    back.className = 'sheet-backdrop';
    back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="add-title">
      <h2 id="add-title">Add a task</h2>
      <div class="chips" style="margin-top:12px">${TASK_TEMPLATES.map((t, i) => `<button class="chip" data-tpl="${i}">${kindIcon(t)}${esc(t.name)}</button>`).join('')}<button class="chip" data-tpl="custom">${icon('plus', 18)}Your own</button></div>
      <div class="actions"><button class="btn line block" data-close>Cancel</button></div></div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('[data-close]')) return close();
      const b = e.target.closest('[data-tpl]');
      if (!b) return;
      close();
      const tpl = b.dataset.tpl === 'custom' ? undefined : TASK_TEMPLATES[Number(b.dataset.tpl)];
      const id = tasks.add(tpl);
      if (!id) { toast(`You can have up to ${MAX_TASKS} tasks.`); return; }
      vibrateTap();
      open = b.dataset.tpl === 'custom' ? id : null;
      render();
      if (open) listEl.querySelector('[data-f="name"]')?.select();
      else toast(`Added “${tpl.name}.”`);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    back.querySelector('.chip')?.focus();
  };

  chaosEl.addEventListener('change', (e) => { if (e.target.dataset.switch === 'chaos') tasks.setChaos(e.target.checked); });

  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) render(); });
}
