package app.firstlight.alarm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import java.util.Arrays;
import java.util.List;

/** Built-in sounds (res/raw) and the notification channels that use them. */
final class Sounds {
    /** Alarm sounds played by AlarmService when no song of your own is set. */
    static final List<String> ALARM = Arrays.asList("dawn", "classic", "bells");
    /** Short sounds for check-ins and messages. */
    static final List<String> SHORT = Arrays.asList("chime", "bell", "marimba", "pluck", "harp");

    static final String CH_RING = "ring";          // the ringing alarm (sound comes from AlarmService)
    static final String CH_QUIET = "quiet";        // silent notifications

    private Sounds() {}

    static int rawId(Context c, String name) {
        int id = c.getResources().getIdentifier(name, "raw", c.getPackageName());
        return id != 0 ? id : c.getResources().getIdentifier("alarm_dawn", "raw", c.getPackageName());
    }

    static int alarmRaw(Context c, String name) {
        return rawId(c, "alarm_" + (ALARM.contains(name) ? name : "dawn"));
    }

    static Uri uri(Context c, String rawName) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + c.getPackageName() + "/raw/" + rawName);
    }

    /**
     * Returns a channel id for a purpose + sound. Android fixes a channel's sound once it's created,
     * so each sound gets its own channel (e.g. "checkin_bell").
     */
    static String channel(Context c, String purpose, String sound) {
        if (Build.VERSION.SDK_INT < 26) return purpose;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return purpose;
        ensureBase(c, nm);
        if ("silent".equals(sound)) return CH_QUIET;
        String name = "warm".equals(sound) ? "warm" : (SHORT.contains(sound) ? sound : "chime");
        String id = purpose + "_" + name;
        if (nm.getNotificationChannel(id) == null) {
            boolean soft = "warm".equals(name);
            NotificationChannel ch = new NotificationChannel(id, label(purpose) + " · " + name,
                soft ? NotificationManager.IMPORTANCE_DEFAULT : NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(uri(c, "note_" + name), new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(!soft);
            nm.createNotificationChannel(ch);
        }
        return id;
    }

    static void ensureBase(Context c, NotificationManager nm) {
        if (Build.VERSION.SDK_INT < 26) return;
        if (nm.getNotificationChannel(CH_RING) == null) {
            NotificationChannel ring = new NotificationChannel(CH_RING, "Alarm ringing", NotificationManager.IMPORTANCE_HIGH);
            ring.setSound(null, null); // AlarmService plays the sound itself, on the alarm volume
            ring.enableVibration(false);
            ring.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            ring.setBypassDnd(true);
            nm.createNotificationChannel(ring);
        }
        if (nm.getNotificationChannel(CH_QUIET) == null) {
            NotificationChannel quiet = new NotificationChannel(CH_QUIET, "Quiet check-ins", NotificationManager.IMPORTANCE_LOW);
            quiet.setSound(null, null);
            quiet.enableVibration(false);
            nm.createNotificationChannel(quiet);
        }
    }

    private static String label(String purpose) {
        switch (purpose) {
            case "bedtime": return "Bedtime";
            case "asleep": return "Asleep check";
            case "checkin": return "Check-in";
            default: return "Messages";
        }
    }
}
