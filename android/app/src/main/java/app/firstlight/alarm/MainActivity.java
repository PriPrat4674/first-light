package app.firstlight.alarm;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    static final String EXTRA_LAUNCH = "fl_launch";
    static final String EXTRA_LOCKED = "fl_locked";
    static final String EXTRA_LOCKED_LABEL = "fl_locked_label";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FirstLightPlugin.class);
        super.onCreate(savedInstanceState);
        // Let the alarm screen start music (Spotify, YouTube, your songs) without a tap first.
        WebSettings ws = getBridge().getWebView().getSettings();
        ws.setMediaPlaybackRequiresUserGesture(false);
        remember(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        remember(intent);
        super.onNewIntent(intent);
    }

    /** Stores why the app was opened, and shows over the lock screen for alarms. */
    private void remember(Intent intent) {
        if (intent == null) return;
        String kind = intent.getStringExtra(EXTRA_LAUNCH);
        String locked = intent.getStringExtra(EXTRA_LOCKED);
        if (kind == null && locked == null) return;
        JSONObject launch = new JSONObject();
        try {
            launch.put("at", System.currentTimeMillis());
            if (kind != null) launch.put("kind", kind);
            if (locked != null) launch.put("lockedPkg", locked).put("lockedLabel", intent.getStringExtra(EXTRA_LOCKED_LABEL));
        } catch (JSONException ignored) {}
        Prefs.put(this, Prefs.LAUNCH, launch);
        intent.removeExtra(EXTRA_LAUNCH);
        intent.removeExtra(EXTRA_LOCKED);
        if (kind != null) showOverLockScreen();
    }

    private void showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Once nothing is ringing, behave like a normal app again (not over the lock screen).
        if (!AlarmService.isRinging()) {
            if (Build.VERSION.SDK_INT >= 27) setShowWhenLocked(false);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }
}
