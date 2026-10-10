// Spotify setup inside the Sounds tab: Client ID → connect → pick a playlist.
import { on } from '../core/events.js';
import { esc, refs, toast } from '../core/util.js';
import * as spotify from '../features/sources/spotify.js';

export function mount(el) {
  let lists = null, loading = false;

  function render() {
    const st = spotify.status();
    if (!st.clientId) {
      el.innerHTML = `
        <p class="soft">Needs <strong>Spotify Premium</strong> and a free Spotify developer app (about 5 minutes, once).</p>
        <ol class="ritual" style="margin-top:10px">
          <li><span class="n">1</span><span>Open <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener" style="color:var(--accent-text)">developer.spotify.com/dashboard</a> and create an app.</span></li>
          <li><span class="n">2</span><span>Add this Redirect URI exactly:<br><code data-ref="uri" style="color:var(--accent-text);word-break:break-all">${esc(spotify.redirectUri())}</code></span></li>
          <li><span class="n">3</span><span>Tick <em>Web API</em> and <em>Web Playback SDK</em>, save, then copy the Client ID.</span></li>
        </ol>
        <label class="field" style="margin-top:12px"><span>Client ID</span><input type="text" data-ref="cid" autocomplete="off" spellcheck="false" placeholder="32 letters and numbers"><div class="error hidden" data-ref="err"></div></label>
        <div class="row" style="margin-top:12px"><button class="btn gold" data-ref="save">Save Client ID</button><button class="btn quiet" data-ref="copy">Copy Redirect URI</button></div>`;
      const r = refs(el);
      r.save.onclick = () => {
        const res = spotify.setClientId(r.cid.value);
        if (!res.ok) { r.err.textContent = res.reason; r.err.classList.remove('hidden'); return; }
        toast('Client ID saved.');
      };
      r.copy.onclick = async () => {
        try { await navigator.clipboard.writeText(spotify.redirectUri()); toast('Redirect URI copied.'); } catch { toast('Copy failed. Select the address and copy it by hand.'); }
      };
      return;
    }
    if (!st.connected) {
      el.innerHTML = `
        <p class="soft">Client ID saved. Connect your Spotify account to choose a playlist.</p>
        ${st.lastError ? `<p class="small" style="color:var(--danger);margin-top:8px">${esc(st.lastError)}</p>` : ''}
        <div class="row wrap" style="margin-top:12px"><button class="btn gold" data-ref="connect">Connect Spotify</button><button class="btn quiet" data-ref="reset">Change Client ID</button></div>`;
      const r = refs(el);
      r.connect.onclick = async () => { const res = await spotify.connect(); if (!res.ok) toast(res.reason); };
      r.reset.onclick = () => spotify.forget();
      return;
    }
    el.innerHTML = `
      <p class="soft">Signed in as <strong>${esc(st.user?.name || 'you')}</strong>.</p>
      <div class="card" style="background:var(--bg);margin-top:12px">
        <div class="card-head"><h3 style="font-size:1.05rem">Alarm playlist</h3><button class="btn quiet" data-ref="load">${lists ? 'Refresh' : 'Choose'}</button></div>
        <p class="${st.playlist ? '' : 'muted italic'}" style="margin-top:4px">${st.playlist ? esc(st.playlist.name) : 'None chosen yet.'}</p>
        <ul class="list ${lists ? '' : 'hidden'}" data-ref="lists"></ul>
      </div>
      ${st.lastError ? `<p class="small" style="color:var(--danger);margin-top:10px">Last time: ${esc(st.lastError)}</p>` : ''}
      <p class="small muted italic" style="margin-top:10px">Plays inside the app when it can, otherwise on your phone’s Spotify app if it’s open.</p>
      <button class="btn quiet" data-ref="out" style="margin-top:4px">Disconnect Spotify</button>`;
    const r = refs(el);
    if (lists) {
      r.lists.innerHTML = lists.length
        ? lists.map((p) => `<li><div class="grow"><strong>${esc(p.name)}</strong>${p.total != null ? `<span class="small muted">${p.total} songs</span>` : ''}</div><button class="btn line" data-pick="${esc(p.id)}" style="min-height:40px;padding:6px 14px">${st.playlist?.id === p.id ? 'Chosen' : 'Use'}</button></li>`).join('')
        : '<li class="empty">No playlists found on this account.</li>';
    }
    r.load.onclick = async () => {
      if (loading) return;
      loading = true; r.load.textContent = 'Loading…';
      try { lists = await spotify.playlists(); } catch (e) { toast(e.message || 'Could not load playlists.'); }
      loading = false; render();
    };
    r.lists.onclick = (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      spotify.choosePlaylist(lists.find((p) => p.id === b.dataset.pick));
      toast('Playlist chosen.');
    };
    r.out.onclick = () => { spotify.disconnect(); lists = null; toast('Spotify disconnected.'); };
  }

  on('spotify:changed', render);
  render();
  return { render };
}
