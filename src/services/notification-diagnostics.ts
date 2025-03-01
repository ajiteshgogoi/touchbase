import { platform } from '../utils/platform';

import { DeviceInfo } from '../utils/platform';

export class NotificationDiagnostics {
  private readonly firebaseSWURL: string;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  async handleFCMError(error: any, deviceInfo: DeviceInfo): Promise<never> {
    // Mobile-specific error handling with improved diagnostics
    if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
      const errorMessage = error.message?.toLowerCase() || '';
      console.error('Mobile FCM registration error:', error);
      
      // Check for common mobile-specific errors
      if (errorMessage.includes('messaging/permission-blocked')) {
        throw new Error('Push notification permission blocked. Please enable notifications in your device settings.');
      }
      
      if (errorMessage.includes('messaging/failed-service-worker')) {
        // Get diagnostic info for service worker issues
        const swDiagnostics = await this.getDiagnosticInfo();
        throw new Error(swDiagnostics || 'Push service error. Please check that notifications are enabled in system settings.');
      }
      
      if (errorMessage.includes('messaging/failed-token-generation')) {
        // Check Play Services status for token generation issues
        const playServicesStatus = await this.checkPlayServicesStatus();
        throw new Error(playServicesStatus);
      }

      // Installation type specific errors with improved messaging
      if (deviceInfo.isTWA) {
        if (errorMessage.includes('messaging/unsupported-browser')) {
          throw new Error('Push notifications are not working. Please ensure you\'re using the installed app version from Google Play Store.');
        }
      } else if (deviceInfo.isPWA) {
        if (errorMessage.includes('messaging/unsupported-browser')) {
          const swDiagnostics = await this.getDiagnosticInfo();
          if (swDiagnostics) {
            throw new Error(`${swDiagnostics} For best experience, please install the app from Google Play Store.`);
          }
          throw new Error('This browser version may not fully support push notifications. Please install the app from Google Play Store for the best experience.');
        }
      }

      // For mobile token errors, attempt cleanup and recheck
      if (errorMessage.includes('messaging/token') || errorMessage.includes('fcm_token')) {
        console.log('FCM token error detected, checking service worker state...');
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hasFirebaseSW = registrations.some(reg => reg.active?.scriptURL === this.firebaseSWURL);
        
        if (!hasFirebaseSW) {
          throw new Error('Firebase service worker not found. Please refresh the page and try again.');
        }

        // Service worker exists but token failed - likely a temporary issue
        const diagnosticInfo = await this.getDiagnosticInfo();
        if (diagnosticInfo) {
          throw new Error(`${diagnosticInfo} Please try again or reinstall the app.`);
        }
      }

      // Default mobile error with diagnostic info
      const diagnosticInfo = await this.getDiagnosticInfo();
      throw new Error(`Push registration failed: ${diagnosticInfo || error.message}. Please ensure notifications are enabled in both app and system settings.`);
    }
    
    // Non-mobile errors with diagnostic info
    const diagnosticInfo = await this.getDiagnosticInfo();
    throw new Error(`Push service error: ${diagnosticInfo || error.message}. Please check browser notification permissions.`);
  }

  async getDiagnosticInfo(): Promise<string> {
    try {
      // Check service worker registration
      const registrations = await navigator.serviceWorker.getRegistrations();
      const hasFirebaseSW = registrations.some(reg => reg.active?.scriptURL === this.firebaseSWURL);
      if (!hasFirebaseSW) {
        return 'Firebase service worker not found. Please try refreshing the page.';
      }

      // Check notification permission
      const permission = Notification.permission;
      if (permission === 'denied') {
        return 'Notification permission denied. Please enable in browser settings.';
      }

      // Check IndexedDB access
      try {
        const request = indexedDB.open('fcm-test-db');
        await new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(new Error('IndexedDB access denied'));
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
        });
      } catch {
        return 'Browser storage access denied. Please check privacy settings.';
      }

      return '';
    } catch (error) {
      console.error('Error getting diagnostic info:', error);
      return 'Could not complete diagnostic checks.';
    }
  }

  async checkPlayServicesStatus(): Promise<string> {
    try {
      // Check if on Android
      if (!platform.isAndroid()) {
        return 'Please ensure notifications are enabled in system settings.';
      }

      // Check if running as TWA/PWA
      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.isTWA || deviceInfo.isPWA) {
        // For TWA/PWA, we can check Google Play Services indirectly
        if (typeof PaymentRequest !== 'undefined') {
          try {
            const request = new PaymentRequest(
              [{
                supportedMethods: 'https://play.google.com/billing',
                data: { test: 'test' }
              }],
              { total: { label: 'Test', amount: { currency: 'USD', value: '0' } } }
            );
            await request.canMakePayment();
            return 'Please ensure Google Play Services is up to date.';
          } catch {
            return 'Google Play Services appears to be missing or outdated.';
          }
        }
      }

      return 'Please ensure Google Play Services is installed and updated.';
    } catch (error) {
      console.error('Error checking Play Services:', error);
      return 'Could not verify Google Play Services status.';
    }
  }
}

export const notificationDiagnostics = new NotificationDiagnostics();