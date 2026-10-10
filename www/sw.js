// Offline cache. Bump VERSION whenever you deploy changes so phones pick them up.
const VERSION = 'first-light-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './vendor/capacitor.js',
  './js/config.js',
  './js/main.js',
  './js/ui/applock-view.js',
  './js/ui/art.js',
  './js/ui/boost-view.js',
  './js/ui/camera.js',
  './js/ui/checkin-view.js',
  './js/ui/components.js',
  './js/ui/home.js',
  './js/ui/install.js',
  './js/ui/morning-view.js',
  './js/ui/night-view.js',
  './js/ui/onboarding.js',
  './js/ui/pet-view.js',
  './js/ui/pickers.js',
  './js/ui/progress-view.js',
  './js/ui/recovery-view.js',
  './js/ui/settings-view.js',
  './js/ui/sleep-view.js',
  './js/ui/sounds-view.js',
  './js/ui/spotify-panel.js',
  './js/ui/tabs.js',
  './js/ui/tasks-editor.js',
  './js/ui/theme.js',
  './js/ui/youtube-panel.js',
  './js/services/audio.js',
  './js/services/battery.js',
  './js/services/native.js',
  './js/services/notify.js',
  './js/services/wakelock.js',
  './js/features/alarm.js',
  './js/features/applock.js',
  './js/features/battery-guard.js',
  './js/features/boost.js',
  './js/features/checkin.js',
  './js/features/keep-awake.js',
  './js/features/messages.js',
  './js/features/morning.js',
  './js/features/music.js',
  './js/features/native-sync.js',
  './js/features/pet.js',
  './js/features/profile.js',
  './js/features/recovery.js',
  './js/features/report.js',
  './js/features/ringer.js',
  './js/features/sleep.js',
  './js/features/snooze.js',
  './js/features/songs.js',
  './js/features/sounds.js',
  './js/features/stats.js',
  './js/features/tasks.js',
  './js/features/sources/local.js',
  './js/features/sources/spotify.js',
  './js/features/sources/youtube.js',
  './js/core/events.js',
  './js/core/migrate.js',
  './js/core/storage.js',
  './js/core/util.js',
  './fonts/bodoni-moda-latin-500-italic.woff2',
  './fonts/bodoni-moda-latin-500-normal.woff2',
  './fonts/bodoni-moda-latin-600-normal.woff2',
  './fonts/bodoni-moda-latin-700-normal.woff2',
  './fonts/courier-prime-latin-400-normal.woff2',
  './fonts/courier-prime-latin-700-normal.woff2',
  './fonts/dm-sans-latin-400-normal.woff2',
  './fonts/dm-sans-latin-500-normal.woff2',
  './fonts/dm-sans-latin-700-normal.woff2',
  './fonts/dm-serif-display-latin-400-normal.woff2',
  './fonts/eb-garamond-latin-400-italic.woff2',
  './fonts/eb-garamond-latin-400-normal.woff2',
  './fonts/eb-garamond-latin-500-normal.woff2',
  './fonts/eb-garamond-latin-600-normal.woff2',
  './fonts/nunito-latin-400-normal.woff2',
  './fonts/nunito-latin-600-normal.woff2',
  './fonts/nunito-latin-800-normal.woff2',
  './sounds/alarm_bells.mp3',
  './sounds/alarm_classic.mp3',
  './sounds/alarm_dawn.mp3',
  './sounds/note_bell.mp3',
  './sounds/note_chime.mp3',
  './sounds/note_harp.mp3',
  './sounds/note_marimba.mp3',
  './sounds/note_pluck.mp3',
  './sounds/note_warm.mp3',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: network first, so updates show up; cached copy when offline.
// Fonts: cache first.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && !url.hostname.includes('fonts.g')) return;

  if (sameOrigin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
