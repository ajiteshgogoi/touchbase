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
      // Android detection (works well)
      /Instagram/.test(userAgent) ||
      // iOS-specific detection for Instagram in-app browser
      (isIOS && (
        // iOS Instagram app indicators
        /Instagram/.test(userAgent) ||
        /FBIOS/.test(userAgent) ||  // iOS-specific FB container
        // Generic iOS Instagram WebView detection
        (/AppleWebKit/.test(userAgent) &&
         /Mobile/.test(userAgent) &&
         // Must not be Safari or Chrome
         !/Safari|CriOS/.test(userAgent))
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