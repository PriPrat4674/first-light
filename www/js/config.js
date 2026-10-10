// App-wide constants and defaults. Change copy and defaults here, not inside features.

export const APP_NAME = 'First Light';
export const VERSION = '3.0.0';

export const TEST_DELAY_MS = 10_000;
// If the app was closed through a scheduled alarm, skip it rather than ringing hours late.
export const STALE_ALARM_MS = 30 * 60 * 1000;
export const DEFAULT_ALARM_TIME = '06:30';

// How long a streaming source gets to start playing before falling back to your own songs.
export const SOURCE_START_TIMEOUT_MS = 8000;

export const DEFAULT_TASKS = [
  { id: 't1', name: 'Open-eyes selfie', proof: 'a selfie with both eyes clearly open', gapMin: 0 },
  { id: 't2', name: 'Brushing teeth', proof: 'you brushing your teeth, toothbrush in mouth', gapMin: 0 },
  { id: 't3', name: 'Tea is ready', proof: 'a freshly made cup of tea', gapMin: 10 }
];
export const NEW_TASK = { name: 'New task', proof: 'what the photo should show', gapMin: 0 };
export const TASK_TEMPLATES = [
  { name: 'Make the bed', proof: 'a neatly made bed', gapMin: 0 },
  { name: 'Drink water', proof: 'a glass of water, half finished', gapMin: 0 },
  { name: 'Open the curtains', proof: 'open curtains with daylight', gapMin: 0 },
  { name: 'Stretch', proof: 'you mid-stretch', gapMin: 0 },
  { name: 'Wash your face', proof: 'a wet face or a towel in hand', gapMin: 0 },
  { name: 'Shoes on', proof: 'your shoes on your feet', gapMin: 0 }
];
export const MAX_TASKS = 12;
export const MAX_GAP_MIN = 120;

export const CHAOS_POOL = [
  { name: 'Something yellow', proof: 'any clearly yellow object' },
  { name: 'A spoon', proof: 'a spoon' },
  { name: 'Your left sock', proof: 'a sock, worn or held up' },
  { name: 'The sky', proof: 'the sky, through a window or outside' },
  { name: 'Something green and alive', proof: 'a living plant' },
  { name: 'Your shoes', proof: 'a pair of shoes' },
  { name: 'A book cover', proof: 'the cover of a physical book' },
  { name: 'Your reflection', proof: 'you in a mirror' }
];

export const CHECKIN_DEFAULTS = { delayMin: 5, windowSec: 60 };
export const CHECKIN_LIMITS = { delayMin: [1, 60], windowSec: [15, 300] };

export const SNOOZE_DEFAULTS = { enabled: true, minutes: 5, max: 2 };
export const SNOOZE_LIMITS = { minutes: [1, 30], max: [0, 5] };

// Battery guard: protects your phone from dying overnight.
export const BATTERY_DEFAULTS = { enabled: true, armBelow: 40, floor: 15 };
export const BATTERY_LIMITS = { armBelow: [10, 90], floor: [5, 50] };

export const DISMISS_PHRASES = [
  'My feet are on the floor and staying there',
  'My bed is lava and I am leaving it',
  'Future me will thank present me',
  'I am awake and I have things to do',
  'Pillows are for people who already won today',
  'The day starts now and so do I'
];
export const RETRY_PHRASES = [
  'I ignored my own check in and now I type this',
  'I promise to stop negotiating with my pillow'
];

// Spotify: create an app at developer.spotify.com and paste its Client ID in Sounds.
export const SPOTIFY_SCOPES = [
  'streaming', 'user-read-email', 'user-read-private',
  'user-read-playback-state', 'user-modify-playback-state', 'playlist-read-private'
];
