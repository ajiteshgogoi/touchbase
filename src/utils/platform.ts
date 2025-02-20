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
      // Check if we're on Android first
      if (!this.isAndroid()) {
        console.log('Not on Android, Google Play Billing not available');
        return false;
      }

      // Check if Payment Request API is available
      if (!window.PaymentRequest) {
        console.log('PaymentRequest API not available');
        return false;
      }

      // Try to create a payment request with Google Play Billing
      const request = new PaymentRequest(
        [{
          supportedMethods: 'https://play.google.com/billing',
          data: { sku: 'dummy_test' }
        }],
        { total: { label: 'Test', amount: { currency: 'USD', value: '0' } } }
      );

      // Check if Google Play Billing is available
      const canMakePayment = await request.canMakePayment();
      console.log('Google Play Billing available:', canMakePayment);
      
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
    return !this.isAndroid();
  }
};