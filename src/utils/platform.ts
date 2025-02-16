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
    const userAgent = navigator.userAgent;
    const isIOS = this.isIOS();
    const isAndroid = this.isAndroid();

    // Enhanced Instagram detection
    const isInstagram =
      // Standard Instagram UA check (works well for Android)
      /Instagram/.test(userAgent) ||
      // iOS-specific checks for Instagram in-app browser
      (isIOS && (
        // Check for Instagram's WKWebView indicators
        /FBAN/.test(userAgent) ||
        /FBAV/.test(userAgent) ||
        // Check for iOS WebKit with mobile indicators
        (/AppleWebKit/.test(userAgent) &&
         /Mobile/.test(userAgent) &&
         // Instagram browser doesn't identify as Safari
         !/Safari/.test(userAgent))
      ));

    if (!isInstagram) {
      return {
        isInstagram: false,
        isIOS: false,
        isAndroid: false
      };
    }
    
    return {
      isInstagram: true,
      isIOS,
      isAndroid
    };
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};