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

  isTWA(): boolean {
    // Check for Android TWA by looking for the TWA specific payment API
    return this.isAndroid() &&
           typeof PaymentRequest !== 'undefined' &&
           ('google' in window) &&
           document.referrer.startsWith('android-app://');
  },

  isPWA(): boolean {
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    
    // iOS Safari specific check
    const nav = window.navigator as any;
    return nav.standalone === true;
  },

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isWeb(): boolean {
    // Consider it web if:
    // 1. Not running as PWA
    // 2. Not running as TWA
    return !this.isPWA() && !this.isTWA();
  },

  async isGooglePlayBillingAvailable(): Promise<boolean> {
    try {
      // Check if we're in TWA first
      if (!this.isTWA()) {
        console.log('Not in TWA, Google Play Billing not available');
        return false;
      }

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

  // Get device type that matches schema (web|android|ios)
  getDeviceType(): 'web' | 'android' | 'ios' {
    if (this.isIOS()) return 'ios';
    // Both TWA and Android PWA should be marked as 'android'
    if (this.isTWA() || (this.isPWA() && this.isAndroid())) return 'android';
    return 'web';
  }
};