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

    // Instagram detection
    const isInstagram =
      // Android detection
      /Instagram/.test(userAgent) ||
      // iOS-specific detection for Instagram in-app browser
      (isIOS && (
        // Specific Instagram/Facebook in-app browser indicators
        /Instagram/.test(userAgent) ||
        /FBAN/.test(userAgent) ||     // Facebook App
        /FBAV/.test(userAgent) ||     // Facebook App
        /FBIOS/.test(userAgent)       // iOS-specific FB container
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