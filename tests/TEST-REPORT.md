# First Light — test report

Run on 2026-10-10 13:49 in headless Chromium at phone size (390×844).

**162 of 162 passed.** 107 valid-use cases, 55 invalid-input or failure cases.

Spotify, YouTube, the Android bridge, and the city weather/news/Wikipedia services were replaced with local stand-ins (`tests/mocks/` and routes in `App._route_net`), so these tests prove the app’s handling of each response, not those servers themselves. Run a test alarm on your phone to confirm those end to end.

| Result | Group | Type | Test | Time |
|---|---|---|---|---|
| ✅ | App | valid | Loads with no errors, correct title, four everyday tabs and a ☰ menu | 0.9s |
| ✅ | App | valid | Every tab opens and the top bar names it | 2.0s |
| ✅ | App | valid | ☰ menu opens each settings group on its own page; Back returns; Escape closes the menu | 6.9s |
| ✅ | App | valid | Classic fonts are bundled and load offline (Bodoni Moda, EB Garamond) | 0.9s |
| ✅ | App | valid | Every button has an accessible name | 2.1s |
| ✅ | App | invalid | Corrupted saved data falls back to defaults instead of crashing | 0.8s |
| ✅ | App | invalid | Storage failure shows a clear message | 1.3s |
| ✅ | Alarm | valid | Changing the wake-up time is saved across a reload | 1.7s |
| ✅ | Alarm | invalid | Clearing the time field keeps the previous time | 0.9s |
| ✅ | Alarm | valid | Slide-to-arm works with the keyboard (Enter) | 1.2s |
| ✅ | Alarm | valid | Dragging the slider all the way arms the alarm | 1.6s |
| ✅ | Alarm | invalid | A short drag does not arm (prevents accidental taps) | 1.4s |
| ✅ | Alarm | valid | Disarm turns the alarm off | 1.3s |
| ✅ | Alarm | valid | Rings at the set time, then re-arms for the next day | 2.3s |
| ✅ | Alarm | invalid | An alarm missed while the app was closed does not ring hours late | 1.1s |
| ✅ | Alarm | valid | Test alarm rings after 10 seconds | 1.3s |
| ✅ | Alarm | invalid | A second alarm during an active morning is ignored | 1.7s |
| ✅ | Battery | invalid | Low battery, not charging: arming asks first; "plug in first" cancels | 1.3s |
| ✅ | Battery | valid | Low battery: "Arm anyway" arms | 1.4s |
| ✅ | Battery | valid | Low battery but charging arms without a warning | 1.2s |
| ✅ | Battery | valid | Guard switched off: no warning at low battery | 1.2s |
| ✅ | Battery | valid | Battery hits the floor unplugged while armed: alarm switches off and it is recorded | 1.5s |
| ✅ | Battery | valid | Battery at the floor while charging keeps the alarm armed | 1.5s |
| ✅ | Battery | invalid | Browser without battery info (e.g. iPhone): arms and advises plugging in | 1.3s |
| ✅ | Battery | invalid | Guard levels stay sensible: switch-off level can’t reach the warning level | 0.9s |
| ✅ | Battery | valid | Low battery during an active morning never stops the morning | 1.6s |
| ✅ | Night | valid | Arming opens the black night screen; "Back to the app" keeps it armed | 1.3s |
| ✅ | Night | valid | Night screen gives way to the alarm, and closes on disarm | 2.4s |
| ✅ | Ringing | invalid | A wrong phrase is rejected and the alarm keeps ringing | 1.6s |
| ✅ | Ringing | invalid | An empty phrase is rejected | 1.6s |
| ✅ | Ringing | valid | The phrase ignores capitals, extra spaces and punctuation | 1.7s |
| ✅ | Ringing | invalid | Pasting and dropping text into the phrase box is blocked | 1.3s |
| ✅ | Ringing | valid | Letters light up as you type, wrong letters are marked | 1.3s |
| ✅ | Snooze | valid | Snooze silences, logs to the Hall of Shame, and rings again after 5 minutes | 3.2s |
| ✅ | Snooze | valid | "I’m up" ends the snooze early so you can stop the alarm | 1.8s |
| ✅ | Snooze | invalid | After the snooze limit (2), the snooze option disappears | 2.1s |
| ✅ | Snooze | valid | Snooze switched off: no snooze button | 1.3s |
| ✅ | Snooze | invalid | No snooze on the punishment ring after a missed check-in | 3.8s |
| ✅ | Snooze | invalid | Snooze settings reject out-of-range and junk values | 0.8s |
| ✅ | Snooze | valid | Test-run snoozes stay out of your Hall of Shame and totals | 2.3s |
| ✅ | Check-in | valid | Check-in appears after 5 minutes; answering it stops the timer | 4.3s |
| ✅ | Check-in | invalid | Missing the check-in rings again with a harsher phrase and keeps task progress | 6.1s |
| ✅ | Check-in | invalid | Check-in steppers stop at their limits | 1.2s |
| ✅ | Check-in | valid | No check-in after the morning is finished | 5.4s |
| ✅ | Tasks | valid | Quick-add a template task and it is saved | 1.8s |
| ✅ | Tasks | invalid | An empty task name is refused and the old name kept | 1.2s |
| ✅ | Tasks | invalid | Wait time stays between 0 and 120 minutes, junk ignored | 0.8s |
| ✅ | Tasks | valid | Reorder and delete tasks | 1.3s |
| ✅ | Tasks | invalid | No more than 12 tasks | 1.2s |
| ✅ | Tasks | valid | A task with a wait stays locked until the wait is over | 6.6s |
| ✅ | Tasks | valid | With no tasks, typing the phrase finishes the morning | 1.7s |
| ✅ | Tasks | valid | Chaos task adds one random task at the end | 3.7s |
| ✅ | Tasks | invalid | Editing tasks mid-morning doesn’t change this morning’s list | 1.3s |
| ✅ | Camera | invalid | Camera blocked: clear message, task not completed | 2.1s |
| ✅ | Camera | valid | Capture, retake, then Next completes the task | 5.3s |
| ✅ | Camera | invalid | Cancelling the camera leaves the task open | 2.6s |
| ✅ | Progress | valid | Finishing shows the report card; a test run doesn’t touch the streak | 3.7s |
| ✅ | Progress | valid | A real morning adds to the streak, history and calendar | 3.9s |
| ✅ | Progress | valid | Grades follow snoozes, missed check-ins and time taken | 0.8s |
| ✅ | Progress | valid | Streak continues from yesterday and resets after a missed day | 4.1s |
| ✅ | Progress | invalid | An unfinished morning from yesterday is closed, not resumed | 0.9s |
| ✅ | Progress | valid | Reloading while the alarm rings keeps it ringing | 2.2s |
| ✅ | Sounds | invalid | Adding songs: audio files accepted, other files refused with a reason | 1.6s |
| ✅ | Sounds | valid | Song rotation: no repeats until every song has played | 1.6s |
| ✅ | Sounds | valid | Your songs play when the alarm rings; the rest plays when you finish | 3.3s |
| ✅ | Sounds | valid | No songs added: the alarm beeps | 1.3s |
| ✅ | Sounds | invalid | Punishment song: non-audio refused; audio plays after a missed check-in | 5.2s |
| ✅ | Boost | invalid | Voice note: empty recording refused; saved note plays after the check-in | 3.8s |
| ✅ | Boost | invalid | Clips: non-video refused; no boost screen when nothing is saved | 4.3s |
| ✅ | Spotify | valid | No Client ID to type: “Connect Spotify” appears only when the app has its own Spotify ID | 1.4s |
| ✅ | Spotify | valid | Connect: secure sign-in (PKCE), token saved, playlists listed and chosen | 5.0s |
| ✅ | Spotify | invalid | Tampered sign-in (state mismatch) is rejected | 2.8s |
| ✅ | Spotify | invalid | Cancelled sign-in shows a message | 2.8s |
| ✅ | Spotify | valid | Alarm plays the playlist in the in-app Spotify player, starting at today’s song | 4.4s |
| ✅ | Spotify | invalid | No Premium: falls back to your songs/beeps and explains why | 3.5s |
| ✅ | Spotify | invalid | Expired sign-in that can’t refresh: disconnects and falls back | 2.8s |
| ✅ | Spotify | valid | Expired access token is refreshed automatically | 3.8s |
| ✅ | Spotify | valid | Disconnect clears the account | 1.3s |
| ✅ | YouTube | invalid | Link check: rejects non-links, other sites, private lists and junk | 0.8s |
| ✅ | YouTube | valid | Link check: accepts YouTube Music playlists, watch links and youtu.be | 0.9s |
| ✅ | YouTube | valid | Alarm shows the YouTube player on screen and plays; stopping removes it | 2.7s |
| ✅ | YouTube | invalid | Embedding not allowed: falls back to your songs/beeps | 2.1s |
| ✅ | YouTube | invalid | Player never starts (blocked autoplay): falls back within 8 seconds | 10.3s |
| ✅ | Data | valid | Erase all data asks first, then resets everything | 2.7s |
| ✅ | Data | invalid | Choosing "Keep my data" erases nothing | 1.8s |
| ✅ | Data | valid | Data from the original Proof of Wake build is carried over | 0.9s |
| ✅ | Data | valid | Offline: after one visit, the app opens with no connection | 5.4s |
| ✅ | Data | valid | Every app file is in the offline cache list | 0.0s |
| ✅ | Onboarding | valid | First run: setup walks through name, logo, colour, theme, font, style, sleep; choices are saved | 6.6s |
| ✅ | Onboarding | valid | Skipping the name works; Back keeps earlier choices | 2.0s |
| ✅ | Onboarding | invalid | Names are cleaned: no HTML, extra spaces, or over-long text | 0.8s |
| ✅ | Pip | valid | Pip is a tiger cub: every pose has artwork, the old Owl logo becomes Tiger (same home-screen icon) | 1.8s |
| ✅ | Onboarding | invalid | Unknown look choices are refused; corrupted profile is repaired | 0.9s |
| ✅ | Look & feel | valid | All 3,456 combinations (4 logos × 4 colours × 9 themes × 8 fonts × 3 styles) apply and stay readable | 28.9s |
| ✅ | Look & feel | valid | Every bundled font file loads | 1.0s |
| ✅ | Look & feel | valid | Changing theme, font and logo in Settings is saved across a restart | 2.5s |
| ✅ | Messages | valid | A 4:00 alarm gets “Oho! … early riser” — every day | 1.1s |
| ✅ | Messages | valid | Messages change by day and time, mention streaks, and handle weekends | 0.9s |
| ✅ | Pip | valid | Pip’s mood follows your behaviour (happy, ecstatic, grumpy, sulking, sleepy) | 0.9s |
| ✅ | Pip | valid | Pip turns grumpy after a real snooze, and answers when poked | 2.7s |
| ✅ | Pip | valid | Opening the app: Pip leaps in with “Good morning, Priya”, then the app appears; tap skips | 1.8s |
| ✅ | Sleep | valid | “Going to sleep” at 23:00, alarm stopped 7.5 h later: night logged as a little short | 2.1s |
| ✅ | Sleep | valid | A short night shows the research-backed day plan; tips can be ticked off | 3.1s |
| ✅ | Sleep | invalid | Nonsense nights aren’t logged (under 1 h or over 16 h); a good night hides the plan | 1.2s |
| ✅ | Sleep | invalid | Schedule rejects bad times; the goal can go as low as 1 h (never 0 or negative) and up to 12 h | 0.9s |
| ✅ | Sleep | valid | Sleep goal stepper goes down to 1 h in Settings, with a kind note under 5 h; a 4 h night on a 4 h goal counts as rested | 1.8s |
| ✅ | Sleep | valid | Bedtime nudge: “In 30 minutes” reminds you; “Going to sleep” then a gentle “still awake?” | 18.7s |
| ✅ | Sleep | invalid | “Not tonight” stops nudges for the night; “still awake?” can be turned off | 26.3s |
| ✅ | Sleep | valid | Saturday after a short week: suggests a Sunday sleep-in (capped at 2 h) and moves the alarm in one tap | 1.6s |
| ✅ | Sleep | invalid | No sleep-in advice midweek, with too few nights, or after a good week | 2.6s |
| ✅ | Sleep | invalid | One-off alarm times reject bad dates and times; old ones are cleaned up | 0.9s |
| ✅ | Sleep | valid | This week’s sleep chart shows each night against the goal | 1.2s |
| ✅ | Sounds | valid | Every alarm and notification sound file is bundled | 0.9s |
| ✅ | Sounds | invalid | Choosing sounds: valid picks are saved and previewed, unknown ones refused | 1.9s |
| ✅ | Sounds | valid | Check-in plays your chosen sound in a loop (not beeps) | 3.5s |
| ✅ | Android | valid | Arming schedules Android’s alarm (repeats daily) and hands over today’s song; disarm cancels | 2.9s |
| ✅ | Android | valid | Test alarm is scheduled with Android for 10 seconds from now | 1.2s |
| ✅ | Android | valid | Android rings → app shows the alarm; stopping it silences Android | 2.0s |
| ✅ | Android | valid | Opened from the lock-screen alarm: the alarm screen is ready immediately | 1.3s |
| ✅ | Android | valid | Snooze is handed to Android, and its alarm brings the ring back | 1.9s |
| ✅ | Android | valid | Check-in: scheduled with Android; answering cancels it; missing it plays the punishment ring | 6.1s |
| ✅ | Android | valid | Bedtime nudges are scheduled daily with Android; turning them off cancels | 1.5s |
| ✅ | Android | valid | Bedtime answers given on the notification (app closed) count toward sleep tracking | 1.6s |
| ✅ | Android | valid | Picking a logo changes the home-screen icon; light theme switches status-bar icons | 1.6s |
| ✅ | Android | invalid | Missing permissions are flagged on the Alarm tab with a one-tap fix | 1.5s |
| ✅ | Android | valid | First-run setup includes a permissions step that can ask for notifications | 4.7s |
| ✅ | Android | valid | App lock: choose apps, it locks for real mornings, unlocks when proven (not for tests) | 5.3s |
| ✅ | Android | invalid | App lock refuses bad app names and keeps the auto-unlock between 1 and 6 h | 0.9s |
| ✅ | Android | invalid | Opening a locked app shows a reminder; emergency unlock needs the exact phrase and is recorded | 2.2s |
| ✅ | Android | valid | Spotify in the app: Android rings first, then Spotify takes over | 3.9s |
| ✅ | Android | valid | A Sunday sleep-in updates Android’s scheduled alarm | 1.3s |
| ✅ | Android | valid | The browser version never touches the Android bridge | 0.8s |
| ✅ | Android | valid | Locked apps are named nicely even without a label (com.instagram.android → Instagram) | 0.8s |
| ✅ | App | valid | Only one message (toast) shows at a time | 0.9s |
| ✅ | Android | valid | The permission warning clears once setup granted everything | 5.9s |
| ✅ | Cities | valid | Kerala theme: skyline, live weather, and an upbeat headline (gloomy news is skipped) | 1.3s |
| ✅ | Cities | invalid | Offline or blocked: the city card still shows a built-in fact, with no errors | 1.0s |
| ✅ | Cities | invalid | Only upbeat, well-formed headlines are used; titles are cleaned | 0.9s |
| ✅ | Cities | valid | In the app, city data goes through Android’s own HTTP client; tapping the headline opens it outside the app | 1.2s |
| ✅ | Cities | valid | Every city has its own skyline and palette; the theme picker groups Moods and Cities | 6.6s |
| ✅ | Sky | valid | The home sky follows the clock: stars at night, first rays at dawn, full sun at noon, orange glow at golden hour | 1.5s |
| ✅ | Sky | valid | City weather shows in the sky: fog in San Francisco, snow in Seoul, clouds in Tokyo | 4.2s |
| ✅ | Pip | valid | Pip really leaps in: he bounds along a curved path, lands, waves and says hello | 1.2s |
| ✅ | Pip | valid | Pip leaps in after setup, when you come back after 30+ minutes, and does a victory lap after a proven morning | 17.6s |
| ✅ | Pip | invalid | With reduced motion, Pip appears and waves without leaping | 1.1s |
| ✅ | Naps | valid | “Going to sleep” in the afternoon asks about a nap, sets a timer, wakes you, and logs the nap as sleep | 7.8s |
| ✅ | Naps | valid | At bedtime it tracks the night (no nap question); “No, I’m going to bed” also starts a night | 2.1s |
| ✅ | Naps | invalid | Nap length stays between 5 minutes and 4 hours; waking early logs the real time; cancelling sets nothing | 5.8s |
| ✅ | Naps | valid | In the app, the nap alarm is Android’s (rings with the app closed) and “I’m up” silences it | 1.8s |
| ✅ | Morning | valid | You can leave the task list: a top-bar pill counts down, says when it’s time, and brings you back | 5.8s |
| ✅ | Morning | valid | In the app, a task’s wait is handed to Android as a notification | 1.6s |
| ✅ | Morning | valid | Test alarm ends right after the phrase (“It works!”); “Try the full morning” runs tasks and check-in at 10× speed | 4.2s |
| ✅ | Sharing | valid | Sharing a Spotify playlist sets it as the alarm (no sign-in), named from Spotify | 1.3s |
| ✅ | Sharing | valid | YouTube: a playlist becomes the alarm; a Short becomes a clip; a single video asks which | 2.1s |
| ✅ | Sharing | invalid | Odd shares are handled kindly: other sites refused, repeats ignored, short Spotify links explained | 2.1s |
| ✅ | Sharing | valid | In the app: a link shared while First Light was closed is picked up when it opens | 1.3s |
| ✅ | Spotify | valid | Shared playlist plays in Spotify’s official player on the alarm screen; “Play on Spotify” opens the app | 2.5s |
| ✅ | Spotify | invalid | Shared playlist that never starts falls back to your songs within 8 seconds | 1.5s |
| ✅ | Spotify | invalid | Spotify links are checked: only open.spotify.com playlists, albums and songs | 0.8s |
| ✅ | Boost | valid | A saved YouTube Short or Instagram reel plays in its own embedded player after the check-in | 4.0s |
| ✅ | Layout | invalid | No screen scrolls sideways on a small 320 px phone (widest fonts, city themes) | 15.9s |
| ✅ | App | valid | Long explanations sit behind ⓘ buttons that open a short sheet | 1.3s |

Re-run with `python3 tests/run_tests.py` (needs `pip install playwright` and `playwright install chromium`).

## Also checked (3.1)

- **Android Java** compiles against the Android 16 (API 36) platform with the nap alarm, task notification, "Share → First Light" intent and link opening.
- **Sideways overflow audit:** every tab, every ☰ menu page, every setup step, the nap sheet and screen, ringing, tasks, the step-away pill and check-in, at 320 px and 360 px, in 8 font/style/theme combinations, browser and app. Nothing scrolls sideways. In the app, Android's text size is capped at 115%.
- **First-time-user walkthrough** (`tests/walkthrough.py`): 35 steps from setup to a proven morning, a shared Spotify playlist, a city theme and a nap, with no page errors.
- **Pip the tiger cub:** all ten poses cut out from your images (background removed, stray pixels cleaned, 512×512 WebP, 440 KB in total) and checked on dark and light themes. The Tiger logo replaces Owl and reuses the same home-screen icon entry, so installs that picked Owl keep an icon.
