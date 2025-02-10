package app.vercel.touchbasepro.twa;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;
import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;
import com.google.androidbrowserhelper.trusted.DelegationService;

public class DelegationService extends DelegationService {
    private static final String CHANNEL_ID = "touchbase_channel";
    private static final String CHANNEL_NAME = "TouchBase Notifications";

    @Override
    public void onCreate() {
        super.onCreate();

        // Create the notification channel
        createNotificationChannel();

        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("TouchBase notifications");

            NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public String getNotificationChannel() {
        return CHANNEL_ID;
    }
}

