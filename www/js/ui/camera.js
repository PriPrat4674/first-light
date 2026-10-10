// Live-camera proof photo. takeProof(task) resolves true when a photo is accepted, false if cancelled.
// To add photo checking later (e.g. AI), change only judge() below.
import { on } from '../core/events.js';
import { refs, esc } from '../core/util.js';

let root, r, stream = null, facing = 'user', settle = null;
let attempts = 0;

// Quick on-phone checks; the photo never leaves the phone. It catches a dark room or a covered
// lens, and (where the phone can detect faces) a selfie with no face. It doesn't recognise
// objects, so it never claims to have seen your tea.
async function judge(photoDataUrl, taskTitle) {
  attempts++;
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = photoDataUrl; });
    const canvas = document.createElement('canvas');
    const w = 120, h = Math.round(120 * (img.height / img.width || 1));
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, sumSq = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum; sumSq += lum * lum;
    }
    const n = w * h, avg = sum / n, spread = Math.sqrt(Math.max(0, sumSq / n - avg * avg));
    if (avg < 22) return { pass: false, reason: 'Too dark. Turn on a light.' };
    if (spread < 9) return { pass: false, reason: 'The lens looks covered.' };
    if (/selfie|eyes|face/i.test(taskTitle || '') && 'FaceDetector' in window) {
      try {
        const faces = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }).detect(img);
        if (!faces?.length) {
          // Face detection misses sometimes, so the second try is taken on trust.
          return attempts >= 2 ? { pass: true, reason: 'Saved. No face found, so this one’s on trust.' } : { pass: false, reason: 'No face found. Look at the camera.' };
        }
      } catch {}
    }
    return { pass: true, reason: 'Saved as proof.' };
  } catch {
    return { pass: true, reason: 'Saved as proof.' };
  }
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
  attempts = 0;
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
