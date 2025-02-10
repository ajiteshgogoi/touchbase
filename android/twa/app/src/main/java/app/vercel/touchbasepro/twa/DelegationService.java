package app.vercel.touchbasepro.twa;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import androidx.browser.customtabs.CustomTabsSessionToken;
import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;
import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;
import java.util.ArrayList;
import java.util.List;

public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    
    private static final String TAG = "DelegationService";
    private static List<String> messageQueue = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }

    public static void queueMessage(String message) {
        if (message != null) {
            messageQueue.add(message);
            Log.d(TAG, "Message queued: " + message);
        }
    }

    @Override
    public boolean onNotifyClientMessage(CustomTabsSessionToken session, String message, Bundle extras) {
        // Send all queued messages when client connects
        if (message.equals("check_messages") && !messageQueue.isEmpty()) {
            for (String queuedMessage : messageQueue) {
                Bundle data = new Bundle();
                data.putString("message", queuedMessage);
                notifyClientMessage(session, "message", data);
            }
            messageQueue.clear();
            return true;
        }
        return false;
    }
}
