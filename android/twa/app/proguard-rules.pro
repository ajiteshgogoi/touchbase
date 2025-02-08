# Keep billing classes
-dontwarn com.android.billingclient.api.Purchase$PurchasesResult
-keep class com.android.billingclient.** { *; }
-keep class com.google.androidbrowserhelper.playbilling.** { *; }
-keep class com.google.androidbrowserhelper.trusted.** { *; }