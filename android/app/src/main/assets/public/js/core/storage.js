// Persistence. Each feature saves under its own key ('alarm', 'tasks', ...),
// so features never share or overwrite each other's data.
import { emit } from './events.js';

const PREFIX = 'fl:';
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return clone(fallback);
    const val = JSON.parse(raw);
    // Saved data of the wrong shape (e.g. corrupted) falls back to the default.
    // New default fields appear automatically for older saved data.
    if (isObj(fallback)) return isObj(val) ? { ...clone(fallback), ...val } : clone(fallback);
    if (Array.isArray(fallback)) return Array.isArray(val) ? val : clone(fallback);
    return val ?? clone(fallback);
  } catch {
    return clone(fallback);
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    emit('storage:error');
    return false;
  }
}

export const hasKey = (key) => localStorage.getItem(PREFIX + key) != null;

/* Large files (songs) live in IndexedDB. */
const DB_NAME = 'first-light';
let dbp = null;

function openDb() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('media', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('media', mode);
    const req = fn(t.objectStore('media'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const media = {
  put: (rec) => tx('readwrite', (s) => s.put(rec)),
  get: (id) => tx('readonly', (s) => s.get(id)),
  del: (id) => tx('readwrite', (s) => s.delete(id)),
  all: () => tx('readonly', (s) => s.getAll()),
  async ofKind(kind) {
    try { return (await media.all()).filter((m) => m.kind === kind); } catch { return []; }
  }
};

export async function eraseAll() {
  Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  try { (await dbp)?.close(); } catch {}
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

/* ---------- Encrypted JSON Backup & Restore ---------- */

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function exportBackup(password = '') {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      try { data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); }
      catch { data[k.slice(PREFIX.length)] = localStorage.getItem(k); }
    }
  }
  const payload = { app: 'first-light', version: '3.1.0', exportedAt: Date.now(), data };
  const rawJson = JSON.stringify(payload);

  if (!password) {
    return JSON.stringify({ app: 'first-light', version: '3.1.0', encrypted: false, payload });
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(rawJson));

  return JSON.stringify({
    app: 'first-light',
    version: '3.1.0',
    encrypted: true,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(encData)
  }, null, 2);
}

export async function importBackup(jsonStr, password = '') {
  try {
    const doc = JSON.parse(String(jsonStr || '').trim());
    if (doc.app !== 'first-light') return { ok: false, error: 'Not a First Light backup file.' };

    let payload;
    if (doc.encrypted) {
      if (!password) return { ok: false, error: 'Password required to decrypt this backup.' };
      const salt = fromB64(doc.salt);
      const iv = fromB64(doc.iv);
      const ciphertext = fromB64(doc.ciphertext);
      const key = await deriveKey(password, salt);
      try {
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        payload = JSON.parse(new TextDecoder().decode(decrypted));
      } catch {
        return { ok: false, error: 'Incorrect password or corrupted backup file.' };
      }
    } else {
      payload = doc.payload;
    }

    if (!payload?.data || typeof payload.data !== 'object') {
      return { ok: false, error: 'Backup contains no valid data.' };
    }

    let count = 0;
    for (const [k, v] of Object.entries(payload.data)) {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
      count++;
    }

    emit('profile:changed');
    emit('tasks:changed');
    emit('streak:changed');
    emit('alarm:changed');
    emit('sleep:changed');
    return { ok: true, count };
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to read backup.' };
  }
}
