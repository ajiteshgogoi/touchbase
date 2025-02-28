export type DeviceType = 'web' | 'android' | 'ios' | 'twa' | 'pwa';

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

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches;
  },

  isTWA(): boolean {
    return this.isAndroid() && this.isPWA();
  },

  getDeviceType(): DeviceType {
    // Check if running as TWA (Android + Standalone mode)
    if (this.isTWA()) {
      return 'twa';
    }
    // Check if running as PWA
    if (this.isPWA()) {
      return 'pwa';
    }
    // Check mobile platforms
    if (this.isAndroid()) {
      return 'android';
    }
    if (this.isIOS()) {
      return 'ios';
    }
    // Default to web
    return 'web';
  },

  formatDeviceType(type: DeviceType): string {
    switch (type) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iOS';
      case 'twa':
        return 'Android App';
      case 'pwa':
        return 'Mobile App';
      case 'web':
        return 'Desktop';
      default:
        return type;
    }
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
  }
};