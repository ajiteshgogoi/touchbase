/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package app.touchbase.site.twa;

import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.Manifest;
import android.content.SharedPreferences;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private boolean permissionHandled = false;
    private boolean splashShown = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting orientation for Android O and above
        // This only affects the splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            getWindow().getAttributes().screenOrientation = ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT;
        }

        // Show splash screen first
        launchTwa();

        // Delay for splash screen visibility
        android.os.Handler handler = new android.os.Handler(getMainLooper());
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                splashShown = true;
                // Check and request permissions if needed
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(LauncherActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED) {
                        Application.requestNotificationPermission(LauncherActivity.this);
                        return;
                    }
                }
                permissionHandled = true;
                launchTwa();
            }
        }, 500); // 500ms delay for splash screen
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();
        return uri;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == Application.NOTIFICATION_PERMISSION_CODE) {
            permissionHandled = true;
            launchTwa();
        }
    }

    @Override
    protected void launchTwa() {
        if (!splashShown) {
            // First call - just show splash screen
            super.launchTwa();
            return;
        }

        // Second call - only proceed if permission is handled
        if (!permissionHandled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return;
        }

        // Permission is handled or not needed, load URL
        super.launchTwa();
    }
}