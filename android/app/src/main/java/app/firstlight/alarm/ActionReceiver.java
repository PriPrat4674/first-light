package app.firstlight.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONException;
import org.json.JSONObject;

/** Handles the buttons on bedtime notifications. Records what you chose for sleep tracking. */
public class ActionReceiver extends BroadcastReceiver {
    static final String SLEEP_NOW = "app.firstlight.SLEEP_NOW";
    static final String SLEEP_LATER = "app.firstlight.SLEEP_LATER";
    static final String NOT_TONIGHT = "app.firstlight.NOT_TONIGHT";
    static final String STILL_AWAKE = "app.firstlight.STILL_AWAKE";
    private static final long HALF_HOUR = 30 * 60 * 1000;

    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        long now = System.currentTimeMillis();
        switch (a) {
            case SLEEP_NOW:
                Notifier.cancel(c, Notifier.BEDTIME_ID);
                record(c, "sleep", now);
                once(c, "asleep", "asleep", now + HALF_HOUR);
                break;
            case SLEEP_LATER:
                Notifier.cancel(c, Notifier.BEDTIME_ID);
                record(c, "later", now);
                once(c, "later", "later", now + HALF_HOUR);
                break;
            case NOT_TONIGHT:
                Notifier.cancel(c, Notifier.BEDTIME_ID);
                record(c, "skip", now);
                break;
            case STILL_AWAKE:
                Notifier.cancel(c, Notifier.ASLEEP_ID);
                record(c, "awake", now);
                // Check once more, gently, in another half hour.
                once(c, "asleep", "asleep", now + HALF_HOUR);
                break;
            default:
                break;
        }
    }

    private static void record(Context c, String type, long at) {
        Prefs.addSleepEvent(c, type, at);
        FirstLightPlugin.emit("sleepEvent", "type", type);
    }

    private static void once(Context c, String id, String kind, long at) {
        try {
            AlarmScheduler.schedule(c, new JSONObject().put("id", id).put("kind", kind).put("at", at));
        } catch (JSONException ignored) {}
    }
}
