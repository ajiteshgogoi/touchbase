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
import android.view.ViewGroup;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import com.google.android.gms.tasks.Task;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private WebView webView;
    private boolean permissionHandled = false;
    private boolean splashShown = false;
    private ReviewManager reviewManager;

    // JavaScript interface class for in-app review
    public class WebAppInterface {
        @JavascriptInterface
        public void requestInAppReview() {
            webView.post(() -> {
                webView.evaluateJavascript("console.log('[In-App Review] Starting review request');", null);
                if (reviewManager == null) {
                    reviewManager = ReviewManagerFactory.create(LauncherActivity.this);
                }

                Task<ReviewInfo> request = reviewManager.requestReviewFlow();
                request.addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        webView.evaluateJavascript("console.log('[In-App Review] Got review info successfully');", null);
                        ReviewInfo reviewInfo = task.getResult();
                        Task<Void> flow = reviewManager.launchReviewFlow(LauncherActivity.this, reviewInfo);
                        
                        flow.addOnCompleteListener(reviewTask -> {
                            String resultMsg = reviewTask.isSuccessful()
                                ? "'[In-App Review] Review flow completed successfully'"
                                : "'[In-App Review] Review flow failed to complete'";
                            webView.evaluateJavascript("console.log(" + resultMsg + ");", null);
                        });

                        flow.addOnFailureListener(exception -> {
                            String errorMsg = "'[In-App Review] Error launching review: " + exception.getMessage() + "'";
                            webView.evaluateJavascript("console.log(" + errorMsg + ");", null);
                        });
                    } else {
                        String errorMsg = "'[In-App Review] Error getting review info: " + task.getException().getMessage() + "'";
                        webView.evaluateJavascript("console.log(" + errorMsg + ");", null);
                    }
                });

                request.addOnFailureListener(exception -> {
                    String errorMsg = "'[In-App Review] Failed to request review: " + exception.getMessage() + "'";
                    webView.evaluateJavascript("console.log(" + errorMsg + ");", null);
                });
            });
        }
    }

    private void launchReview() {
        if (reviewManager == null) {
            reviewManager = ReviewManagerFactory.create(this);
        }

        Task<ReviewInfo> request = reviewManager.requestReviewFlow();
        request.addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                ReviewInfo reviewInfo = task.getResult();
                reviewManager.launchReviewFlow(this, reviewInfo).addOnCompleteListener(reviewTask -> {
                    // The flow has finished. The API does not indicate whether the user
                    // reviewed or not, or even whether the review dialog was shown.
                });
            }
        });
    }

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

        // Permission is handled or not needed

        if (webView == null) {
            // Initialize WebView only once
            webView = new WebView(this);
            WebSettings webSettings = webView.getSettings();
            webSettings.setJavaScriptEnabled(true);

            // Add JavaScript interface
            WebAppInterface webAppInterface = new WebAppInterface();
            webView.addJavascriptInterface(webAppInterface, "AndroidInterface");

            // Add WebView to activity (with zero size to keep it invisible)
            webView.setLayoutParams(new ViewGroup.LayoutParams(1, 1));
            addContentView(webView, webView.getLayoutParams());
        }

        // Load the TWA
        super.launchTwa();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}