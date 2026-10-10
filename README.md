# First Light 3.0

An alarm that makes you prove you're up, as an Android app (and still a website).
Type a phrase to stop it, answer a check-in, prove your morning with photos, and keep Instagram locked until you do.

**To build and install it, follow the guide "First Light: build the app and put it on your phone".**
Short version: publish this folder to GitHub, open the Actions tab, download the APK, install it.

## What's in phase 3

- Rings with the app closed and the phone locked (Android's own alarm system), over the lock screen, on the alarm volume.
- App lock: chosen apps stay closed until your morning is proven (auto-unlocks after 1–6 h; phone and messages never locked).
- First-run setup: name, logo (changes the home-screen icon), colour, theme, font, style, sleep schedule, permissions.
- Pip, the grumpy streak owl: six moods, fly-in greeting by name, pokeable.
- Messages that change with your alarm time ("Oho! We have an early riser tomorrow!!").
- Sleep tracking without a watch: bedtime nudge ("Going to sleep / In 30 min / Not tonight"), a warm "still awake?" check,
  too much / too little, a weekly chart, and a Sunday sleep-in suggestion (capped at 2 h) with a one-tap later alarm.
- Short-sleep day plan: seven cheap, research-backed tips with sources.
- Sound choices for the alarm, check-ins and messages.

## Layout

```
www/                 the app (HTML/CSS/JS modules, no build step)
  js/core/           event bus, storage, helpers
  js/services/       device abilities (audio, battery, notifications, native bridge)
  js/features/       behaviour: alarm, morning, checkin, snooze, sleep, pet, applock, music, ...
  js/ui/             one file per screen + shared components, theme engine, artwork
android/             Capacitor 8 Android project
  app/src/main/java/app/firstlight/alarm/
    FirstLightPlugin.java   bridge called from www/js/services/native.js
    AlarmScheduler.java     setAlarmClock / exact alarms, survives reboot (BootReceiver)
    AlarmService.java       rings on the alarm stream, full-screen notification
    Notifier.java, ActionReceiver.java   bedtime notifications with buttons
    LockService.java, AppLock.java       app lock (accessibility service)
.github/workflows/   builds the APK on GitHub
tests/               132 browser tests, test report, first-time-user walkthrough
```

## Develop

```
npm install
npx cap sync android     # copy www/ into the Android project
npx cap open android     # open in Android Studio
python3 tests/run_tests.py          # all tests (pip install playwright; playwright install chromium)
python3 tests/walkthrough.py        # screenshots of a first-time user's journey
```

Fonts: Bodoni Moda, EB Garamond, DM Serif Display, DM Sans, Nunito, Courier Prime (SIL Open Font License, in `www/fonts`).
