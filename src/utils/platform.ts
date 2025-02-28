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

      // In TWA, Google Play Billing is exposed through PaymentRequest API
      // Check if PaymentRequest API is available
      if (typeof PaymentRequest === 'undefined') {
        console.log('PaymentRequest API not available');
        return false;
      }

      // Check if Google Play billing method is supported
      const request = new PaymentRequest(
        [{
          supportedMethods: 'https://play.google.com/billing',
          data: { test: 'test' } // Minimal data to test support
        }],
        { total: { label: 'Test', amount: { currency: 'USD', value: '0' } } }
      );

      console.log('Checking Google Play Billing support...');
      const canMakePayment = await request.canMakePayment();
      console.log('Google Play Billing support result:', canMakePayment);

      return canMakePayment;
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
    return !this.isAndroid() && !this.isIOS();
  },

  isPWA(): boolean {
    // Check if app is running in standalone mode (PWA) or fullscreen
    if ('standalone' in navigator && (navigator as any).standalone === true) {
      return true; // iOS PWA
    }
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches;
  },

  isTWA(): boolean {
    // TWA is Android-only and uses Google Play billing
    return this.isAndroid() && typeof PaymentRequest !== 'undefined' &&
           navigator.userAgent.includes('wv'); // WebView
  }
};