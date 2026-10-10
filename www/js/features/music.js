// Chooses what plays when the alarm rings, with automatic fallback:
// your chosen source → your own songs → beeps. Missed check-ins play the punishment song.
import { load, save, media } from '../core/storage.js';
import { emit } from '../core/events.js';
import { dayNumber, withTimeout, uid } from '../core/util.js';
import { SOURCE_START_TIMEOUT_MS } from '../config.js';
import * as audio from '../services/audio.js';
import * as local from './sources/local.js';
import * as spotify from './sources/spotify.js';
import * as youtube from './sources/youtube.js';
import * as native from '../services/native.js';

const SOURCES = { local, spotify, youtube };
let s = load('music', { source: 'local', lastFallback: null });
let playing = null;      // which source is making sound right now
let alarmSource = null;  // what the last alarm actually played (survives stopping)

const commit = () => { save('music', s); emit('music:changed', status()); };
export const status = () => ({ source: s.source, lastFallback: s.lastFallback, playing });

export function setSource(id) {
  if (!SOURCES[id]) return false;
  s.source = id;
  commit();
  return true;
}

/* Punishment song: one file, played when you miss the check-in. */
export const punishment = async () => (await media.ofKind('punish'))[0] || null;
export async function setPunishment(file) {
  if (!file?.type?.startsWith('audio/')) return { ok: false, reason: 'That file isn’t audio. Choose a song file.' };
  for (const m of await media.ofKind('punish')) await media.del(m.id);
  await media.put({ id: uid(), kind: 'punish', name: file.name.replace(/\.[^.]+$/, ''), blob: file, at: Date.now() });
  native.setSoundFile('punish', file);
  emit('music:changed', status());
  return { ok: true };
}
export async function removePunishment() {
  for (const m of await media.ofKind('punish')) await media.del(m.id);
  native.setSoundFile('punish', null);
  emit('music:changed', status());
}

// Returns which sound actually started: 'spotify' | 'youtube' | 'local' | 'punishment' | 'beeps'.
export async function startAlarm({ escalated = false, fresh = true } = {}) {
  stopAll();
  alarmSource = null;
  if (escalated) {
    const p = await punishment();
    if (p && (await audio.playBlob(p.blob, { loop: true }))) return (alarmSource = playing = 'punishment');
    audio.startBeeps();
    return (alarmSource = playing = 'beeps');
  }
  if (s.source !== 'local') {
    const src = SOURCES[s.source];
    const ok = await withTimeout(src.play({ day: dayNumber() }), SOURCE_START_TIMEOUT_MS, false);
    if (ok) return (alarmSource = playing = s.source);
    src.stop();
    s.lastFallback = { source: s.source, at: Date.now(), reason: src.lastError?.() || 'It didn’t start in time.' };
    commit();
    emit('music:fallback', s.lastFallback);
  }
  if (await local.play({ fresh })) return (alarmSource = playing = 'local');
  audio.startBeeps();
  return (alarmSource = playing = 'beeps');
}

// App version: Android is already ringing. Try the streaming source; true means it took over.
export async function startStreaming() {
  if (s.source === 'local') return false;
  const src = SOURCES[s.source];
  const ok = await withTimeout(src.play({ day: dayNumber() }), SOURCE_START_TIMEOUT_MS, false);
  if (ok) { alarmSource = playing = s.source; return true; }
  src.stop();
  s.lastFallback = { source: s.source, at: Date.now(), reason: src.lastError?.() || 'It didn’t start in time.' };
  commit();
  emit('music:fallback', s.lastFallback);
  alarmSource = 'native';
  return false;
}

// After the morning is proven: the rest of today's song (own songs only).
export async function finale() {
  if (alarmSource === 'local' || alarmSource === 'native') { const ok = await local.finale(); playing = ok ? 'finale' : null; return ok; }
  stopAll();
  return false;
}

export function rampUp() { if (playing === 'local' || playing === 'punishment') audio.rampUp(); }

export function stopAll() {
  audio.stopAll();
  spotify.stop();
  youtube.stop();
  playing = null;
}
