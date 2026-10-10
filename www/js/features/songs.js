// Song library and daily rotation: every song plays once before any repeats.
import { load, save, media } from '../core/storage.js';
import { emit } from '../core/events.js';
import { uid } from '../core/util.js';

const MAX_MB = 50;
let s = load('songs', { queue: [], last: null });

export const list = () => media.ofKind('song');

// Returns { added, rejected } so the screen can explain skipped files.
export async function add(files) {
  let added = 0;
  const rejected = [];
  for (const f of files) {
    if (!f.type?.startsWith('audio/')) { rejected.push(`${f.name} isn’t an audio file`); continue; }
    if (f.size > MAX_MB * 1048576) { rejected.push(`${f.name} is over ${MAX_MB} MB`); continue; }
    await media.put({ id: uid(), kind: 'song', name: f.name.replace(/\.[^.]+$/, ''), blob: f, at: Date.now() });
    added++;
  }
  if (added) emit('songs:changed');
  return { added, rejected };
}

export async function remove(id) {
  await media.del(id);
  s.queue = s.queue.filter((x) => x !== id);
  save('songs', s);
  emit('songs:changed');
}

// Picks today's song id, or null when the library is empty.
export async function next() {
  const ids = (await list()).map((x) => x.id);
  if (!ids.length) return null;
  let q = s.queue.filter((id) => ids.includes(id));
  if (!q.length) {
    q = ids.slice().sort(() => Math.random() - 0.5);
    if (q.length > 1 && q[0] === s.last) q.push(q.shift());
  }
  const id = q.shift();
  s = { queue: q, last: id };
  save('songs', s);
  return id;
}
