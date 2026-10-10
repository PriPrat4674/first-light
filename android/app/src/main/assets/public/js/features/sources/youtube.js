// Sound source: a YouTube or YouTube Music playlist, through YouTube's official embedded player.
// YouTube Music has no official API, and YouTube's rules require the player to stay visible,
// so the video shows on the alarm screen while it plays.
import { load, save } from '../../core/storage.js';
import { emit } from '../../core/events.js';

export const id = 'youtube';
export const label = 'YouTube';

const API_URL = 'https://www.youtube.com/iframe_api';
const ID_RE = /^[A-Za-z0-9_-]+$/;
let s = load('youtube', { url: '', listId: null, videoId: null, lastError: null });
let player = null, stage = null;

const commit = () => { save('youtube', s); emit('youtube:changed', status()); };
export const status = () => ({ ...s });
export const isReady = async () => !!(s.listId || s.videoId);
export const lastError = () => s.lastError;

// Accepts youtube.com, music.youtube.com, m.youtube.com and youtu.be links.
export function parse(input) {
  let u;
  try { u = new URL(String(input || '').trim()); } catch { return { ok: false, reason: 'That is not a link. Paste a YouTube or YouTube Music playlist link.' }; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (!['youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) return { ok: false, reason: 'Only YouTube and YouTube Music links work here.' };
  const listId = u.searchParams.get('list');
  const videoId = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
  if (listId === 'LM' || listId === 'WL') return { ok: false, reason: 'Liked Music and Watch Later are private. Make a public or unlisted playlist and use its link.' };
  if (listId && ID_RE.test(listId)) return { ok: true, listId, videoId: videoId && ID_RE.test(videoId) ? videoId : null };
  if (videoId && ID_RE.test(videoId) && videoId.length === 11) return { ok: true, listId: null, videoId };
  return { ok: false, reason: 'No playlist or video found in that link.' };
}

export function setLink(input) {
  const r = parse(input);
  if (!r.ok) return r;
  s = { url: String(input).trim(), listId: r.listId, videoId: r.videoId, lastError: null };
  commit();
  return r;
}
export function clear() { s = { url: '', listId: null, videoId: null, lastError: null }; commit(); }

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(true);
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(true); };
    const tag = document.createElement('script');
    tag.src = API_URL;
    tag.onerror = () => resolve(false);
    document.head.appendChild(tag);
    setTimeout(() => resolve(!!window.YT?.Player), 6000);
  });
}

function showStage() {
  stage = document.getElementById('media-stage');
  if (!stage) return null;
  stage.innerHTML = '<div class="yt-frame"><div id="yt-player"></div></div><p class="yt-note">Playing from YouTube</p>';
  stage.classList.remove('hidden');
  document.body.classList.add('media-on');
  return stage.querySelector('#yt-player');
}

export async function play({ day = 0 } = {}) {
  if (!s.listId && !s.videoId) return false;
  if (!(await loadApi())) { fail('Could not load the YouTube player. Check your connection.'); return false; }
  const mount = showStage();
  if (!mount) return false;
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    player = new window.YT.Player(mount, {
      width: '100%', height: '220',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin, ...(s.listId ? { listType: 'playlist', list: s.listId } : {}) },
      events: {
        onReady: () => {
          if (s.listId) player.cuePlaylist({ list: s.listId, listType: 'playlist' });
          else { player.loadVideoById(s.videoId); player.setLoop?.(true); }
        },
        onStateChange: (e) => {
          const YTS = window.YT.PlayerState;
          if (e.data === YTS.CUED && s.listId) {
            const ids = player.getPlaylist?.() || [];
            player.setLoop?.(true);
            player.playVideoAt(ids.length ? day % ids.length : 0);
          }
          if (e.data === YTS.PLAYING) { s.lastError = null; save('youtube', s); done(true); }
          if (e.data === YTS.ENDED && s.videoId && !s.listId) player.playVideo();
        },
        onError: (e) => {
          const msg = { 2: 'The playlist link is invalid.', 5: 'This video can’t play in an embedded player.', 100: 'The video or playlist was removed or is private.', 101: 'The owner doesn’t allow embedding.', 150: 'The owner doesn’t allow embedding.' }[e.data] || 'YouTube could not play this.';
          fail(msg);
          done(false);
        }
      }
    });
  });
}

function fail(msg) { s.lastError = msg; save('youtube', s); emit('youtube:changed', status()); }

export function stop() {
  try { player?.destroy(); } catch {}
  player = null;
  if (stage) { stage.innerHTML = ''; stage.classList.add('hidden'); }
  document.body.classList.remove('media-on');
}
