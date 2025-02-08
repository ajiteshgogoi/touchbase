package app.vercel.touchbasepro.twa;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.androidbrowserhelper.billing.BillingWrapper;
import com.google.androidbrowserhelper.billing.DigitalGoodsCallback;
import com.google.androidbrowserhelper.trusted.TrustedWebActivityCallback;

public class GooglePlayBilling implements TrustedWebActivityCallback {
    private static final String TAG = "GooglePlayBilling";
    private final Activity activity;
    private BillingWrapper billingWrapper;

    public GooglePlayBilling(Activity activity) {
        this.activity = activity;
        this.billingWrapper = new BillingWrapper(activity);
    }

    @Override
    public void onDigitalGoodsResponse(@NonNull DigitalGoodsCallback callback) {
        billingWrapper.setCallback(callback);
    }

    public void onDestroy() {
        if (billingWrapper != null) {
            billingWrapper.close();
        }
    }
}