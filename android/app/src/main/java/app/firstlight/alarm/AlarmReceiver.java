package app.firstlight.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Fires when a scheduled alarm or prompt is due, even if the app is closed. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        String kind = intent.getStringExtra(AlarmScheduler.EXTRA_KIND);
        if (id == null || kind == null) return;
        AlarmScheduler.bookNext(c, id);

        if (AlarmScheduler.isRinging(kind)) {
            if ("wake".equals(kind)) AppLock.startMorningLock(c);
            Intent svc = new Intent(c, AlarmService.class).putExtra(AlarmScheduler.EXTRA_KIND, kind);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(svc); else c.startService(svc);
            FirstLightPlugin.emit("alarm", "kind", kind);
            return;
        }
        switch (kind) {
            case "bedtime":
                Notifier.bedtime(c, false);
                break;
            case "later":
                Notifier.bedtime(c, true);
                break;
            case "asleep":
                Notifier.asleepCheck(c);
                break;
            case "task":
                Notifier.task(c, intent.getStringExtra(AlarmScheduler.EXTRA_TITLE), intent.getStringExtra(AlarmScheduler.EXTRA_TEXT));
                break;
            default:
                break;
        }
    }
}
