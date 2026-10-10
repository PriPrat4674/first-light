package app.firstlight.alarm;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.view.accessibility.AccessibilityEvent;

/**
 * Watches which app comes to the front (nothing else: it doesn't read screen content).
 * If it's one you chose to lock and your morning isn't proven yet, it sends you home
 * and opens First Light with a reminder.
 */
public class LockService extends AccessibilityService {
    private String lastBlocked = null;
    private long lastBlockedAt = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        CharSequence pkgCs = event.getPackageName();
        if (pkgCs == null) return;
        String pkg = pkgCs.toString();
        if (!AppLock.isLocked(this, pkg)) return;
        long now = System.currentTimeMillis();
        if (pkg.equals(lastBlocked) && now - lastBlockedAt < 1500) return; // avoid loops
        lastBlocked = pkg;
        lastBlockedAt = now;
        performGlobalAction(GLOBAL_ACTION_HOME);
        String label = label(pkg);
        Intent open = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_LOCKED, pkg)
            .putExtra(MainActivity.EXTRA_LOCKED_LABEL, label);
        try { startActivity(open); } catch (Exception ignored) {}
        FirstLightPlugin.emit("locked", "pkg", pkg, "label", label);
    }

    private String label(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    @Override
    public void onInterrupt() {}
}
