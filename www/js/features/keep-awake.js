// Keeps the screen on while the alarm is armed or a morning is in progress.
import { on } from '../core/events.js';
import { setAwake } from '../services/wakelock.js';
import * as alarm from './alarm.js';
import * as morning from './morning.js';
import * as native from '../services/native.js';

export function sync() {
  if (native.isNative()) return; // the APK rings with the screen off
  const a = alarm.status();
  setAwake(!!(a.armedAt || a.testAt || morning.isActive()));
}

on('alarm:changed', sync);
on('morning:changed', sync);
