package app.touchbase.site.twa;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MessagingService extends FirebaseMessagingService {
    private static final String TAG = "MessagingService";
    private static final String PREF_NAME = "FCMPrefs";
    private static final String KEY_TOKEN = "fcm_token";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token generated");
        
        // Store token in SharedPreferences
        saveToken(token);
        
        // TODO: Send token to your web app via postMessage when TWA is active
        // This requires implementing a JavaScript interface or using postMessage
        // from the TWA's WebView instance
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        // Handle incoming messages here if needed
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());
    }

    private void saveToken(String token) {
        SharedPreferences prefs = getApplicationContext()
            .getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_TOKEN, token).apply();
    }

    public static String getStoredToken(Context context) {
        SharedPreferences prefs = context
            .getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_TOKEN, null);
    }
}