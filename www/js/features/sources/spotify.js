// Sound source: Spotify. Needs Spotify Premium and your own (free) Spotify developer app.
// Sign-in uses PKCE in the browser, so there is no server and no secret.
// Playback tries the in-app Spotify player first, then any of your active Spotify devices.
import { load, save } from '../../core/storage.js';
import { emit } from '../../core/events.js';
import { sleep } from '../../core/util.js';
import { APP_NAME, SPOTIFY_SCOPES } from '../../config.js';

export const id = 'spotify';
export const label = 'Spotify';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

let s = load('spotify', { clientId: '', token: null, playlist: null, user: null, lastError: null });
let sdkPlayer = null, sdkDeviceId = null, activeDevice = null;
let run = 0; // bumps on stop(), so a slow start can't begin playing after we've given up

const commit = () => { save('spotify', s); emit('spotify:changed', status()); };

export class SpotifyError extends Error {
  constructor(status, reason, message) { super(message); this.status = status; this.reason = reason; }
}

export const status = () => ({
  clientId: s.clientId, connected: !!s.token, user: s.user, playlist: s.playlist, lastError: s.lastError
});
export const redirectUri = () => location.origin + location.pathname;
export const isReady = async () => !!(s.token && s.playlist);
export const lastError = () => s.lastError;

const CLIENT_ID_RE = /^[0-9a-f]{32}$/i;
export function setClientId(value) {
  const v = String(value || '').trim();
  if (!CLIENT_ID_RE.test(v)) return { ok: false, reason: 'A Client ID is 32 letters and numbers. Copy it from your app in the Spotify developer dashboard.' };
  if (v !== s.clientId) { s.clientId = v; s.token = null; s.user = null; s.playlist = null; }
  commit();
  return { ok: true };
}

// Forget everything, including the Client ID.
export function forget() {
  try { sdkPlayer?.disconnect(); } catch {}
  sdkPlayer = null; sdkDeviceId = null;
  s = { clientId: '', token: null, playlist: null, user: null, lastError: null };
  commit();
}

/* ---------- Sign-in (PKCE) ---------- */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function randomString(n = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => chars[x % chars.length]).join('');
}

export async function connect() {
  if (!CLIENT_ID_RE.test(s.clientId)) return { ok: false, reason: 'Add your Spotify Client ID first.' };
  const verifier = randomString(64);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = randomString(16);
  save('spotify-pkce', { verifier, state, at: Date.now() });
  const q = new URLSearchParams({
    client_id: s.clientId, response_type: 'code', redirect_uri: redirectUri(),
    code_challenge_method: 'S256', code_challenge: challenge, scope: SPOTIFY_SCOPES.join(' '), state
  });
  location.assign(`${AUTH_URL}?${q}`);
  return { ok: true };
}

// Call once on startup. Returns null if this page load isn't a Spotify sign-in return.
export async function handleRedirect() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return null;
  const pkce = load('spotify-pkce', null);
  save('spotify-pkce', null);
  history.replaceState(null, '', location.pathname);
  if (p.get('error')) {
    return { ok: false, reason: p.get('error') === 'access_denied' ? 'Spotify sign-in was cancelled.' : `Spotify sign-in failed (${p.get('error')}).` };
  }
  if (!pkce || p.get('state') !== pkce.state) return { ok: false, reason: 'Spotify sign-in could not be verified. Tap Connect again.' };
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), client_id: s.clientId, code_verifier: pkce.verifier })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) return { ok: false, reason: data.error_description || 'Spotify did not accept the sign-in. Check that the Redirect URI in your Spotify app matches exactly.' };
    storeToken(data);
    try { const me = await api('/me'); s.user = { name: me?.display_name || me?.id || 'Spotify user' }; } catch { s.user = { name: 'Spotify user' }; }
    s.lastError = null;
    commit();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Could not reach Spotify. Check your connection and try again.' };
  }
}

function storeToken(data) {
  s.token = {
    access: data.access_token,
    refresh: data.refresh_token || s.token?.refresh || null,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
  };
}

export function disconnect() {
  s.token = null; s.user = null; s.playlist = null;
  try { sdkPlayer?.disconnect(); } catch {}
  sdkPlayer = null; sdkDeviceId = null;
  commit();
}

async function accessToken(force = false) {
  if (!s.token) throw new SpotifyError(401, 'NOT_CONNECTED', 'Spotify is not connected.');
  if (!force && Date.now() < s.token.expiresAt - 60_000) return s.token.access;
  if (!s.token.refresh) { disconnect(); throw new SpotifyError(401, 'EXPIRED', 'Spotify sign-in expired. Connect again.'); }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.token.refresh, client_id: s.clientId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    disconnect();
    throw new SpotifyError(401, 'EXPIRED', 'Spotify sign-in expired. Connect again.');
  }
  storeToken(data);
  save('spotify', s);
  return s.token.access;
}

async function api(path, { method = 'GET', body } = {}, retried = false) {
  const token = await accessToken();
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401 && !retried) { await accessToken(true); return api(path, { method, body }, true); }
  if (res.status === 204 || res.status === 202) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = data?.error?.reason || '';
    const msg = reason === 'PREMIUM_REQUIRED' ? 'Spotify playback needs a Premium account.'
      : reason === 'NO_ACTIVE_DEVICE' ? 'No Spotify device was available.'
      : res.status === 429 ? 'Spotify is rate-limiting requests. Try again later.'
      : data?.error?.message || `Spotify error ${res.status}.`;
    throw new SpotifyError(res.status, reason, msg);
  }
  return data;
}

/* ---------- Playlists ---------- */
export async function playlists() {
  const data = await api('/me/playlists?limit=50');
  return (data?.items || []).filter(Boolean).map((p) => ({
    id: p.id, name: p.name, uri: p.uri,
    total: (p.items || p.tracks)?.total ?? null
  }));
}

export function choosePlaylist(p) {
  if (!p?.uri?.startsWith('spotify:')) return false;
  s.playlist = { id: p.id, name: p.name, uri: p.uri, total: p.total ?? null };
  commit();
  return true;
}

/* ---------- In-app player (Web Playback SDK) ---------- */
function loadSdk() {
  if (window.Spotify?.Player) return Promise.resolve(true);
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve(true);
    const tag = document.createElement('script');
    tag.src = SDK_URL;
    tag.onerror = () => resolve(false);
    document.head.appendChild(tag);
    setTimeout(() => resolve(!!window.Spotify?.Player), 6000);
  });
}

async function sdkDevice() {
  if (sdkDeviceId) return sdkDeviceId;
  if (!(await loadSdk())) return null;
  return new Promise((resolve) => {
    const done = (v) => { clearTimeout(t); resolve(v); };
    const t = setTimeout(() => done(null), 6000);
    sdkPlayer = new window.Spotify.Player({ name: APP_NAME, getOAuthToken: (cb) => accessToken().then(cb).catch(() => cb('')), volume: 0.8 });
    sdkPlayer.addListener('ready', ({ device_id }) => { sdkDeviceId = device_id; done(device_id); });
    sdkPlayer.addListener('not_ready', () => { sdkDeviceId = null; });
    for (const ev of ['initialization_error', 'authentication_error', 'account_error']) {
      sdkPlayer.addListener(ev, ({ message }) => { s.lastError = `Spotify player: ${message}`; done(null); });
    }
    sdkPlayer.connect().then((ok) => { if (!ok) done(null); });
  });
}

// Call from a tap (e.g. when arming) so the in-app player is allowed to make sound later.
export async function prepare() {
  if (!s.token) return;
  try { await sdkDevice(); sdkPlayer?.activateElement?.(); } catch {}
}

async function anyDevice() {
  const data = await api('/me/player/devices');
  const list = data?.devices || [];
  const pick = list.find((d) => d.is_active) || list.find((d) => d.type === 'Smartphone') || list[0];
  return pick?.id || null;
}

/* ---------- Source interface ---------- */
export async function play({ day = 0 } = {}) {
  if (!s.token || !s.playlist) { s.lastError = 'Spotify is not set up.'; save('spotify', s); return false; }
  const mine = ++run;
  const cancelled = () => mine !== run;
  try {
    activeDevice = (await sdkDevice()) || (await anyDevice());
    if (cancelled()) return false;
    if (!activeDevice) throw new SpotifyError(404, 'NO_ACTIVE_DEVICE', 'No Spotify device was available.');
    const total = s.playlist.total;
    const dev = `device_id=${encodeURIComponent(activeDevice)}`;
    await api(`/me/player/shuffle?state=${total ? 'false' : 'true'}&${dev}`, { method: 'PUT' }).catch(() => {});
    const body = { context_uri: s.playlist.uri };
    if (total) body.offset = { position: day % total };
    if (cancelled()) return false;
    await api(`/me/player/play?${dev}`, { method: 'PUT', body });
    for (let i = 0; i < 4; i++) {
      await sleep(900);
      if (cancelled()) return false;
      const st = await api('/me/player').catch(() => null);
      if (st?.is_playing) { s.lastError = null; save('spotify', s); return true; }
    }
    throw new SpotifyError(0, 'NOT_PLAYING', 'Spotify accepted the request but did not start playing.');
  } catch (e) {
    s.lastError = e.message || 'Spotify could not play.';
    save('spotify', s);
    emit('spotify:changed', status());
    return false;
  }
}

export function stop() {
  run++;
  try { sdkPlayer?.pause(); } catch {}
  if (activeDevice && s.token) api(`/me/player/pause?device_id=${encodeURIComponent(activeDevice)}`, { method: 'PUT' }).catch(() => {});
  activeDevice = null;
}
