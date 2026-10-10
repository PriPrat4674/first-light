// YouTube / YouTube Music setup inside the Sounds tab: paste a playlist link.
import { on } from '../core/events.js';
import { esc, refs, toast } from '../core/util.js';
import * as youtube from '../features/sources/youtube.js';

export function mount(el) {
  function render() {
    const st = youtube.status();
    el.innerHTML = `
      <p class="soft">Paste a public or unlisted playlist link from YouTube or YouTube Music. A different song plays each morning.</p>
      <label class="field" style="margin-top:12px"><span>Playlist link</span><input type="url" data-ref="url" value="${esc(st.url)}" placeholder="https://music.youtube.com/playlist?list=…" autocomplete="off" spellcheck="false"><div class="error hidden" data-ref="err"></div></label>
      <div class="row" style="margin-top:12px"><button class="btn gold" data-ref="save">Save link</button>${st.url ? '<button class="btn quiet" data-ref="clear">Remove</button>' : ''}</div>
      ${st.lastError ? `<p class="small" style="color:var(--danger);margin-top:10px">Last time: ${esc(st.lastError)}</p>` : ''}
      <p class="small muted italic" style="margin-top:12px">YouTube’s rules require the video to stay visible, so it appears on the alarm screen. Ads may play unless you have YouTube Premium. Run a test alarm on your phone to make sure it starts.</p>`;
    const r = refs(el);
    r.save.onclick = () => {
      const res = youtube.setLink(r.url.value);
      if (!res.ok) { r.err.textContent = res.reason; r.err.classList.remove('hidden'); return; }
      toast(res.listId ? 'Playlist saved.' : 'Video saved. It will loop.');
    };
    if (r.clear) r.clear.onclick = () => { youtube.clear(); toast('Link removed.'); };
  }
  on('youtube:changed', render);
  render();
}
