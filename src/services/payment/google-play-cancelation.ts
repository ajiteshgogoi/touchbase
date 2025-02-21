interface CancelationResult {
  success: boolean;
  error?: string;
}

export class GooglePlayCancelationHandler {
  private maxAttempts = 3;
  private timeoutDuration = 45000; // 45 seconds
  private visibilityHandler?: () => void;
  private activityCheckInterval?: number;

  async handleCancelation(token: string): Promise<CancelationResult> {
    console.log('[TWA-Cancelation] Starting cancelation flow...');
    
    // Verify payment environment
    try {
      const canUsePaymentRequest = typeof PaymentRequest !== 'undefined';
      console.log('[TWA-Cancelation] Payment environment:', {
        hasPaymentRequest: canUsePaymentRequest,
        packageName: 'app.touchbase.site.twa',
      });

      if (!canUsePaymentRequest) {
        throw new Error('PaymentRequest API not available. Please ensure you are using the Play Store version.');
      }
    } catch (error) {
      console.error('[TWA-Cancelation] Environment check failed:', error);
      throw new Error('Failed to verify payment environment. Please try again.');
    }

    return new Promise((resolve, reject) => {
      let attemptCount = 0;
      let hasResult = false;
      
      const attemptCancelation = async () => {
        if (hasResult) return;
        attemptCount++;

        try {
          // Create PaymentRequest for cancelation
          console.log('[TWA-Cancelation] Creating payment request... (Attempt ${attemptCount}/${this.maxAttempts})');
          const request = new PaymentRequest(
            [{
              supportedMethods: 'https://play.google.com/billing',
              data: {
                type: 'subscriptionManage',
                packageName: 'app.touchbase.site.twa',
                purchaseToken: token,
                action: 'cancel'
              }
            }],
            {
              total: {
                label: 'Cancel Subscription',
                amount: { currency: 'USD', value: '0' }
              }
            }
          );

          // Check if payment can be made
          console.log('[TWA-Cancelation] Checking canMakePayment...');
          const canMake = await request.canMakePayment();
          if (!canMake) {
            throw new Error('Google Play Billing is not available on this device.');
          }

          // Start the cancelation flow
          console.log('[TWA-Cancelation] Starting payment UI...');
          const paymentResponse = await request.show();
          
          // Complete the cancelation UI
          await paymentResponse.complete('success');
          console.log('[TWA-Cancelation] Cancelation UI completed successfully');

          hasResult = true;
          resolve({ success: true });

        } catch (error: any) {
          console.error('[TWA-Cancelation] Attempt failed:', error);

          // Special handling for user abort
          if (error instanceof Error && error.name === 'AbortError') {
            hasResult = true;
            resolve({ success: false, error: 'Cancelation was aborted by user.' });
            return;
          }

          // If we haven't hit max attempts, wait and try again
          if (attemptCount < this.maxAttempts) {
            console.log(`[TWA-Cancelation] Retrying... (${attemptCount}/${this.maxAttempts})`);
            setTimeout(attemptCancelation, 2000); // Wait 2 seconds between attempts
            return;
          }

          hasResult = true;
          reject(error);
        }
      };

      // Track activity state for potential recreation
      let lastActivityState = document.visibilityState;
      this.visibilityHandler = () => {
        console.log('[TWA-Cancelation] Visibility changed:', {
          from: lastActivityState,
          to: document.visibilityState,
          hasResult,
          attemptCount
        });

        // If we were paused and now visible again, and haven't succeeded yet
        if (lastActivityState === 'hidden' && 
            document.visibilityState === 'visible' && 
            !hasResult && 
            attemptCount < this.maxAttempts) {
          attemptCancelation();
        }

        lastActivityState = document.visibilityState;
      };

      document.addEventListener('visibilitychange', this.visibilityHandler);

      // Start initial attempt
      attemptCancelation();

      // Set timeout
      setTimeout(() => {
        if (!hasResult) {
          console.log('[TWA-Cancelation] Operation timed out');
          hasResult = true;
          this.cleanup();
          reject(new Error('Cancelation timed out. Please try again.'));
        }
      }, this.timeoutDuration);
    });
  }

  private cleanup() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = undefined;
    }
  }
}

export const googlePlayCancelationHandler = new GooglePlayCancelationHandler();