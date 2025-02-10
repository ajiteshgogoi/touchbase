package app.vercel.touchbasepro.twa;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;
import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    
    private static final String CHANNEL_ID = "touchbase_channel";
    private static final String CHANNEL_NAME = "TouchBase Notifications";
    private static final String CHANNEL_DESC = "Notifications from TouchBase";

    @Override
    public void onCreate() {
        super.onCreate();

        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(CHANNEL_DESC);
            
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
