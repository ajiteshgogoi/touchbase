// Platform detection utilities used for payment and app functionality
declare global {
  interface Window {
    chrome?: {
      app?: {
        window?: unknown;
      };
    };
  }
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

  isWeb(): boolean {
    return !this.isAndroid();
  }
};