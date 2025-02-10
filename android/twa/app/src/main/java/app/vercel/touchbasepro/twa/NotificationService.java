package app.vercel.touchbasepro.twa;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.google.androidbrowserhelper.trusted.DelegationService;
import android.util.Log;
import android.app.Activity;
import android.os.RemoteException;
import androidx.browser.customtabs.CustomTabsSessionToken;
import android.os.Bundle;
import org.json.JSONObject;
import org.json.JSONException;

public class NotificationService extends FirebaseMessagingService {
    private static final String TAG = "NotificationService";
    private static final int NOTIFICATION_ID = 1;

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "New FCM token: " + token);
        try {
            // Create JSON message to send to the web app
            JSONObject data = new JSONObject();
            data.put("type", "fcm_token");
            data.put("token", token);

            // Store token for sending when client connects
            app.vercel.touchbasepro.twa.DelegationService.queueMessage(data.toString());
            
        } catch (JSONException e) {
            Log.e(TAG, "Error creating JSON message", e);
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Get message data
        String title = remoteMessage.getNotification() != null ? 
            remoteMessage.getNotification().getTitle() : "TouchBase";
        String body = remoteMessage.getNotification() != null ? 
            remoteMessage.getNotification().getBody() : "";

        // Create notification
        createNotification(title, body);
    }

    private void createNotification(String title, String body) {
        // Create an explicit intent for the launcher activity
        Intent intent = getPackageManager()
            .getLaunchIntentForPackage(getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);

        // Build notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Application.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_icon)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH);

        // Show notification
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
            == PackageManager.PERMISSION_GRANTED) {
            notificationManager.notify(NOTIFICATION_ID, builder.build());
        }
    }

    // Helper method to request notification permission
    public static void requestNotificationPermission(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(activity,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        }
    }
}