// Phone motion: counts real shakes and real steps from the accelerometer.
// There's deliberately no "tap instead" fallback. If the phone has no motion sensor, the caller
// hears about it (onNoSensor) and asks for a different proof.

// iPhone asks permission for motion, and only from a tap. Android and desktop don't ask.
export async function requestAccess() {
  const DME = window.DeviceMotionEvent;
  if (!DME) return false;
  if (typeof DME.requestPermission === 'function') {
    try { return (await DME.requestPermission()) === 'granted'; } catch { return false; }
  }
  return true;
}

const G = 9.81; // gravity, m/s²

/**
 * Counts motion until stop() is called. Returns stop.
 * kind 'shake': a hard jolt, well away from gravity, at most one every 220 ms.
 * kind 'step':  a walking bounce, at least 280 ms after the last one. Jolts too big to be a step
 *               are ignored, so shaking the phone doesn't count as walking.
 * onNoSensor(): no motion readings arrived within quietMs.
 */
export function count(kind, onCount, { onNoSensor = () => {}, quietMs = 3500 } = {}) {
  let n = 0, lastAt = -Infinity, live = false, base = G, rising = false, peak = 0;
  const handle = (ev) => {
    const a = ev.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    live = true;
    const mag = Math.hypot(a.x, a.y, a.z);
    const now = performance.now();
    // A shake is a jolt far from gravity. (Measuring against a moving average fails: during
    // steady shaking the average climbs and the jolts stop looking big.)
    if (kind === 'shake') {
      if (Math.abs(mag - G) > 9 && now - lastAt > 220) { lastAt = now; onCount(++n); }
      return;
    }
    // Steps: compare against a resting baseline that only adapts while the phone is calm,
    // so it absorbs a slightly off sensor but not the walking itself.
    const dev = mag - base;
    if (Math.abs(dev) < 0.6) base = base * 0.9 + mag * 0.1;
    if (!rising) {
      if (dev > 1.2) { rising = true; peak = dev; }
      return;
    }
    peak = Math.max(peak, dev);
    if (dev < 0.3) {
      rising = false;
      if (peak < 7 && now - lastAt > 280) { lastAt = now; onCount(++n); }
    }
  };
  window.addEventListener('devicemotion', handle);
  const quiet = setTimeout(() => { if (!live) onNoSensor(); }, quietMs);
  return () => { clearTimeout(quiet); window.removeEventListener('devicemotion', handle); };
}
