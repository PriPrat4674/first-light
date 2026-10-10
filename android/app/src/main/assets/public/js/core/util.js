// Small shared helpers with no app knowledge.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Collect every [data-ref="name"] inside a root, so each view only touches its own elements.
export function refs(root) {
  const out = {};
  root.querySelectorAll('[data-ref]').forEach((el) => { out[el.dataset.ref] = el; });
  return out;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const pad = (n) => String(n).padStart(2, '0');
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtClock24 = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
export function fmtDur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${pad(s % 60)}`;
}
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Whole days since 1970 in local time. Used for daily rotations.
export const dayNumber = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function withTimeout(promise, ms, fallback = false) {
  return Promise.race([promise, new Promise((r) => setTimeout(() => r(fallback), ms))]);
}
export function vibrateTap(ms = 12) { try { navigator.vibrate?.(ms); } catch {} }

export function toast(msg, ms = 3000) {
  document.querySelectorAll('.toast').forEach((old) => old.remove()); // one message at a time
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
