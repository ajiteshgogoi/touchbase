package app.vercel.touchbasepro.twa;

import android.os.Bundle;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request notification permission on app launch
        NotificationService.requestNotificationPermission(this);
    }
}
