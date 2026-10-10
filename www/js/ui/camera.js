// Live-camera proof photo. takeProof(task) resolves true when a photo is accepted, false if cancelled.
// To add photo checking later (e.g. AI), change only judge() below.
import { on } from '../core/events.js';
import { refs, esc } from '../core/util.js';

let root, r, stream = null, facing = 'user', settle = null;

async function judge(/* photoDataUrl, task */) {
  return { pass: true, reason: 'Photo saved as proof.' };
}

export function mount(el) {
  root = el;
  root.className = 'modal hidden';
  root.innerHTML = `
    <div class="inner">
      <h2 data-ref="title"></h2>
      <p class="soft italic" data-ref="proof" style="margin:4px 0 14px"></p>
      <div class="cam-wrap"><video data-ref="video" playsinline autoplay muted></video><img data-ref="shot" class="hidden" alt="Your proof photo"></div>
      <div data-ref="verdict"></div>
      <div class="row wrap" style="margin-top:1rem" data-ref="actions"></div>
    </div>`;
  r = refs(root);
  // If the alarm rings again mid-photo, get out of the way.
  on('morning:ringing', () => finish(false));
}

export function takeProof(task) {
  finish(false);
  facing = /selfie|eyes|face/i.test(task.name + task.proof) ? 'user' : 'environment';
  r.title.textContent = task.name;
  r.proof.textContent = `Photo must show: ${task.proof}`;
  r.verdict.innerHTML = '';
  root.classList.remove('hidden');
  startLive();
  return new Promise((resolve) => { settle = resolve; });
}

function finish(result) {
  stopStream();
  root?.classList.add('hidden');
  if (settle) { const s = settle; settle = null; s(result); }
}

async function startLive() {
  stopStream();
  r.video.classList.remove('hidden');
  r.shot.classList.add('hidden');
  r.verdict.innerHTML = '';
  setActions(`<button class="btn gold" data-act="snap" style="flex:1">Capture</button><button class="btn line" data-act="flip">Flip</button><button class="btn quiet" data-act="cancel">Cancel</button>`);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
    r.video.srcObject = stream;
    r.video.classList.toggle('mirror', facing === 'user');
    await r.video.play().catch(() => {});
  } catch {
    r.verdict.innerHTML = '<div class="verdict fail">Camera blocked. Allow camera access for this site in your browser settings, then try again.</div>';
  }
}

function stopStream() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function capture() {
  const v = r.video;
  if (!v.videoWidth) return;
  const scale = Math.min(1, 768 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  const ctx = c.getContext('2d');
  if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(v, 0, 0, c.width, c.height);
  const photo = c.toDataURL('image/jpeg', 0.8);
  stopStream();
  r.shot.src = photo;
  r.shot.classList.remove('hidden');
  v.classList.add('hidden');
  setActions('');
  const result = await judge(photo, r.title.textContent);
  r.verdict.innerHTML = `<div class="verdict ${result.pass ? 'pass' : 'fail'}"><b>${result.pass ? 'Done.' : 'Try again.'}</b> ${esc(result.reason)}</div>`;
  setActions(result.pass
    ? `<button class="btn gold" data-act="next" style="flex:1">Next</button><button class="btn line" data-act="retake">Retake</button>`
    : `<button class="btn gold" data-act="retake" style="flex:1">Retake</button><button class="btn quiet" data-act="cancel">Cancel</button>`);
}

function setActions(html) {
  r.actions.innerHTML = html;
  r.actions.onclick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'snap') capture();
    if (act === 'flip') { facing = facing === 'user' ? 'environment' : 'user'; startLive(); }
    if (act === 'retake') startLive();
    if (act === 'cancel') finish(false);
    if (act === 'next') finish(true);
  };
}
