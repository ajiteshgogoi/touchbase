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
            method: 'https://play.google.com/billing', // Explicitly specify Digital Goods API
            api: 'digitalGoods' // Explicitly request Digital Goods API
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
          
          let showPromise: Promise<PaymentResponse> | null = null;

          // Function to handle the payment flow
          const handlePaymentFlow = async () => {
            if (showPromise) {
              return; // Already showing payment UI
            }

            try {
              console.log('[TWA-Payment] Starting payment flow...');
              showPromise = request.show();
              
              // Handle potential activity recreation during show()
              const showPromiseWithRetry = new Promise<PaymentResponse>(async (resolveShow, rejectShow) => {
                try {
                  const response = await showPromise;
                  console.log('[TWA-Payment] Initial payment flow response received', {
                    time: new Date().toISOString(),
                    hasResponse: Boolean(response),
                    responseType: response ? typeof response : 'undefined',
                    hasDetails: Boolean(response?.details),
                    methodName: response?.methodName
                  });
                  
                  // Validate response before resolving
                  if (!response || !response.details) {
                    console.log('[TWA-Payment] Response validation failed, waiting for activity recreation...');
                    // Don't reject immediately - allow activity recreation to potentially recover
                    return;
                  }
                  
                  resolveShow(response);
                } catch (e) {
                  console.log('[TWA-Payment] Show promise error:', e);
                  if (e instanceof Error && e.name !== 'AbortError') {
                    rejectShow(e);
                  }
                  // For AbortError, let the activity recreation handler take over
                }
              });

              const response = await showPromiseWithRetry;
              console.log('[TWA-Payment] Payment flow completed successfully', {
                time: new Date().toISOString(),
                hasResponse: Boolean(response),
                responseType: response ? typeof response : 'undefined',
                hasDetails: Boolean(response?.details),
                methodName: response?.methodName
              });
              
              hasResult = true;
              resolve(response);
            } catch (error) {
              console.log('[TWA-Payment] Payment flow error:', {
                time: new Date().toISOString(),
                errorType: error instanceof Error ? 'Error' : typeof error,
                errorMessage: error instanceof Error ? error.message : String(error)
              });
              
              if (!hasResult) {
                reject(error);
              }
            }
          };

          // Start the payment flow
          console.log('[TWA-Payment] Initiating payment flow');
          handlePaymentFlow();

          // Track activity state and handle recreation
          let attemptCount = 0;
          const maxAttempts = 3;
          let lastActivityState = 'initial';
          
          console.log('[TWA-Payment] Setting up activity state tracking');
          
          const checkInterval = setInterval(() => {
            if (hasResult) {
              console.log('[TWA-Payment] Payment completed - cleaning up');
              clearInterval(checkInterval);
              return;
            }

            // Check if we need to restart the flow
            const needsRestart = !showPromise ||
              (lastActivityState === 'paused' && document.visibilityState === 'visible');

            if (needsRestart && attemptCount < maxAttempts) {
              attemptCount++;
              console.log('[TWA-Payment] Activity state change detected', {
                attemptCount,
                lastState: lastActivityState,
                currentState: document.visibilityState,
                hasShowPromise: Boolean(showPromise)
              });
              
              // Clear existing promise
              showPromise = null;
              
              // Restart payment flow
              console.log('[TWA-Payment] Restarting payment flow (attempt ${attemptCount}/${maxAttempts})');
              handlePaymentFlow();
            }

            // Update activity state
            lastActivityState = document.visibilityState;
          }, 1000);

          // Listen for visibility changes
          const visibilityHandler = () => {
            console.log('[TWA-Payment] Visibility changed:', {
              state: document.visibilityState,
              hasResult,
              hasShowPromise: Boolean(showPromise)
            });
          };
          document.addEventListener('visibilitychange', visibilityHandler);

          // Clear interval and cleanup after timeout
          const timeoutDuration = 45000; // 45 seconds to account for activity transitions
          console.log('[TWA-Payment] Setting up timeout handler');
          setTimeout(() => {
            console.log('[TWA-Payment] Timeout status:', {
              hasResult,
              attemptCount,
              visibilityState: document.visibilityState
            });
            
            clearInterval(checkInterval);
            document.removeEventListener('visibilitychange', visibilityHandler);
            
            if (!hasResult) {
              console.log('[TWA-Payment] Timeout reached without result, failing');
              reject(new Error(`Payment request timed out after ${attemptCount} attempts. Please try again.`));
            } else {
              console.log('[TWA-Payment] Timeout reached but result was already received');
            }
          }, timeoutDuration);
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

        // Check for specific error messages that indicate user is already subscribed
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes('already own') ||
            errorMessage.includes('already subscribed') ||
            errorMessage.includes('already purchased') ||
            error.name === 'AlreadySubscribedError'
          ) {
            throw new Error('ALREADY_SUBSCRIBED');
          }
          
          if (error.name === 'AbortError') {
            throw new Error('Payment was cancelled by user.');
          }
        }
  
        throw new Error('Payment flow failed unexpectedly. Please try again. ' +
          (error instanceof Error ? error.message : 'Unknown error occurred'));
      }
      
      // Log full payment response details for debugging
      console.log('[TWA-Payment] Full payment response:', JSON.stringify({
        details: paymentResponse.details,
        methodName: paymentResponse.methodName,
        requestId: paymentResponse.requestId
      }, null, 2));

      // Extract purchase details from the payment response
      console.log('[TWA-Payment] Attempting to extract purchase token...');
      
      let purchaseToken: string | undefined;
      // Log raw payment response first
      console.log('[TWA-Payment] Raw payment response:', JSON.stringify(paymentResponse, null, 2));
      
      const paths = [
        'details.paymentMethodData.data.purchaseToken',
        'details.data.purchaseToken',
        'details.purchaseToken',
        'details.androidPayProvidedData.purchaseToken',
        'details.digitalGoods.purchaseToken',
        'details.googlePlayResponse.purchaseToken',
        'paymentMethodData.data.purchaseToken',
        'paymentMethodData.digitalGoods.purchaseToken',
        // Additional paths based on Digital Goods API
        'details.paymentMethodData.digitalGoods.purchaseToken',
        'details.paymentMethodData.googlePlayResponse.purchaseToken',
        'details.response.purchaseToken',
        'details.billing.purchaseToken',
        // Check deeply nested structures
        'details.paymentMethodData.data.digitalGoods.purchaseToken',
        'details.paymentMethodData.data.googlePlayBilling.purchaseToken',
        'details.paymentMethodData.data.response.purchaseToken'
      ];

      // First try direct path access
      for (const path of paths) {
        try {
          const value = path.split('.').reduce((obj, key) => obj?.[key], paymentResponse as any);
          console.log(`[TWA-Payment] Checking ${path}:`, value);
          if (value && typeof value === 'string') {
            purchaseToken = value;
            console.log(`[TWA-Payment] Found purchase token in ${path}`);
            break;
          }
        } catch (e) {
          console.log(`[TWA-Payment] Error checking path ${path}:`, e);
        }
      }

      // If no token found, try parsing nested JSON strings
      if (!purchaseToken && paymentResponse.details) {
        console.log('[TWA-Payment] Attempting to parse nested response data...');
        try {
          // Try parsing details if it's a string
          const parsedDetails = typeof paymentResponse.details === 'string'
            ? JSON.parse(paymentResponse.details)
            : paymentResponse.details;

          // Look for token in parsed details
          const possibleTokens = [
            parsedDetails?.purchaseToken,
            parsedDetails?.data?.purchaseToken,
            parsedDetails?.paymentMethodData?.data?.purchaseToken,
            parsedDetails?.digitalGoods?.purchaseToken
          ];

          for (const token of possibleTokens) {
            if (token && typeof token === 'string') {
              purchaseToken = token;
              console.log('[TWA-Payment] Found token in parsed details');
              break;
            }
          }

          // If still no token, log the parsed structure
          if (!purchaseToken) {
            console.log('[TWA-Payment] Parsed details structure:', JSON.stringify(parsedDetails, null, 2));
          }
        } catch (e) {
          console.log('[TWA-Payment] Error parsing nested response:', e);
        }
      }

      if (!purchaseToken) {
        // Additional debug logging for payment response structure
        console.error('[TWA-Payment] Purchase token extraction failed. Detailed response analysis:', {
          methodName: paymentResponse.methodName,
          hasDetails: Boolean(paymentResponse.details),
          detailsKeys: paymentResponse.details ? Object.keys(paymentResponse.details) : [],
          detailsType: paymentResponse.details ? typeof paymentResponse.details : 'undefined',
          responseStructure: {
            details: paymentResponse.details ? typeof paymentResponse.details : 'undefined',
            methodName: paymentResponse.methodName ? typeof paymentResponse.methodName : 'undefined',
            requestId: paymentResponse.requestId ? typeof paymentResponse.requestId : 'undefined'
          },
          fullResponse: JSON.stringify(paymentResponse, null, 2)
        });

        // Attempt one last parsing of stringified content
        if (typeof paymentResponse.details === 'string') {
          try {
            const parsedContent = JSON.parse(paymentResponse.details);
            console.log('[TWA-Payment] Parsed string content:', parsedContent);
            
            // Check common locations in parsed content
            const possibleToken =
              parsedContent.purchaseToken ||
              parsedContent.token ||
              parsedContent.payment_token ||
              parsedContent.digitalGoods?.purchaseToken ||
              parsedContent.paymentMethodData?.digitalGoods?.purchaseToken;
            
            if (possibleToken && typeof possibleToken === 'string') {
              console.log('[TWA-Payment] Found token in parsed string content');
              purchaseToken = possibleToken;
            }
          } catch (e) {
            console.log('[TWA-Payment] Failed to parse response details as JSON:', e);
          }
        }

        // If still no token, throw error with more context
        if (!purchaseToken) {
          throw new Error(
            'No purchase token received from Google Play. ' +
            'This might happen if the payment process was interrupted. ' +
            'Please try again and ensure you complete the payment flow.'
          );
        }
      }

      console.log('[TWA-Payment] Successfully extracted purchase token from response');
      
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