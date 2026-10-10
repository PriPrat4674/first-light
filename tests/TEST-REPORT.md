# First Light — test report

Run on 2026-10-10 09:13 in headless Chromium at phone size (390×844).

**132 of 132 passed.** 84 valid-use cases, 48 invalid-input or failure cases.

Spotify and YouTube were replaced with local stand-ins (`tests/mocks/`), so these tests prove the app’s handling of each response, not Spotify’s or YouTube’s own servers. Run a test alarm on your phone to confirm those end to end.

| Result | Group | Type | Test | Time |
|---|---|---|---|---|
| ✅ | App | valid | Loads with no errors, correct title and five tabs | 0.8s |
| ✅ | App | valid | Every tab opens and shows its heading | 1.8s |
| ✅ | App | valid | Classic fonts are bundled and load offline (Bodoni Moda, EB Garamond) | 0.8s |
| ✅ | App | valid | Every button has an accessible name | 2.0s |
| ✅ | App | invalid | Corrupted saved data falls back to defaults instead of crashing | 0.8s |
| ✅ | App | invalid | Storage failure shows a clear message | 1.4s |
| ✅ | Alarm | valid | Changing the wake-up time is saved across a reload | 1.4s |
| ✅ | Alarm | invalid | Clearing the time field keeps the previous time | 0.8s |
| ✅ | Alarm | valid | Slide-to-arm works with the keyboard (Enter) | 1.2s |
| ✅ | Alarm | valid | Dragging the slider all the way arms the alarm | 1.5s |
| ✅ | Alarm | invalid | A short drag does not arm (prevents accidental taps) | 1.4s |
| ✅ | Alarm | valid | Disarm turns the alarm off | 1.2s |
| ✅ | Alarm | valid | Rings at the set time, then re-arms for the next day | 2.8s |
| ✅ | Alarm | invalid | An alarm missed while the app was closed does not ring hours late | 1.0s |
| ✅ | Alarm | valid | Test alarm rings after 10 seconds | 1.2s |
| ✅ | Alarm | invalid | A second alarm during an active morning is ignored | 1.6s |
| ✅ | Battery | invalid | Low battery, not charging: arming asks first; "plug in first" cancels | 1.1s |
| ✅ | Battery | valid | Low battery: "Arm anyway" arms | 1.3s |
| ✅ | Battery | valid | Low battery but charging arms without a warning | 1.1s |
| ✅ | Battery | valid | Guard switched off: no warning at low battery | 1.1s |
| ✅ | Battery | valid | Battery hits the floor unplugged while armed: alarm switches off and it is recorded | 1.5s |
| ✅ | Battery | valid | Battery at the floor while charging keeps the alarm armed | 1.4s |
| ✅ | Battery | invalid | Browser without battery info (e.g. iPhone): arms and advises plugging in | 1.2s |
| ✅ | Battery | invalid | Guard levels stay sensible: switch-off level can’t reach the warning level | 0.8s |
| ✅ | Battery | valid | Low battery during an active morning never stops the morning | 1.5s |
| ✅ | Night | valid | Arming opens the black night screen; "Back to the app" keeps it armed | 1.2s |
| ✅ | Night | valid | Night screen gives way to the alarm, and closes on disarm | 2.2s |
| ✅ | Ringing | invalid | A wrong phrase is rejected and the alarm keeps ringing | 1.5s |
| ✅ | Ringing | invalid | An empty phrase is rejected | 1.5s |
| ✅ | Ringing | valid | The phrase ignores capitals, extra spaces and punctuation | 1.5s |
| ✅ | Ringing | invalid | Pasting and dropping text into the phrase box is blocked | 1.2s |
| ✅ | Ringing | valid | Letters light up as you type, wrong letters are marked | 1.3s |
| ✅ | Snooze | valid | Snooze silences, logs to the Hall of Shame, and rings again after 5 minutes | 3.1s |
| ✅ | Snooze | valid | "I’m up" ends the snooze early so you can stop the alarm | 1.7s |
| ✅ | Snooze | invalid | After the snooze limit (2), the snooze option disappears | 2.0s |
| ✅ | Snooze | valid | Snooze switched off: no snooze button | 1.3s |
| ✅ | Snooze | invalid | No snooze on the punishment ring after a missed check-in | 3.6s |
| ✅ | Snooze | invalid | Snooze settings reject out-of-range and junk values | 0.8s |
| ✅ | Snooze | valid | Test-run snoozes stay out of your Hall of Shame and totals | 2.2s |
| ✅ | Check-in | valid | Check-in appears after 5 minutes; answering it stops the timer | 4.1s |
| ✅ | Check-in | invalid | Missing the check-in rings again with a harsher phrase and keeps task progress | 5.9s |
| ✅ | Check-in | invalid | Check-in steppers stop at their limits | 1.2s |
| ✅ | Check-in | valid | No check-in after the morning is finished | 5.3s |
| ✅ | Tasks | valid | Quick-add a template task and it is saved | 1.6s |
| ✅ | Tasks | invalid | An empty task name is refused and the old name kept | 1.1s |
| ✅ | Tasks | invalid | Wait time stays between 0 and 120 minutes, junk ignored | 0.8s |
| ✅ | Tasks | valid | Reorder and delete tasks | 1.2s |
| ✅ | Tasks | invalid | No more than 12 tasks | 1.1s |
| ✅ | Tasks | valid | A task with a wait stays locked until the wait is over | 6.4s |
| ✅ | Tasks | valid | With no tasks, typing the phrase finishes the morning | 1.6s |
| ✅ | Tasks | valid | Chaos task adds one random task at the end | 3.5s |
| ✅ | Tasks | invalid | Editing tasks mid-morning doesn’t change this morning’s list | 1.2s |
| ✅ | Camera | invalid | Camera blocked: clear message, task not completed | 2.0s |
| ✅ | Camera | valid | Capture, retake, then Next completes the task | 5.0s |
| ✅ | Camera | invalid | Cancelling the camera leaves the task open | 2.4s |
| ✅ | Progress | valid | Finishing shows the report card; a test run doesn’t touch the streak | 3.5s |
| ✅ | Progress | valid | A real morning adds to the streak, history and calendar | 3.7s |
| ✅ | Progress | valid | Grades follow snoozes, missed check-ins and time taken | 0.8s |
| ✅ | Progress | valid | Streak continues from yesterday and resets after a missed day | 4.0s |
| ✅ | Progress | invalid | An unfinished morning from yesterday is closed, not resumed | 0.8s |
| ✅ | Progress | valid | Reloading while the alarm rings keeps it ringing | 1.9s |
| ✅ | Sounds | invalid | Adding songs: audio files accepted, other files refused with a reason | 1.6s |
| ✅ | Sounds | valid | Song rotation: no repeats until every song has played | 1.6s |
| ✅ | Sounds | valid | Your songs play when the alarm rings; the rest plays when you finish | 3.2s |
| ✅ | Sounds | valid | No songs added: the alarm beeps | 1.2s |
| ✅ | Sounds | invalid | Punishment song: non-audio refused; audio plays after a missed check-in | 4.9s |
| ✅ | Boost | invalid | Voice note: empty recording refused; saved note plays after the check-in | 3.6s |
| ✅ | Boost | invalid | Clips: non-video refused; no boost screen when nothing is saved | 4.2s |
| ✅ | Spotify | invalid | Client ID: wrong format refused with an explanation, correct one saved | 1.4s |
| ✅ | Spotify | valid | Connect: secure sign-in (PKCE), token saved, playlists listed and chosen | 5.0s |
| ✅ | Spotify | invalid | Tampered sign-in (state mismatch) is rejected | 2.7s |
| ✅ | Spotify | invalid | Cancelled sign-in shows a message | 2.7s |
| ✅ | Spotify | valid | Alarm plays the playlist in the in-app Spotify player, starting at today’s song | 4.4s |
| ✅ | Spotify | invalid | No Premium: falls back to your songs/beeps and explains why | 3.3s |
| ✅ | Spotify | invalid | Expired sign-in that can’t refresh: disconnects and falls back | 2.7s |
| ✅ | Spotify | valid | Expired access token is refreshed automatically | 3.7s |
| ✅ | Spotify | valid | Disconnect clears the account | 1.3s |
| ✅ | YouTube | invalid | Link check: rejects non-links, other sites, private lists and junk | 0.8s |
| ✅ | YouTube | valid | Link check: accepts YouTube Music playlists, watch links and youtu.be | 0.8s |
| ✅ | YouTube | valid | Alarm shows the YouTube player on screen and plays; stopping removes it | 2.7s |
| ✅ | YouTube | invalid | Embedding not allowed: falls back to your songs/beeps | 2.0s |
| ✅ | YouTube | invalid | Player never starts (blocked autoplay): falls back within 8 seconds | 10.4s |
| ✅ | Data | valid | Erase all data asks first, then resets everything | 2.6s |
| ✅ | Data | invalid | Choosing "Keep my data" erases nothing | 1.8s |
| ✅ | Data | valid | Data from the original Proof of Wake build is carried over | 0.8s |
| ✅ | Data | valid | Offline: after one visit, the app opens with no connection | 5.1s |
| ✅ | Data | valid | Every app file is in the offline cache list | 0.0s |
| ✅ | Onboarding | valid | First run: setup walks through name, logo, colour, theme, font, style, sleep; choices are saved | 6.3s |
| ✅ | Onboarding | valid | Skipping the name works; Back keeps earlier choices | 1.9s |
| ✅ | Onboarding | invalid | Names are cleaned: no HTML, extra spaces, or over-long text | 0.8s |
| ✅ | Onboarding | invalid | Unknown look choices are refused; corrupted profile is repaired | 0.9s |
| ✅ | Look & feel | valid | All 768 combinations (4 logos × 4 colours × 4 themes × 4 fonts × 3 styles) apply and stay readable | 3.4s |
| ✅ | Look & feel | valid | Every bundled font file loads | 0.8s |
| ✅ | Look & feel | valid | Changing theme, font and logo in Settings is saved across a restart | 2.2s |
| ✅ | Messages | valid | A 4:00 alarm gets “Oho! … early riser” — every day | 1.0s |
| ✅ | Messages | valid | Messages change by day and time, mention streaks, and handle weekends | 0.8s |
| ✅ | Pip | valid | Pip’s mood follows your behaviour (happy, ecstatic, grumpy, sulking, sleepy) | 0.8s |
| ✅ | Pip | valid | Pip turns grumpy after a real snooze, and answers when poked | 2.5s |
| ✅ | Pip | valid | Opening the app: Pip flies in with “Good morning, Priya”, then the app appears; tap skips | 1.6s |
| ✅ | Sleep | valid | “Going to sleep” at 23:00, alarm stopped 7.5 h later: night logged as a little short | 2.0s |
| ✅ | Sleep | valid | A short night shows the research-backed day plan; tips can be ticked off | 2.8s |
| ✅ | Sleep | invalid | Nonsense nights aren’t logged (under 1 h or over 16 h); a good night hides the plan | 1.1s |
| ✅ | Sleep | invalid | Schedule rejects bad times and keeps the goal between 6 and 10 h | 0.8s |
| ✅ | Sleep | valid | Bedtime nudge: “In 30 minutes” reminds you; “Going to sleep” then a gentle “still awake?” | 18.5s |
| ✅ | Sleep | invalid | “Not tonight” stops nudges for the night; “still awake?” can be turned off | 26.1s |
| ✅ | Sleep | valid | Saturday after a short week: suggests a Sunday sleep-in (capped at 2 h) and moves the alarm in one tap | 1.5s |
| ✅ | Sleep | invalid | No sleep-in advice midweek, with too few nights, or after a good week | 2.4s |
| ✅ | Sleep | invalid | One-off alarm times reject bad dates and times; old ones are cleaned up | 0.8s |
| ✅ | Sleep | valid | This week’s sleep chart shows each night against the goal | 1.1s |
| ✅ | Sounds | valid | Every alarm and notification sound file is bundled | 0.8s |
| ✅ | Sounds | invalid | Choosing sounds: valid picks are saved and previewed, unknown ones refused | 1.8s |
| ✅ | Sounds | valid | Check-in plays your chosen sound in a loop (not beeps) | 3.4s |
| ✅ | Android | valid | Arming schedules Android’s alarm (repeats daily) and hands over today’s song; disarm cancels | 2.8s |
| ✅ | Android | valid | Test alarm is scheduled with Android for 10 seconds from now | 1.2s |
| ✅ | Android | valid | Android rings → app shows the alarm; stopping it silences Android | 1.9s |
| ✅ | Android | valid | Opened from the lock-screen alarm: the alarm screen is ready immediately | 1.2s |
| ✅ | Android | valid | Snooze is handed to Android, and its alarm brings the ring back | 1.8s |
| ✅ | Android | valid | Check-in: scheduled with Android; answering cancels it; missing it plays the punishment ring | 5.9s |
| ✅ | Android | valid | Bedtime nudges are scheduled daily with Android; turning them off cancels | 1.5s |
| ✅ | Android | valid | Bedtime answers given on the notification (app closed) count toward sleep tracking | 1.6s |
| ✅ | Android | valid | Picking a logo changes the home-screen icon; light theme switches status-bar icons | 1.5s |
| ✅ | Android | invalid | Missing permissions are flagged on the Alarm tab with a one-tap fix | 1.4s |
| ✅ | Android | valid | First-run setup includes a permissions step that can ask for notifications | 4.5s |
| ✅ | Android | valid | App lock: choose apps, it locks for real mornings, unlocks when proven (not for tests) | 5.3s |
| ✅ | Android | invalid | App lock refuses bad app names and keeps the auto-unlock between 1 and 6 h | 0.8s |
| ✅ | Android | invalid | Opening a locked app shows a reminder; emergency unlock needs the exact phrase and is recorded | 2.2s |
| ✅ | Android | valid | Spotify in the app: Android rings first, then Spotify takes over | 3.8s |
| ✅ | Android | valid | A Sunday sleep-in updates Android’s scheduled alarm | 1.3s |
| ✅ | Android | valid | The browser version never touches the Android bridge | 0.8s |
| ✅ | Android | valid | Locked apps are named nicely even without a label (com.instagram.android → Instagram) | 0.8s |
| ✅ | App | valid | Only one message (toast) shows at a time | 0.8s |
| ✅ | Android | valid | The permission warning clears once setup granted everything | 6.1s |

Re-run with `python3 tests/run_tests.py` (needs `pip install playwright` and `playwright install chromium`).

## Also checked

- **All look combinations:** one test applies all 768 combinations (4 logos × 4 colours × 4 themes × 4 fonts × 3 styles). Each one is checked for applied attributes, the right font and button shape, and text contrast of at least 4.5:1 (WCAG AA) for body text, secondary text, accent text on every background, button text, and warnings.
- **Android-only behaviour:** tested with a fake Android bridge (`tests/mocks/capacitor-native.js`) that records every call the app makes. This covers alarm scheduling, the lock-screen launch, snooze, check-in, the punishment ring, bedtime notifications, sleep events, app lock, the launcher icon, the status bar and permissions.
- **Native Java code:** compiled against the real Android 16 (API 36) platform library with stand-ins for Capacitor's classes. The only warnings are deliberate fallbacks for older Android versions.
- **First-time user walkthrough:** 27 screenshots in `tests/walkthrough/`, from first launch through setup, a full morning, Progress, and the app-lock reminder. Issues found there were fixed: a stale permission warning after setup, stacked messages, raw package names on the lock screen, a tiny logo on the last setup step, and weak typo highlighting. Tests were added for each.
- **Not yet tested:** a real phone. Run the checklist in the guide on your device.
