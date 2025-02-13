package app.touchbase.site.twa;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;
import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    
    @Override
    public void onCreate() {
        super.onCreate();
        // Let the PWA's service worker handle notifications
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}