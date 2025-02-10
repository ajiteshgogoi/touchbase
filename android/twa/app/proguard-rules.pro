# Preserve Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep notification service
-keep class app.vercel.touchbasepro.twa.NotificationService { *; }
-keep class app.vercel.touchbasepro.twa.Application { *; }

# Keep billing classes (existing rule)
-keep class com.android.billingclient.** { *; }
-keep class com.android.vending.billing.** { *; }