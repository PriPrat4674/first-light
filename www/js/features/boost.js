// Wake-up boost: a voice note from last-night you, and motivating clips.
// Shown once you pass the check-in.
import { media } from '../core/storage.js';
import { on, emit } from '../core/events.js';
import { uid, pick } from '../core/util.js';

const MAX_CLIP_MB = 100;

export const voice = async () => (await media.ofKind('voice'))[0] || null;
export const clips = () => media.ofKind('clip');

export async function saveVoice(blob) {
  if (!blob || !blob.size) return { ok: false, reason: 'The recording was empty. Try again.' };
  for (const v of await media.ofKind('voice')) await media.del(v.id);
  await media.put({ id: uid(), kind: 'voice', name: 'Message from past you', blob, at: Date.now() });
  emit('boost:changed');
  return { ok: true };
}
export async function deleteVoice() {
  for (const v of await media.ofKind('voice')) await media.del(v.id);
  emit('boost:changed');
}

export async function addClips(files) {
  let added = 0;
  const rejected = [];
  for (const f of files) {
    if (!f.type?.startsWith('video/')) { rejected.push(`${f.name} isn’t a video`); continue; }
    if (f.size > MAX_CLIP_MB * 1048576) { rejected.push(`${f.name} is over ${MAX_CLIP_MB} MB`); continue; }
    await media.put({ id: uid(), kind: 'clip', name: f.name.replace(/\.[^.]+$/, ''), blob: f, at: Date.now() });
    added++;
  }
  if (added) emit('boost:changed');
  return { added, rejected };
}
export async function removeClip(id) { await media.del(id); emit('boost:changed'); }

on('checkin:passed', async () => {
  const [v, c] = await Promise.all([voice(), clips()]);
  if (!v && !c.length) return;
  emit('boost:show', { voice: v, clip: c.length ? pick(c) : null });
});
