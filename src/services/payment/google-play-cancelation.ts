interface CancelationResult {
  success: boolean;
  error?: string;
  validUntil?: string;
  details?: {
    timestamp: string;
    state: string;
  };
}

export class GooglePlayCancelationHandler {
  private maxAttempts = 3;
  private timeoutDuration = 45000; // 45 seconds
  private visibilityHandler?: () => void;
  private activityCheckInterval?: number;
  private responseValidationPaths = [
    'details.paymentMethodData.data.status',
    'details.data.status',
    'details.status',
    'details.androidPayProvidedData.status',
    'details.digitalGoods.status',
    'details.googlePlayResponse.status',
    'paymentMethodData.data.status',
    'paymentMethodData.digitalGoods.status',
    'details.paymentMethodData.digitalGoods.status',
    'details.response.status',
    'details.billing.status'
  ];

  async handleCancelation(token: string): Promise<CancelationResult> {
    console.log('[TWA-Cancelation] Starting cancelation flow...');
    
    // Verify payment environment and initialization
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
      let attemptCount = 0;
      let hasResult = false;
      let showPromise: Promise<PaymentResponse> | null = null;
      
      const attemptCancelation = async () => {
        if (hasResult) return;
        attemptCount++;

        try {
          // Create PaymentRequest for cancelation
          console.log(`[TWA-Cancelation] Creating payment request... (Attempt ${attemptCount}/${this.maxAttempts})`);
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

          // Start the cancelation flow with activity lifecycle handling
          console.log('[TWA-Cancelation] Starting payment UI...');
          
          // Create a promise that handles activity recreation
          const showPromiseWithRetry = new Promise<PaymentResponse>(async (resolveShow, rejectShow) => {
            try {
              showPromise = request.show();
              const response = await showPromise;
              
              console.log('[TWA-Cancelation] Initial payment flow response:', {
                time: new Date().toISOString(),
                hasResponse: Boolean(response),
                responseType: response ? typeof response : 'undefined',
                hasDetails: Boolean(response?.details),
                methodName: response?.methodName
              });
              
              // Validate response before resolving
              if (!response || !response.details) {
                console.log('[TWA-Cancelation] Response validation failed, waiting for activity recreation...');
                return;
              }
              
              resolveShow(response);
            } catch (e) {
              console.log('[TWA-Cancelation] Show promise error:', e);
              if (e instanceof Error && e.name !== 'AbortError') {
                rejectShow(e);
              }
            }
          });

          const response = await showPromiseWithRetry;
          
          // Validate response status
          const status = this.validateResponse(response);
          console.log('[TWA-Cancelation] Validated response status:', status);
          
          // Complete the cancelation UI
          await response.complete('success');
          console.log('[TWA-Cancelation] Cancelation UI completed successfully');

          hasResult = true;
          resolve({
            success: true,
            details: {
              timestamp: new Date().toISOString(),
              state: status || 'completed'
            }
          });

        } catch (error: any) {
          console.error('[TWA-Cancelation] Attempt failed:', error);
          this.logPaymentError(error);

          // Special handling for user abort
          if (error instanceof Error && error.name === 'AbortError') {
            hasResult = true;
            resolve({ 
              success: false, 
              error: 'Cancelation was aborted by user.',
              details: {
                timestamp: new Date().toISOString(),
                state: 'aborted'
              }
            });
            return;
          }

          // If we haven't hit max attempts and error is retryable, try again
          if (attemptCount < this.maxAttempts && this.isRetryableError(error)) {
            console.log(`[TWA-Cancelation] Retrying... (${attemptCount}/${this.maxAttempts})`);
            setTimeout(attemptCancelation, 2000); // Wait 2 seconds between attempts
            return;
          }

          hasResult = true;
          reject(this.enhanceError(error));
        }
      };

      // Track activity state with interval checks
      let lastActivityState = document.visibilityState;
      this.activityCheckInterval = window.setInterval(() => {
        if (hasResult) {
          this.cleanup();
          return;
        }

        const currentState = document.visibilityState;
        console.log('[TWA-Cancelation] Activity check:', {
          lastState: lastActivityState,
          currentState,
          hasResult,
          attemptCount,
          hasShowPromise: Boolean(showPromise)
        });

        // Handle activity recreation
        if (lastActivityState === 'hidden' && currentState === 'visible' && !hasResult) {
          console.log('[TWA-Cancelation] Activity recreated, restarting flow...');
          showPromise = null;
          if (attemptCount < this.maxAttempts) {
            attemptCancelation();
          }
        }

        lastActivityState = currentState;
      }, 1000);

      // Track visibility changes
      this.visibilityHandler = () => {
        console.log('[TWA-Cancelation] Visibility changed:', {
          state: document.visibilityState,
          hasResult,
          attemptCount
        });
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

  private async verifyEnvironment() {
    try {
      const canUsePaymentRequest = typeof PaymentRequest !== 'undefined';
      const details = {
        hasPaymentRequest: canUsePaymentRequest,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        packageName: 'app.touchbase.site.twa'
      };

      return {
        isValid: canUsePaymentRequest,
        details,
        error: canUsePaymentRequest ? undefined : 'PaymentRequest API not available'
      };
    } catch (e) {
      return {
        isValid: false,
        error: e instanceof Error ? e.message : 'Unknown environment error'
      };
    }
  }

  private validateResponse(response: PaymentResponse): string | undefined {
    console.log('[TWA-Cancelation] Validating response...');
    
    // First try direct path access
    for (const path of this.responseValidationPaths) {
      try {
        const value = path.split('.').reduce((obj, key) => obj?.[key], response as any);
        console.log(`[TWA-Cancelation] Checking ${path}:`, value);
        if (value && typeof value === 'string') {
          return value;
        }
      } catch (e) {
        console.log(`[TWA-Cancelation] Error checking path ${path}:`, e);
      }
    }

    // Try parsing nested JSON
    if (response.details) {
      try {
        const parsedDetails = typeof response.details === 'string'
          ? JSON.parse(response.details)
          : response.details;

        console.log('[TWA-Cancelation] Parsed response details:', parsedDetails);
        return parsedDetails?.status || parsedDetails?.state || 'completed';
      } catch (e) {
        console.log('[TWA-Cancelation] Error parsing response details:', e);
      }
    }

    return undefined;
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return !message.includes('aborted') && 
           !message.includes('cancelled') &&
           !message.includes('denied') &&
           error.name !== 'SecurityError';
  }

  private enhanceError(error: any): Error {
    if (!(error instanceof Error)) {
      return new Error('Unknown error occurred during cancelation');
    }

    // Add more context to the error
    const enhancedMessage = `Cancelation failed: ${error.message}. ` +
      'Please ensure you are using the Play Store version and try again.';
    
    const enhancedError = new Error(enhancedMessage);
    enhancedError.name = error.name;
    return enhancedError;
  }

  private logPaymentError(error: any) {
    console.error('[TWA-Cancelation] Detailed error log:', {
      errorType: error instanceof Error ? 'Error' : typeof error,
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      time: new Date().toISOString()
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