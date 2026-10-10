// Stand-in for https://sdk.scdn.co/spotify-player.js used by the tests.
// window.__spotifySdkMode: 'ok' (default) | 'account_error' (non-Premium account)
window.Spotify = {
  Player: class {
    constructor(opts) { this.opts = opts; this.listeners = {}; window.__spotifyPlayer = this; }
    addListener(ev, fn) { this.listeners[ev] = fn; return true; }
    connect() {
      setTimeout(() => {
        if (window.__spotifySdkMode === 'account_error') this.listeners.account_error?.({ message: 'Spotify Premium required' });
        else this.listeners.ready?.({ device_id: 'sdk-device' });
      }, 30);
      return Promise.resolve(true);
    }
    pause() { window.__spotifyPaused = true; return Promise.resolve(); }
    activateElement() { window.__spotifyActivated = true; return Promise.resolve(); }
    disconnect() {}
  }
};
setTimeout(() => window.onSpotifyWebPlaybackSDKReady?.(), 10);
