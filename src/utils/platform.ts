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

  async isGooglePlayBillingAvailable(): Promise<boolean> {
    try {
      // Wait for Google Play Billing API to be available (max 10 seconds)
      for (let i = 0; i < 20; i++) {
        if (window.google?.payments?.subscriptions) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return false;
    } catch (error) {
      console.error('Error checking Google Play Billing availability:', error);
      return false;
    }
  },

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};