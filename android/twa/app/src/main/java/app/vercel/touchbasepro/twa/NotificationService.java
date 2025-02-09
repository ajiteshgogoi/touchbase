package app.vercel.touchbasepro.twa;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import androidx.core.app.NotificationManagerCompat;

public class NotificationService extends NotificationListenerService {
    private static final String CHANNEL_ID = "touchbase_notification_channel";
    
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "TouchBase Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Notifications from TouchBase");

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public static boolean areNotificationsEnabled(Context context) {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        return notificationManager.areNotificationsEnabled();
    }
}