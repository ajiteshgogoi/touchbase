// Platform detection utilities
declare global {
  interface Window {
    chrome?: {
      app?: {
        window?: unknown;
      };
    };
  }
}

interface InstagramBrowserStatus {
  isInstagram: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export const platform = {
  isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  },

  isGooglePlayBillingAvailable(): boolean {
    return !!window.google?.payments?.subscriptions?.subscribe;
  },

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isInstagramBrowser(): InstagramBrowserStatus {
    // First check for early detection results from inline script
    // This is more reliable especially on iOS Instagram browser
    const html = document.documentElement;
    const earlyDetectionResult = html.getAttribute('data-ig-browser');
    
    if (earlyDetectionResult === 'true') {
      const platform = html.getAttribute('data-ig-platform');
      // Early detection succeeded - use the pre-computed result
      return {
        isInstagram: true,
        isIOS: platform === 'ios',
        isAndroid: platform === 'android'
      };
    }

    // Fallback to runtime detection if early detection didn't catch it
    // This can happen if the inline script failed or didn't run
    const userAgent = navigator.userAgent;
    const isIOS = this.isIOS();
    const isAndroid = this.isAndroid();

    // Debug info - Basic environment
    console.warn('📱 Browser Environment:', {
      userAgent,
      isIOS,
      isAndroid,
      windowInnerHeight: window.innerHeight,
      screenHeight: window?.screen?.height,
      documentHidden: document.hidden,
      hasReactNativeWebView: 'ReactNativeWebView' in window,
      pathname: window.location.pathname,
    });

    // Debug each detection pattern
    const detectionResults = {
      hasInstagram: /Instagram/.test(userAgent),
      hasFBAN: /FBAN/.test(userAgent),
      hasFBAV: /FBAV/.test(userAgent),
      hasFBIOS: /FBIOS/.test(userAgent),
      hasWebKit: /AppleWebKit/.test(userAgent),
      hasSafari: /Safari/.test(userAgent),
      hasCriOS: /CriOS/.test(userAgent),
    };

    console.warn('🔍 Detection Results:', detectionResults);

    // Instagram detection combining both direct Instagram and iOS Facebook container checks
    const isInstagram =
      detectionResults.hasInstagram ||
      (isIOS && (
        detectionResults.hasFBAN ||     // Facebook App
        detectionResults.hasFBAV ||     // Facebook App
        detectionResults.hasFBIOS       // iOS-specific FB container
      ));

    const result = {
      isInstagram,
      isIOS,
      isAndroid
    };

    console.warn('📱 Final Result:', result);
    console.warn('🌐 Document State:', {
      readyState: document.readyState,
      bodyHeight: document.body?.clientHeight,
      htmlHeight: document.documentElement?.clientHeight,
      hasStyles: !!document.styleSheets.length,
    });

    return result;
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};