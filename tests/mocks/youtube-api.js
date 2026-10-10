// Stand-in for https://www.youtube.com/iframe_api used by the tests.
// window.__ytMode: 'ok' (default) | 'error' (embedding not allowed) | 'blocked' (never starts, like blocked autoplay)
window.YT = {
  PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  Player: class {
    constructor(el, opts) {
      this.opts = opts;
      const f = document.createElement('iframe');
      f.id = 'yt-fake';
      f.title = 'YouTube video player';
      (typeof el === 'string' ? document.getElementById(el) : el).replaceWith(f);
      window.__yt = this;
      setTimeout(() => opts.events.onReady({ target: this }), 20);
    }
    emit(state) { setTimeout(() => this.opts.events.onStateChange({ data: state }), 20); }
    cuePlaylist(p) {
      this.list = p.list;
      if (window.__ytMode === 'error') { setTimeout(() => this.opts.events.onError({ data: 150 }), 20); return; }
      this.emit(5);
    }
    getPlaylist() { return ['v1', 'v2', 'v3']; }
    playVideoAt(i) { this.index = i; if (window.__ytMode !== 'blocked') this.emit(1); }
    loadVideoById(id) { this.video = id; if (window.__ytMode !== 'blocked') this.emit(1); }
    setLoop() {}
    playVideo() {}
    destroy() { document.getElementById('yt-fake')?.remove(); window.__ytDestroyed = true; }
  }
};
setTimeout(() => window.onYouTubeIframeAPIReady?.(), 10);
