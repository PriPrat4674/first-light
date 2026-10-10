// Stand-in for the Android app's Capacitor bridge. Served instead of www/vendor/capacitor.js
// so the web code behaves as if it's running inside the APK. Every plugin call is recorded
// in window.__nativeCalls; tests fire native events with window.__nativeEmit(event, data).
(() => {
  const calls = [];
  window.__nativeCalls = calls;
  const listeners = {};
  const state = window.__nativeState = Object.assign({
    status: { exactAlarms: true, notifications: true, fullScreen: true, accessibility: false, batteryUnrestricted: true, ringing: false, lockedUntil: 0, sdk: 35 },
    launch: {},
    sleepEvents: [],
    apps: [{ pkg: 'com.google.android.youtube', label: 'YouTube' }, { pkg: 'com.instagram.android', label: 'Instagram' }, { pkg: 'com.snapchat.android', label: 'Snapchat' }]
  }, window.__nativeInit || {});
  if (window.__nativeInit?.status) state.status = Object.assign({}, { exactAlarms: true, notifications: true, fullScreen: true, accessibility: false, batteryUnrestricted: true, ringing: false, lockedUntil: 0, sdk: 35 }, window.__nativeInit.status);
  window.__nativeEmit = (event, data) => (listeners[event] || []).forEach((fn) => fn(data));

  const impl = {
    status: () => ({ ...state.status }),
    requestNotifications: () => { state.status.notifications = true; return { granted: true }; },
    takeLaunch: () => { const l = state.launch; state.launch = {}; return l; },
    takeSleepEvents: () => { const e = state.sleepEvents; state.sleepEvents = []; return { events: e }; },
    listApps: () => ({ apps: state.apps }),
    ring: () => { state.status.ringing = true; },
    stopRinging: () => { state.status.ringing = false; },
    lockNow: () => { state.status.lockedUntil = Date.now() + 3 * 3600e3; return { lockedUntil: state.status.lockedUntil }; },
    unlock: () => { state.status.lockedUntil = 0; }
  };

  const plugin = (name) => new Proxy({}, {
    get: (_, method) => {
      if (method === 'then') return undefined;
      if (method === 'addListener') return (ev, fn) => { (listeners[ev] ||= []).push(fn); return Promise.resolve({ remove() {} }); };
      return (args = {}) => {
        const copy = JSON.parse(JSON.stringify(args));
        if (copy.base64) copy.base64 = `<${copy.base64.length} chars>`;
        calls.push({ plugin: name, method, args: copy });
        const f = name === 'FirstLight' ? impl[method] : null;
        return Promise.resolve(f ? f(args) : undefined);
      };
    }
  });
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: plugin };
  window.capacitorExports = { SystemBars: plugin('SystemBars') };
})();
