package app.vercel.touchbasepro.twa;


import android.content.Context;
import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();

        // Keep only billing functionality
        Context context = getApplicationContext();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(context));
    }
}

