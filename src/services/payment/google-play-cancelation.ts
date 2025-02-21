interface CancelationResult {
  success: boolean;
  error?: string;
}

export class GooglePlayCancelationHandler {
  async handleCancelation(token: string): Promise<CancelationResult> {
    console.log('[TWA-Cancelation] Starting cancelation flow...');

    try {
      const request = new PaymentRequest(
        [{
          supportedMethods: 'https://play.google.com/billing',
          data: {
            type: 'subscriptionPurchase',
            packageName: 'app.touchbase.site.twa',
            purchaseToken: token,
            method: 'https://play.google.com/billing'
          }
        }],
        {
          total: {
            label: 'Cancel Subscription',
            amount: { currency: 'USD', value: '0' }
          }
        }
      );

      console.log('[TWA-Cancelation] Checking canMakePayment...');
      const canMake = await request.canMakePayment();
      if (!canMake) {
        throw new Error('Google Play Billing is not available on this device.');
      }

      console.log('[TWA-Cancelation] Starting payment UI...');
      const response = await request.show();
      await response.complete('success');
      
      console.log('[TWA-Cancelation] Cancelation completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[TWA-Cancelation] Operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      };
    }
  }
}

export const googlePlayCancelationHandler = new GooglePlayCancelationHandler();