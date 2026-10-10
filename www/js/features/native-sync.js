// Android app only: keeps Android's own alarms in step with the app, and turns things that happened
// while the app was closed (an alarm ringing, a bedtime answer, a locked app) into app events.
import { on, emit } from '../core/events.js';
import * as native from '../services/native.js';
import * as alarm from './alarm.js';
import * as morning from './morning.js';
import * as snooze from './snooze.js';
import * as checkin from './checkin.js';
import * as songs from './songs.js';
import * as sleep from './sleep.js';
import * as sounds from './sounds.js';
import * as applock from './applock.js';
import { media, load, save } from '../core/storage.js';
import * as local from './sources/local.js';

let lastSongFor = load('native-song-for', null); // so reopening the app doesn't skip songs

async function syncAlarm(a = alarm.status()) {
  if (a.armedAt) {
    await native.schedule('wake', a.armedAt, 'wake', true);
    // Hand today's song to Android so it can play with the app closed.
    if (lastSongFor !== a.armedAt) {
      lastSongFor = a.armedAt;
      save('native-song-for', lastSongFor);
      const id = await songs.next();
      local.setToday(id);
      const rec = id ? await media.get(id).catch(() => null) : null;
      await native.setSoundFile('alarm', rec?.blob || null);
    }
  } else {
    native.cancel('wake');
    lastSongFor = null;
  }
  if (a.testAt) native.schedule('test', a.testAt, 'test'); else native.cancel('test');
}

function handleFire(kind) {
  if (kind === 'wake' || kind === 'test') {
    if (!morning.isActive()) emit('alarm:fire', { test: kind === 'test', fromNative: true });
  } else if (kind === 'snooze') {
    snooze.endNow();
  }
}

function handleLaunch(launch = {}) {
  if (launch.kind) handleFire(launch.kind);
  if (launch.lockedPkg) emit('applock:blocked', { pkg: launch.lockedPkg, label: applock.labelFor(launch.lockedPkg, launch.lockedLabel) });
}

async function catchUp() {
  handleLaunch(await native.takeLaunch());
  sleep.applyNativeEvents(await native.takeSleepEvents());
}

export async function init() {
  if (!native.isNative()) return;
  on('alarm:changed', syncAlarm);
  on('snooze:started', ({ until }) => native.schedule('snooze', until, 'snooze'));
  on('snooze:ended', () => native.cancel('snooze'));
  on('checkin:scheduled', ({ dueAt }) => native.schedule('checkin', dueAt, 'checkin'));
  const endCheckin = () => native.cancel('checkin');
  on('checkin:passed', () => { endCheckin(); native.stopRinging(); });
  on('checkin:missed', endCheckin);
  on('morning:finished', endCheckin);
  on('morning:closed', endCheckin);
  native.on('alarm', ({ kind }) => handleFire(kind));
  native.on('launch', handleLaunch);
  native.on('locked', ({ pkg, label }) => emit('applock:blocked', { pkg, label: applock.labelFor(pkg, label) }));
  native.on('sleepEvent', async () => sleep.applyNativeEvents(await native.takeSleepEvents()));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') catchUp(); });

  sounds.sync();
  sleep.syncNative();
  applock.sync();
  await syncAlarm();
  await catchUp();
  // If the app was killed mid-morning, make sure Android still knows about the check-in.
  const c = checkin.state();
  if (c.dueAt && !c.passed) native.schedule('checkin', c.dueAt, 'checkin');
}
