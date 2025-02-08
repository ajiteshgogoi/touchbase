package app.vercel.touchbasepro.twa;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsCallback;
import com.google.androidbrowserhelper.trusted.ExtraCommandHandler;

public class GooglePlayBilling implements ExtraCommandHandler {
    private static final String TAG = "GooglePlayBilling";
    private final Activity activity;

    public GooglePlayBilling(Activity activity) {
        this.activity = activity;
    }

    @Override
    public void handleExtraCommand(String commandName, Bundle args, Result result) {
        if (!commandName.equals("digitalGoods")) {
            result.error(new RuntimeException("Unsupported command: " + commandName));
            return;
        }

        try {
            DigitalGoodsCallback callback = new DigitalGoodsCallback(activity, args);
            callback.run();
            result.success();
        } catch (Exception e) {
            Log.e(TAG, "Error handling digital goods command", e);
            result.error(e);
        }
    }

    public void onDestroy() {
        // No cleanup needed
    }
}