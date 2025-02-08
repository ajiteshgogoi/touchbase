package app.vercel.touchbasepro.twa;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;
import com.google.androidbrowserhelper.trusted.ExtraCommandHandler;
import com.google.androidbrowserhelper.trusted.ExtraCommandHandler.CommandHandler;

public class GooglePlayBilling implements ExtraCommandHandler {
    private static final String TAG = "GooglePlayBilling";
    private final Activity activity;
    private final DigitalGoodsRequestHandler digitalGoodsRequestHandler;

    public GooglePlayBilling(Activity activity) {
        this.activity = activity;
        this.digitalGoodsRequestHandler = new DigitalGoodsRequestHandler(activity);
    }

    @Override
    public boolean handleExtraCommand(String commandName, @NonNull Bundle args, @NonNull CommandHandler handler) {
        if (!commandName.equals("digitalGoods")) {
            return false;
        }

        try {
            return digitalGoodsRequestHandler.handle(commandName, args, handler);
        } catch (Exception e) {
            Log.e(TAG, "Error handling digital goods command", e);
            handler.error(e);
            return true;
        }
    }

    public void onDestroy() {
        // No cleanup needed
    }
}