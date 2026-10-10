// One-time move of data saved by the earlier "Proof of Wake" builds, so your tasks,
// songs and streak carry over. Safe to delete this file once everyone has updated.
import { save, hasKey, media } from './storage.js';
import { emit } from './events.js';

function migrateSettings() {
  let old = null;
  try { old = JSON.parse(localStorage.getItem('pow:cfg') || 'null'); } catch {}
  if (!old) return false;
  if (!hasKey('alarm')) {
    save('alarm', { time: old.alarmTime || '06:30', armedAt: old.armed?.at ?? null, testAt: null });
    if (Array.isArray(old.tasks)) save('tasks', old.tasks.filter((t) => !t.chaos));
    save('checkin', { delayMin: old.checkinMin ?? 5, windowSec: old.checkinWin ?? 60 });
    save('songs', { queue: old.songQueue || [], last: old.lastSong || null });
    if (old.stats) {
      const { streak = 0, best = 0, wins = 0, lastWin = null, history = [] } = old.stats;
      save('streak', { streak, best, wins, lastWin, history });
    }
  }
  localStorage.removeItem('pow:cfg');
  localStorage.removeItem('pow:session');
  return true;
}

function migrateSongs() {
  try {
    const req = indexedDB.open('pow', 1);
    req.onupgradeneeded = () => req.transaction.abort(); // nothing to move
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('media', 'readonly').objectStore('media').getAll();
      get.onsuccess = async () => {
        for (const rec of get.result.filter((r) => r.kind === 'song')) await media.put(rec);
        db.close();
        indexedDB.deleteDatabase('pow');
        emit('songs:changed');
      };
    };
  } catch {}
}

if (migrateSettings()) migrateSongs();
