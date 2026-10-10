// Stand-in for Spotify's Embed iFrame API (open.spotify.com/embed/iframe-api/v1).
// window.__spEmbedMode: 'ok' (starts playing) | 'silent' (never starts). Records what was created.
(() => {
  const mode = window.__spEmbedMode || 'ok';
  const rec = window.__spEmbed = { created: [], played: 0, destroyed: 0 };
  const api = {
    createController(el, opts, cb) {
      rec.created.push(opts.uri);
      const frame = document.createElement('iframe');
      frame.title = 'Spotify';
      frame.dataset.uri = opts.uri;
      el.replaceWith(frame);
      const ls = {};
      const emit = (ev, data) => (ls[ev] || []).forEach((f) => f(data));
      const ctl = {
        addListener(ev, fn) { (ls[ev] ||= []).push(fn); },
        play() { rec.played++; if (mode === 'ok') setTimeout(() => emit('playback_update', { data: { isPaused: false, isBuffering: false, position: 1200, duration: 30000 } }), 300); },
        pause() {},
        destroy() { rec.destroyed++; frame.remove(); }
      };
      cb(ctl);
      setTimeout(() => emit('ready', {}), 100);
    }
  };
  setTimeout(() => window.onSpotifyIframeApiReady?.(api), 50);
})();
