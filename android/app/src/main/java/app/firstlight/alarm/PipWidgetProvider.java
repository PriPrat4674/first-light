package app.firstlight.alarm;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;

/**
 * Home-screen widget: your streak (or your name before you have one) and the next alarm.
 */
public class PipWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager man = AppWidgetManager.getInstance(context);
        if (man == null) return;
        int[] ids = man.getAppWidgetIds(new ComponentName(context, PipWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, man, id);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_pip);

        // Click launches First Light
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_layout, pendingIntent);

        // Read next alarm time
        JSONObject alarms = Prefs.obj(context, Prefs.ALARMS);
        long nextAt = 0;
        long now = System.currentTimeMillis();
        Iterator<String> keys = alarms.keys();
        while (keys.hasNext()) {
            JSONObject a = alarms.optJSONObject(keys.next());
            if (a != null && "wake".equals(a.optString("kind"))) {
                long at = a.optLong("at");
                if (at > now && (nextAt == 0 || at < nextAt)) {
                    nextAt = at;
                }
            }
        }

        String alarmText = "No alarm set";
        if (nextAt > 0) {
            SimpleDateFormat sdf = new SimpleDateFormat("h:mm a", Locale.getDefault());
            alarmText = "Alarm · " + sdf.format(new Date(nextAt));
        }

        int streak = Prefs.sp(context).getInt("widget_streak", 0);
        String name = Prefs.sp(context).getString("user_name", "");
        String top = streak > 0 ? streak + "-day streak" : (name == null || name.isEmpty() ? "First Light" : name);
        views.setTextViewText(R.id.widget_streak, top);
        views.setTextViewText(R.id.widget_alarm, alarmText);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
