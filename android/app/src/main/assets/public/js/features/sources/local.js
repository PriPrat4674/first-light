// Sound source: your own uploaded songs. Loops the first 40 seconds while ringing;
// the rest of the song plays as a reward once the morning is proven.
import * as songs from '../songs.js';
import * as audio from '../../services/audio.js';

export const id = 'local';
export const label = 'My songs';
const CLIFF_SEC = 40;
let todaysId = null;

export const isReady = async () => (await songs.list()).length > 0;

// fresh: first ring of the morning picks today's song; re-rings (after snooze) reuse it.
export async function play({ fresh = true } = {}) {
  if (fresh || !todaysId) todaysId = await songs.next();
  if (!todaysId) return false;
  return audio.playMedia(todaysId, { loop: true, cliff: CLIFF_SEC });
}

export async function finale() {
  if (!todaysId) return false;
  return audio.playMedia(todaysId, { from: CLIFF_SEC });
}

export function stop() { audio.stopAll(); }

// App version: Android played this song for the alarm; remember it for the finale.
export function setToday(id) { todaysId = id; }
