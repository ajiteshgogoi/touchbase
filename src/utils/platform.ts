// Platform detection utilities used for payment and app functionality
declare global {
  interface Window {
    chrome?: {
      app?: {
        window?: unknown;
      };
    };
    google?: {
      payments: {
        subscriptions: {
          subscribe(sku: string): Promise<{ purchaseToken: string }>;
          acknowledge(token: string): Promise<void>;
          cancel(token: string): Promise<void>;
        };
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
      // Check if we're on Android first
      if (!this.isAndroid()) {
        console.log('Not on Android, Google Play Billing not available');
        return false;
      }

      // Check if Google Payments API is available
      if (!window.google?.payments?.subscriptions) {
        console.log('Google Payments API not available');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking Google Play Billing availability:', error);
      // Log more details about the error if it's an Error object
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
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