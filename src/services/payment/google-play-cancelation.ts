interface CancelationResult {
  success: boolean;
  error?: string;
}

export class GooglePlayCancelationHandler {
  async handleCancelation(token: string): Promise<CancelationResult> {
    console.log('[TWA-Cancelation] Starting cancelation flow...');

    const isTWA = window.matchMedia('(display-mode: standalone)').matches ||
                  document.referrer.includes('android-app://');
    
    if (!isTWA) {
      return {
        success: false,
        error: 'Must be launched from Play Store version to manage subscription.'
      };
    }
    
    if (!window.google?.payments?.subscriptions?.cancel) {
      return {
        success: false,
        error: 'Google Play subscription service not available. Please ensure you are using the Play Store version.'
      };
    }

    try {
      await window.google.payments.subscriptions.cancel(token);
      console.log('[TWA-Cancelation] Cancelation completed successfully');
      return { success: true };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel subscription';
      console.error('[TWA-Cancelation] Cancelation failed:', {
        errorType: error instanceof Error ? 'Error' : typeof error,
        name: error instanceof Error ? error.name : undefined,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        time: new Date().toISOString()
      });
      return { success: false, error: errorMessage };
    }
  }
}

export const googlePlayCancelationHandler = new GooglePlayCancelationHandler();