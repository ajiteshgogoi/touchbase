package app.touchbase.twa;

import android.content.SharedPreferences;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class Application extends android.app.Application {
    private static final String PREFS_NAME = "TouchBasePrefs";
    private static final String NOTIFICATION_PERMISSION_GRANTED = "notification_permission_granted";

    @Override
    public void onCreate() {
        super.onCreate();
        
        // Check if we've already granted notification permission
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean permissionGranted = prefs.getBoolean(NOTIFICATION_PERMISSION_GRANTED, false);
        
        if (permissionGranted) {
            // Pre-grant notification permission to avoid repeated prompts
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                try {
                    grantNotificationPermission();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    private void grantNotificationPermission() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putBoolean(NOTIFICATION_PERMISSION_GRANTED, true).apply();
    }
}