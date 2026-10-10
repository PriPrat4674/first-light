// Sounds tab: what plays when the alarm rings, the punishment song, and the wake-up boost.
import { on } from '../core/events.js';
import { esc, refs, toast, fmtTime } from '../core/util.js';
import * as music from '../features/music.js';
import * as songs from '../features/songs.js';
import * as boost from '../features/boost.js';
import * as audio from '../services/audio.js';
import { ICONS, seg } from './components.js';
import * as spotifyPanel from './spotify-panel.js';
import * as youtubePanel from './youtube-panel.js';

const SOURCE_OPTIONS = [{ value: 'local', label: 'My songs' }, { value: 'spotify', label: 'Spotify' }, { value: 'youtube', label: 'YouTube' }];
const mb = (b) => `${(b.size / 1048576).toFixed(1)} MB`;

export function mount(root) {
  root.innerHTML = `
    <header class="screen-head"><h1>Sounds</h1><p>Choose what wakes you, what punishes you, and what gets you moving.</p></header>

    <div class="card">
      <h3>Alarm sound</h3>
      <div style="margin-top:12px" data-ref="seg"></div>
      <div class="notice card warn hidden" data-ref="fallback" style="margin-top:12px"></div>
      <div data-ref="local" style="margin-top:14px">
        <p class="soft">Your own songs, a different one each morning. Only the first 40 seconds loop while it rings; the rest plays when you’ve proven your morning.</p>
        <ul class="list" data-ref="songList"></ul>
        <label class="btn line block" style="margin-top:10px">Add songs<input type="file" accept="audio/*" multiple data-ref="songInput" hidden></label>
      </div>
      <div data-ref="spotify" style="margin-top:14px"></div>
      <div data-ref="youtube" style="margin-top:14px"></div>
      <p class="small muted italic hidden" data-ref="backupNote" style="margin-top:12px">If it doesn’t start within 8 seconds, your own songs play instead, or beeps if you haven’t added any.</p>
    </div>

    <div class="card">
      <h3>Punishment song</h3>
      <p class="soft">Plays if you miss the check-in. Pick one you can’t stand.</p>
      <ul class="list" data-ref="punish"></ul>
      <label class="btn line block" style="margin-top:10px">Choose a song<input type="file" accept="audio/*" data-ref="punishInput" hidden></label>
    </div>

    <div class="card">
      <h3>Wake-up boost</h3>
      <p class="soft">Plays after you pass the check-in: your voice note from last night, then a clip.</p>
      <hr class="rule">
      <div class="row between"><strong>Message from past you</strong><span class="small muted" data-ref="voiceMeta"></span></div>
      <div class="row wrap" style="margin-top:10px">
        <button class="btn gold" data-ref="rec">Record</button>
        <button class="btn line hidden" data-ref="playVoice">${ICONS.play} Play</button>
        <button class="btn quiet hidden" data-ref="delVoice">Delete</button>
      </div>
      <hr class="rule">
      <strong>Motivation clips</strong>
      <p class="small muted italic">Save reels you love to your phone, then add them here.</p>
      <ul class="list" data-ref="clips"></ul>
      <label class="btn line block" style="margin-top:10px">Add clips<input type="file" accept="video/*" multiple data-ref="clipInput" hidden></label>
    </div>`;
  const r = refs(root);
  spotifyPanel.mount(r.spotify);
  youtubePanel.mount(r.youtube);

  const removeBtn = (id, name) => `<button class="icon-btn" data-del="${id}" aria-label="Remove ${esc(name)}">${ICONS.x}</button>`;

  function renderSource() {
    const st = music.status();
    r.seg.innerHTML = seg('source', SOURCE_OPTIONS, st.source);
    r.local.classList.toggle('hidden', st.source !== 'local');
    r.spotify.classList.toggle('hidden', st.source !== 'spotify');
    r.youtube.classList.toggle('hidden', st.source !== 'youtube');
    r.backupNote.classList.toggle('hidden', st.source === 'local');
    const fb = st.lastFallback;
    r.fallback.classList.toggle('hidden', !fb || st.source === 'local');
    if (fb) r.fallback.innerHTML = `<p class="small"><strong>${esc(fb.source === 'spotify' ? 'Spotify' : 'YouTube')} didn’t start</strong> at ${fmtTime(new Date(fb.at))}. ${esc(fb.reason)} Your backup played instead.</p>`;
  }

  async function renderSongs() {
    const list = await songs.list();
    r.songList.innerHTML = list.length
      ? list.map((m) => `<li><div class="grow"><strong>${esc(m.name)}</strong><span class="small muted">${mb(m.blob)}</span></div>${removeBtn(m.id, m.name)}</li>`).join('')
      : '<li class="empty">No songs yet. Add a few you like waking up to.</li>';
  }

  async function renderPunish() {
    const p = await music.punishment();
    r.punish.innerHTML = p
      ? `<li><div class="grow"><strong>${esc(p.name)}</strong><span class="small muted">${mb(p.blob)}</span></div><button class="icon-btn" data-delpunish aria-label="Remove punishment song">${ICONS.x}</button></li>`
      : '<li class="empty">None chosen. A missed check-in will beep instead.</li>';
  }

  async function renderBoost() {
    const [v, c] = await Promise.all([boost.voice(), boost.clips()]);
    r.voiceMeta.textContent = v ? `Recorded ${new Date(v.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Not recorded';
    r.playVoice.classList.toggle('hidden', !v);
    r.delVoice.classList.toggle('hidden', !v);
    r.rec.textContent = v ? 'Record again' : 'Record';
    r.clips.innerHTML = c.length
      ? c.map((m) => `<li><div class="grow"><strong>${esc(m.name)}</strong><span class="small muted">${mb(m.blob)}</span></div><button class="icon-btn" data-delclip="${m.id}" aria-label="Remove ${esc(m.name)}">${ICONS.x}</button></li>`).join('')
      : '<li class="empty">No clips yet.</li>';
  }

  const report = ({ added, rejected }, noun) => {
    if (rejected.length) toast(`${added ? `Added ${added}. ` : ''}Skipped: ${rejected.join('; ')}.`, 5000);
    else if (added) toast(added > 1 ? `Added ${added} ${noun}s.` : `${noun[0].toUpperCase() + noun.slice(1)} added.`);
  };

  r.seg.addEventListener('click', (e) => { const b = e.target.closest('[data-value]'); if (b) music.setSource(b.dataset.value); });
  r.songInput.onchange = async (e) => { report(await songs.add([...e.target.files]), 'song'); e.target.value = ''; };
  r.songList.addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (b) songs.remove(b.dataset.del); });
  r.punishInput.onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const res = await music.setPunishment(f);
    toast(res.ok ? 'Punishment song set.' : res.reason);
  };
  r.punish.addEventListener('click', (e) => { if (e.target.closest('[data-delpunish]')) music.removePunishment(); });
  r.clipInput.onchange = async (e) => { report(await boost.addClips([...e.target.files]), 'clip'); e.target.value = ''; };
  r.clips.addEventListener('click', (e) => { const b = e.target.closest('[data-delclip]'); if (b) boost.removeClip(b.dataset.delclip); });

  /* Voice note recorder (max 30 s) */
  let rec = null, chunks = [], stopTimer = null;
  r.rec.onclick = async () => {
    if (rec?.state === 'recording') { rec.stop(); return; }
    if (!window.MediaRecorder) { toast('Recording isn’t supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.onstop = async () => {
        clearTimeout(stopTimer);
        stream.getTracks().forEach((t) => t.stop());
        const res = await boost.saveVoice(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        toast(res.ok ? 'Voice note saved.' : res.reason);
        renderBoost();
      };
      rec.start();
      r.rec.textContent = 'Stop recording';
      r.voiceMeta.textContent = 'Recording… tell tomorrow-you why getting up matters.';
      stopTimer = setTimeout(() => rec?.state === 'recording' && rec.stop(), 30_000);
    } catch { toast('Microphone blocked. Allow it in your browser settings.'); }
  };
  r.playVoice.onclick = async () => { audio.unlock(); const v = await boost.voice(); if (v && !(await audio.playBlob(v.blob))) toast('Couldn’t play the voice note.'); };
  r.delVoice.onclick = () => { boost.deleteVoice(); toast('Voice note deleted.'); };

  on('music:changed', () => { renderSource(); renderPunish(); });
  on('songs:changed', renderSongs);
  on('boost:changed', renderBoost);
  on('tab:shown', ({ tab }) => { if (tab === root.dataset.tab) { renderSource(); renderSongs(); renderPunish(); renderBoost(); } });
  renderSource();
}
