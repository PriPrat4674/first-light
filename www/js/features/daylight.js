// Where the sky is and what it looks like right now: the city theme's place, or (for mood
// themes) roughly where the phone is, worked out from its time zone. No location permission.
// Pure maths plus the cached city weather, so it works offline.
import * as places from './places.js';

const RAD = Math.PI / 180;

// Sunrise and sunset (epoch ms) for a day at a place. NOAA's short formula, good to a few minutes.
// Returns null in polar day or night.
export function sunTimes(at, lat, lon) {
  const d = new Date(at);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const n = Math.floor((Date.UTC(y, m, day) - Date.UTC(y, 0, 0)) / 86400000);
  const g = (2 * Math.PI / 365) * (n - 0.5);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosH > 1 || cosH < -1) return null;
  const h = Math.acos(cosH) / RAD;
  const noon = Date.UTC(y, m, day);
  return { rise: noon + (720 - 4 * (lon + h) - eqt) * 60000, set: noon + (720 - 4 * (lon - h) - eqt) * 60000 };
}

// A representative spot for common time zones; anything else is placed on its zone's meridian.
const ZONES = {
  'Asia/Kolkata': [20.6, 77.2], 'Asia/Calcutta': [20.6, 77.2], 'Asia/Dubai': [25.2, 55.3], 'Asia/Singapore': [1.35, 103.8],
  'Asia/Tokyo': [35.7, 139.7], 'Asia/Seoul': [37.6, 127], 'Asia/Shanghai': [31.2, 121.5], 'Asia/Karachi': [24.9, 67],
  'Europe/London': [51.5, -0.1], 'Europe/Paris': [48.9, 2.35], 'Europe/Berlin': [52.5, 13.4],
  'America/New_York': [40.7, -74], 'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105], 'America/Los_Angeles': [34, -118.2], 'America/Toronto': [43.7, -79.4],
  'Australia/Sydney': [-33.9, 151.2], 'Africa/Lagos': [6.5, 3.4], 'America/Sao_Paulo': [-23.5, -46.6]
};
const REGION_LAT = { America: 35, Europe: 50, Asia: 25, Africa: 5, Australia: -30, Pacific: -15, Atlantic: 30, Indian: -10 };

export function phonePlace(at = Date.now()) {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  if (ZONES[tz]) return { tz, lat: ZONES[tz][0], lon: ZONES[tz][1] };
  const offsetMin = -new Date(at).getTimezoneOffset();
  return { tz, lat: REGION_LAT[tz.split('/')[0]] ?? 20, lon: offsetMin / 4 };
}

const FALLBACK = { rise: 6 * 60 + 15, set: 18 * 60 + 30 };
const minutesOf = (tz, ms) => places.minutesIn(tz, ms);

/**
 * Everything the sky needs right now: { mins, rise, set } in the place's local minutes,
 * plus the city (or null) and its weather effect (or null).
 */
export function skyNow(now = Date.now()) {
  const city = places.info(now);
  if (city) {
    const meta = places.PLACES[city.id];
    const w = city.weather;
    const t = w?.sunrise && w?.sunset ? { rise: w.sunrise, set: w.sunset } : sunTimes(now, meta.lat, meta.lon);
    return {
      mins: minutesOf(city.tz, now),
      rise: t ? minutesOf(city.tz, t.rise) : FALLBACK.rise,
      set: t ? minutesOf(city.tz, t.set) : FALLBACK.set,
      city, fx: w?.fx || null
    };
  }
  const here = phonePlace(now);
  const t = sunTimes(now, here.lat, here.lon);
  const d = new Date(now);
  const local = (ms) => { const x = new Date(ms); return x.getHours() * 60 + x.getMinutes(); };
  return { mins: d.getHours() * 60 + d.getMinutes(), rise: t ? local(t.rise) : FALLBACK.rise, set: t ? local(t.set) : FALLBACK.set, city: null, fx: null };
}
