// Decides what the phone does during the morning: sound, vibration, notifications.
// Browser version: the page makes the sound. App version: Android rings (even with the app closed),
// and the page only takes over if you picked Spotify or YouTube and it starts.
import { on } from '../core/events.js';
import * as audio from '../services/audio.js';
import * as native from '../services/native.js';
import { notify } from '../services/notify.js';
import { APP_NAME } from '../config.js';
import * as music from './music.js';
import * as sounds from './sounds.js';

const inApp = native.isNative();

on('morning:ringing', async ({ escalated, fresh }) => {
  if (inApp) {
    if (escalated) { native.ring('punish'); return; }
    const st = await native.status();
    if (!st.ringing) await native.ring('wake');
    if (await music.startStreaming()) native.stopRinging();
    return;
  }
  await music.startAlarm({ escalated, fresh });
  music.rampUp();
  audio.vibrate(true);
  notify(escalated ? 'Round two' : 'Wake up', escalated ? 'You missed your check-in.' : 'Your alarm is ringing.');
});

const silence = () => { music.stopAll(); audio.vibrate(false); if (inApp) native.stopRinging(); };
on('morning:dismissed', silence);
on('morning:snoozed', silence);
on('morning:closed', silence);
on('morning:finished', () => { audio.vibrate(false); if (inApp) native.stopRinging(); music.finale(); });

on('checkin:open', async () => {
  if (inApp) {
    const st = await native.status();
    if (!st.ringing) native.ring('checkin');
    return;
  }
  if (!(await sounds.startLoop('checkin'))) audio.startBeeps();
  audio.vibrate(true);
  notify('Still up?', `Open ${APP_NAME} and answer the check-in now.`);
});
const endCheckinSound = () => { sounds.stopLoop(); audio.stopBeeps(); audio.vibrate(false); };
on('checkin:passed', endCheckinSound);
on('checkin:missed', endCheckinSound);
on('checkin:closed', () => sounds.stopLoop());
