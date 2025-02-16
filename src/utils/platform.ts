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
    const isInstagram = /Instagram/.test(navigator.userAgent);
    if (!isInstagram) {
      return {
        isInstagram: false,
        isIOS: false,
        isAndroid: false
      };
    }
    
    return {
      isInstagram: true,
      isIOS: this.isIOS(),
      isAndroid: this.isAndroid()
    };
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};