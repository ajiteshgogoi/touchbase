import { supabase } from '../../lib/supabase/client';
import { platform } from '../../utils/platform';
import { SUBSCRIPTION_PLANS } from './plans';

export class GooglePlayService {
  async _initializeGooglePlayBilling(): Promise<void> {
    console.log('TWA Google Play Billing uses PaymentRequest API, no initialization needed');
    return Promise.resolve();
  }

  async createSubscription(planId: string): Promise<string> {
    console.log('Creating Google Play subscription for plan:', planId);
    try {
      // Check if Google Play Billing is available
      const isAvailable = await platform.isGooglePlayBillingAvailable();
      console.log('Google Play Billing available:', isAvailable);
      
      if (!isAvailable) {
        throw new Error('Google Play Billing is not available. If you installed from Play Store, please wait a few seconds and try again.');
      }

      // Find the plan and verify it has a Google Play product ID
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan?.googlePlayProductId) {
        console.error('Invalid or missing Google Play product ID for plan:', planId);
        throw new Error('Invalid plan for Google Play Billing');
      }

      console.log('Using Google Play product ID:', plan.googlePlayProductId);

      // Initialize Google Play Billing before attempting subscription
      try {
        await this._initializeGooglePlayBilling();
      } catch (error) {
        console.error('Failed to initialize Google Play Billing:', error);
        throw new Error('Google Play Billing is not available. If you installed from Play Store, please try again in a few seconds.');
      }

      // Log payment flow initiation with safe environment checks
      console.log('[TWA-Payment] Payment flow starting...');
      try {
        const canUsePaymentRequest = typeof PaymentRequest !== 'undefined';
        console.log('[TWA-Payment] Payment environment:', {
          hasPaymentRequest: canUsePaymentRequest,
          packageName: 'app.touchbase.site.twa',
          productId: plan.googlePlayProductId
        });

        if (!canUsePaymentRequest) {
          throw new Error('PaymentRequest API not available. Please ensure you are using the Play Store version.');
        }
      } catch (error) {
        console.error('[TWA-Payment] Environment check failed:', error);
        throw new Error('Failed to verify payment environment. Please try again.');
      }

      // Create PaymentRequest for Google Play billing with detailed logging
      console.log('[TWA-Payment] Creating payment request...');
      let request;
      try {
        // Construct payment method data array for PaymentRequest
        const methodData = [{
          supportedMethods: 'https://play.google.com/billing',
          data: {
            sku: plan.googlePlayProductId,
            type: 'subscriptionPurchase',
            purchaseToken: undefined, // Required for subscriptions but should be undefined for new purchases
            oldSkuPurchaseToken: undefined, // For subscription upgrades
            packageName: 'app.touchbase.site.twa', // Must match the TWA package name
            subscriptionPeriod: 'P1M', // Monthly subscription
            method: 'https://play.google.com/billing' // Explicitly specify Digital Goods API
          }
        }];

        console.log('[TWA-Payment] Payment method data:', JSON.stringify(methodData, null, 2));

        request = new PaymentRequest(
          methodData,
          {
            total: {
              label: `${plan.name} Subscription`,
              amount: { currency: 'USD', value: plan.price.toString() }
            }
          }
        );

        console.log('[TWA-Payment] Request created successfully');
      } catch (error) {
        console.error('[TWA-Payment] Failed to create payment request:', error);
        if (error instanceof Error) {
          console.error('[TWA-Payment] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        }
        throw new Error('Failed to initialize payment request. Please try again.');
      }

      // Log payment request object
      console.log('[TWA-Payment] Request configuration:', {
        hasCanMakePayment: typeof request.canMakePayment === 'function',
        hasShow: typeof request.show === 'function',
        id: request.id
      });

      // Check canMakePayment before showing
      console.log('[TWA-Payment] Checking canMakePayment...');
      let canMake = false;
      try {
        canMake = await request.canMakePayment();
        console.log('[TWA-Payment] canMakePayment result:', canMake);
      } catch (error) {
        console.error('[TWA-Payment] canMakePayment check failed:', error);
        throw new Error('Payment method not available. Please ensure you are using the Play Store version of the app.');
      }

      if (!canMake) {
        console.error('[TWA-Payment] Payment method not supported');
        throw new Error('Google Play Billing is not available on this device.');
      }

      // Start the payment flow with activity lifecycle handling
      console.log('[TWA-Payment] Starting payment flow');
      let paymentResponse: PaymentResponse;
      try {
        // Create a promise that resolves when the activity result completes
        const activityResultPromise = new Promise<PaymentResponse>((resolve, reject) => {
          let hasResult = false;
          
          // Function to check if we have activity result
          const checkActivityResult = async () => {
            try {
              console.log('[TWA-Payment] Checking for activity result...', {
                time: new Date().toISOString(),
                hasResult
              });
              const response = await request.show();
              console.log('[TWA-Payment] Activity result received', {
                time: new Date().toISOString(),
                hasResponse: Boolean(response),
                responseType: response ? typeof response : 'undefined'
              });
              hasResult = true;
              resolve(response);
            } catch (error) {
              console.log('[TWA-Payment] Activity result check error:', {
                time: new Date().toISOString(),
                errorType: error instanceof Error ? 'Error' : typeof error,
                errorMessage: error instanceof Error ? error.message : String(error)
              });
              if (!hasResult) {
                reject(error);
              }
            }
          };
          
          // Start checking for activity result
          console.log('[TWA-Payment] Starting initial activity result check');
          checkActivityResult();
          
          // Set up periodic checks to handle activity recreation
          console.log('[TWA-Payment] Setting up periodic activity checks');
          const checkInterval = setInterval(() => {
            if (!hasResult) {
              console.log('[TWA-Payment] Periodic check - no result yet');
              checkActivityResult();
            } else {
              console.log('[TWA-Payment] Periodic check - result received, cleaning up');
              clearInterval(checkInterval);
            }
          }, 500); // Check every 500ms
          
          // Clear interval after max timeout
          console.log('[TWA-Payment] Setting up timeout handler');
          setTimeout(() => {
            console.log('[TWA-Payment] Timeout reached, cleaning up');
            clearInterval(checkInterval);
            if (!hasResult) {
              console.log('[TWA-Payment] Timeout reached without result, failing');
              reject(new Error('Payment request timed out. Please try again.'));
            } else {
              console.log('[TWA-Payment] Timeout reached but result was already received');
            }
          }, 30000);
        });
        
        paymentResponse = await activityResultPromise;
        console.log('[TWA-Payment] Payment flow completed successfully', paymentResponse);
      } catch (error) {
        console.error('[TWA-Payment] Payment flow interrupted');
        console.error('[TWA-Payment] Error type:', typeof error);
        
        if (error instanceof Error) {
          console.error('[TWA-Payment] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error as any)
          });
        } else if (error instanceof DOMException) {
          console.error('[TWA-Payment] DOMException details:', {
            name: error.name,
            code: error.code,
            message: error.message
          });
        } else {
          console.error('[TWA-Payment] Raw error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Payment was cancelled by user.');
        } else {
          throw new Error('Payment flow failed unexpectedly. Please try again. ' +
            (error instanceof Error ? error.message : 'Unknown error occurred'));
        }
      }
      
      // Extract purchase details from the payment response
      const purchaseToken =
        paymentResponse.details?.paymentMethodData?.data?.purchaseToken ||
        paymentResponse.details?.data?.purchaseToken ||
        paymentResponse.details?.purchaseToken;

      if (!purchaseToken) {
        console.error('[TWA-Payment] Purchase token not found in any expected location');
        throw new Error('No purchase token received from Google Play. Please try again.');
      }

      console.log('[TWA-Payment] Successfully extracted purchase token');
      
      // Complete the payment to dismiss the payment UI
      await paymentResponse.complete('success');
      console.log('Payment UI completed successfully');

      // Update subscription in backend
      console.log('Updating subscription in backend...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found');
        throw new Error('No active session');
      }

      const backendResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-google-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          purchaseToken,
          productId: plan.googlePlayProductId
        }),
      });

      if (!backendResponse.ok) {
        console.error('Failed to verify purchase with backend');
        throw new Error('Failed to verify purchase');
      }

      console.log('Subscription created successfully');
      return purchaseToken;
    } catch (error) {
      console.error('Error creating Google Play subscription:', error);
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async cancelSubscription(accessToken: string): Promise<void> {
    try {
      console.log('Fetching subscription details...');
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('google_play_token')
        .single();

      if (!subscription?.google_play_token) {
        console.error('No Google Play token found');
        throw new Error('No active Google Play subscription');
      }

      console.log('Found Google Play token, proceeding with cancellation');
      
      // Create PaymentRequest for cancellation
      console.log('Creating PaymentRequest for Google Play cancellation...');
      const request = new PaymentRequest(
        [{
          supportedMethods: 'https://play.google.com/billing',
          data: {
            type: 'subscriptionManage',
            packageName: 'app.touchbase.site.twa',
            purchaseToken: subscription.google_play_token,
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

      // Start the cancellation flow
      console.log('Starting cancellation flow...');
      const paymentResponse = await request.show();
      
      // Complete the cancellation UI
      await paymentResponse.complete('success');
      console.log('Cancellation UI completed successfully');

      console.log('Notifying backend of cancellation...');
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-google-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token: subscription.google_play_token })
      });

      console.log('Successfully canceled subscription');
    } catch (error) {
      console.error('Error canceling Google Play subscription:', error);
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }
}

export const googlePlayService = new GooglePlayService();