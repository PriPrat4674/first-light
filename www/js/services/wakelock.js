// Keeps the screen on. Re-acquires the lock when the app comes back to the foreground.
let lock = null, wanted = false;

export async function setAwake(on) {
  wanted = on;
  try {
    if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { console.warn('wake lock', e); }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wanted) setAwake(true);
});
