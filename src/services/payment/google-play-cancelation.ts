import { SubscriptionStatus } from '../../types/subscription';

interface CancelationResult {
  success: boolean;
  error?: string;
}

export class GooglePlayCancelationHandler {
  private maxAttempts = 3;
  private timeoutDuration = 45000; // 45 seconds
  private visibilityHandler?: () => void;
  private activityCheckInterval?: number;
  private cancelationState = {
    inProgress: false,
    token: '',
    attempt: 0
  };

  async handleCancelation(token: string): Promise<CancelationResult> {
    console.log('[TWA-Cancelation] Starting cancelation flow...');
    
    try {
      const environment = await this.verifyEnvironment();
      console.log('[TWA-Cancelation] Environment verification:', environment);

      if (!environment.isValid) {
        throw new Error(environment.error || 'Payment environment is not ready');
      }
    } catch (error) {
      console.error('[TWA-Cancelation] Environment check failed:', error);
      throw new Error('Failed to verify payment environment. Please try again.');
    }

    return new Promise((resolve, reject) => {
      this.cancelationState = {
        inProgress: true,
        token,
        attempt: 0
      };

      // Store state for recovery
      try {
        sessionStorage.setItem('cancelationState', JSON.stringify(this.cancelationState));
      } catch (e) {
        console.warn('[TWA-Cancelation] Failed to store cancelation state:', e);
      }

      const attemptCancelation = async () => {
        if (!this.cancelationState.inProgress) return;
        this.cancelationState.attempt++;

        try {
          console.log(`[TWA-Cancelation] Creating payment request... (Attempt ${this.cancelationState.attempt}/${this.maxAttempts})`);
          
          const request = new PaymentRequest(
            [{
              supportedMethods: 'https://play.google.com/billing',
              data: {
                type: 'subscriptionPurchase',
                packageName: 'app.touchbase.site.twa',
                purchaseToken: token,
                method: 'https://play.google.com/billing',
                api: 'digitalGoods',
                action: 'manage'
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
          
          console.log('[TWA-Cancelation] Got response:', {
            hasResponse: Boolean(response),
            methodName: response?.methodName,
            hasDetails: Boolean(response?.details)
          });

          // Parse and validate response
          const status = await this.validateResponse(response);
          if (!status || !this.isSuccessStatus(status)) {
            throw new Error('Cancellation was not confirmed');
          }

          await response.complete('success');
          console.log('[TWA-Cancelation] Cancelation completed successfully');

          this.cleanup();
          this.cancelationState.inProgress = false;
          sessionStorage.removeItem('cancelationState');
          resolve({ success: true });

        } catch (error: any) {
          console.error('[TWA-Cancelation] Attempt failed:', error);
          this.logPaymentError(error);

          // Handle user abort
          if (error instanceof Error && error.name === 'AbortError') {
            this.cleanup();
            this.cancelationState.inProgress = false;
            sessionStorage.removeItem('cancelationState');
            resolve({ success: false, error: 'Cancelation was aborted by user.' });
            return;
          }

          // Retry logic
          if (this.cancelationState.attempt < this.maxAttempts && this.isRetryableError(error)) {
            console.log(`[TWA-Cancelation] Retrying... (${this.cancelationState.attempt}/${this.maxAttempts})`);
            setTimeout(attemptCancelation, 2000);
            return;
          }

          this.cleanup();
          this.cancelationState.inProgress = false;
          sessionStorage.removeItem('cancelationState');
          reject(this.enhanceError(error));
        }
      };

      // Enhanced activity state tracking
      let lastActivityState = document.visibilityState;
      this.activityCheckInterval = window.setInterval(() => {
        const currentState = document.visibilityState;
        
        if (currentState === 'visible' && lastActivityState === 'hidden') {
          console.log('[TWA-Cancelation] Activity restored, checking state...');
          
          // Check if we need to recover
          if (this.cancelationState.inProgress && this.cancelationState.attempt < this.maxAttempts) {
            console.log('[TWA-Cancelation] Recovering cancelation flow...');
            attemptCancelation();
          }
        }
        
        lastActivityState = currentState;
      }, 1000);

      // Start initial attempt
      attemptCancelation();

      // Set timeout
      setTimeout(() => {
        if (this.cancelationState.inProgress) {
          console.log('[TWA-Cancelation] Operation timed out');
          this.cleanup();
          this.cancelationState.inProgress = false;
          sessionStorage.removeItem('cancelationState');
          reject(new Error('Cancelation timed out. Please try again.'));
        }
      }, this.timeoutDuration);
    });
  }

  private async validateResponse(response: PaymentResponse): Promise<string | undefined> {
    if (!response || !response.details) {
      throw new Error('Invalid payment response');
    }

    const details = typeof response.details === 'string'
      ? JSON.parse(response.details)
      : response.details;

    console.log('[TWA-Cancelation] Response details:', JSON.stringify(details, null, 2));

    // Check various status paths
    const status = 
      details?.status ||
      details?.state ||
      details?.digitalGoods?.status ||
      details?.paymentMethodData?.digitalGoods?.status ||
      details?.response?.status;

    if (!status) {
      // Check for success indicators if no explicit status
      if (details?.success === true || details?.completed === true) {
        return 'completed';
      }
      throw new Error('Could not determine cancellation status');
    }

    return status;
  }

  private isSuccessStatus(status: string): boolean {
    // Match our database subscription status enum plus some common Google Play statuses
    const validStatuses: (SubscriptionStatus | string)[] = [
      'canceled',
      'completed', // Common Google Play status
      'success',   // Common Google Play status
      'subscription_canceled', // Alternative Google Play format
      'managed'    // Digital Goods API status
    ];
    return validStatuses.includes(status.toLowerCase());
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const retryableErrors = [
      'payment request failed',
      'network error',
      'timeout',
      'temporarily unavailable',
      'activity recreated',
      'no focused window'
    ];
    
    return retryableErrors.some(errText => message.includes(errText)) &&
           !message.includes('aborted') &&
           !message.includes('denied') &&
           error.name !== 'SecurityError';
  }

  private async verifyEnvironment() {
    try {
      const isTWA = window.matchMedia('(display-mode: standalone)').matches ||
                   document.referrer.includes('android-app://');
      
      const canUsePaymentRequest = typeof PaymentRequest !== 'undefined';
      const hasDigitalGoods = 'PaymentRequest' in window &&
        PaymentRequest.prototype.hasOwnProperty('canMakePayment');

      const details = {
        hasPaymentRequest: canUsePaymentRequest,
        hasDigitalGoods,
        isTWA,
        userAgent: navigator.userAgent,
        packageName: 'app.touchbase.site.twa'
      };

      console.log('[TWA-Cancelation] Environment details:', details);

      const isValid = canUsePaymentRequest && isTWA && hasDigitalGoods;
      let error;

      if (!isValid) {
        if (!canUsePaymentRequest || !hasDigitalGoods) {
          error = 'Google Play Billing is not available. Please ensure you are using the Play Store version.';
        } else if (!isTWA) {
          error = 'Must be launched from Play Store version to manage subscription.';
        }
      }

      return { isValid, details, error };
    } catch (e) {
      console.error('[TWA-Cancelation] Environment verification failed:', e);
      return {
        isValid: false,
        error: e instanceof Error
          ? `Environment check failed: ${e.message}`
          : 'Failed to verify app environment'
      };
    }
  }

  private enhanceError(error: any): Error {
    if (!(error instanceof Error)) {
      return new Error('Unknown error occurred during cancelation');
    }

    let message = `Cancelation failed: ${error.message}`;
    
    if (error.name === 'NotSupportedError') {
      message += ' Please ensure you are using the latest Play Store version.';
    } else if (error.name === 'SecurityError') {
      message += ' This operation requires the Play Store version.';
    } else if (error.message.toLowerCase().includes('no focused window')) {
      message += ' Please try again without switching apps.';
    } else {
      message += ' Please try again or contact support if the issue persists.';
    }
    
    const enhancedError = new Error(message);
    enhancedError.name = error.name;
    return enhancedError;
  }

  private logPaymentError(error: any) {
    console.error('[TWA-Cancelation] Detailed error log:', {
      errorType: error instanceof Error ? 'Error' : typeof error,
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      time: new Date().toISOString(),
      cancelationState: this.cancelationState
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