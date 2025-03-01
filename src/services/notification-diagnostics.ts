import { platform } from '../utils/platform';
import { DeviceInfo } from '../utils/platform';

export class NotificationDiagnostics {
  private readonly firebaseSWURL: string;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  private logDiagnosticState(context: string, state: Record<string, any>) {
    console.debug(`[FCM Diagnostics] ${context}:`, JSON.stringify(state, null, 2));
  }

  private async getStorageQuota(): Promise<Record<string, any>> {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return {
          available: false,
          error: 'Storage API not supported'
        };
      }

      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota ? (usage / quota) * 100 : 0;

      return {
        available: true,
        usage,
        quota,
        percentage,
        remaining: quota - usage
      };
    } catch (error: any) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  private async getServiceWorkerState(): Promise<Record<string, any>> {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const firebaseSW = registrations.find(reg => reg.active?.scriptURL === this.firebaseSWURL);
    
    return {
      hasFirebaseSW: !!firebaseSW,
      swState: firebaseSW?.active?.state || 'none',
      totalRegistrations: registrations.length,
      registeredScripts: registrations.map(reg => reg.active?.scriptURL).filter(Boolean)
    };
  }

  private async getIndexedDBState(): Promise<Record<string, any>> {
    try {
      const databases = await window.indexedDB.databases();
      const request = indexedDB.open('fcm-test-db');
      
      const state = await new Promise<Record<string, any>>((resolve) => {
        request.onerror = () => resolve({
          available: false,
          error: request.error?.message || 'Access denied',
          errorCode: request.error?.name || 'Unknown'
        });
        
        request.onsuccess = () => {
          const db = request.result;
          const state = {
            available: true,
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
            existingDatabases: databases.map(db => db.name)
          };
          db.close();
          resolve(state);
        };
      });

      return state;
    } catch (error: any) {
      return {
        available: false,
        error: error.message,
        errorCode: error.name,
        privateBrowsing: !window.indexedDB.databases
      };
    }
  }

  async handleFCMError(error: any, deviceInfo: DeviceInfo): Promise<never> {
    // Collect comprehensive diagnostic information
    const diagnosticState = {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      device: deviceInfo,
      serviceWorker: await this.getServiceWorkerState(),
      indexedDB: await this.getIndexedDBState(),
      storage: await this.getStorageQuota(),
      browserFeatures: {
        serviceWorkerSupported: 'serviceWorker' in navigator,
        notificationSupported: 'Notification' in window,
        notificationPermission: Notification.permission,
        persistentStorageSupported: 'persist' in navigator.storage,
        cookiesEnabled: navigator.cookieEnabled,
        language: navigator.language,
        onLine: navigator.onLine
      }
    };

    this.logDiagnosticState('FCM Registration Failed', diagnosticState);

    // Mobile-specific error handling with improved diagnostics
    if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
      const errorMessage = error.message?.toLowerCase() || '';
      console.error('Mobile FCM registration error:', diagnosticState);
      
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
        const swState = await this.getServiceWorkerState();
        this.logDiagnosticState('Service Worker State', swState);
        
        if (!swState.hasFirebaseSW) {
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
      const swState = await this.getServiceWorkerState();
      const idbState = await this.getIndexedDBState();
      const storageQuota = await this.getStorageQuota();
      const deviceInfo = platform.getDeviceInfo();

      // Log detailed diagnostic state for debugging
      this.logDiagnosticState('Detailed Diagnostics', {
        serviceWorker: swState,
        indexedDB: idbState,
        storage: storageQuota,
        device: deviceInfo,
        browser: {
          userAgent: navigator.userAgent,
          vendor: navigator.vendor,
          language: navigator.language,
          onLine: navigator.onLine,
          cookiesEnabled: navigator.cookieEnabled,
          doNotTrack: navigator.doNotTrack,
        },
        notification: {
          permission: Notification.permission,
          supported: 'Notification' in window
        }
      });

      const issues: string[] = [];

      // Service Worker Diagnostics
      if (!swState.hasFirebaseSW) {
        issues.push('Firebase service worker not found');
      } else if (swState.swState !== 'activated') {
        issues.push(`Service worker state: ${swState.swState}`);
      }
      if (swState.totalRegistrations > 1) {
        issues.push(`Multiple service workers detected (${swState.totalRegistrations})`);
      }

      // Notification Permission Diagnostics
      const permission = Notification.permission;
      if (permission === 'denied') {
        issues.push('Notification permission denied in browser settings');
      } else if (permission === 'default') {
        issues.push('Notification permission not granted');
      }

      // IndexedDB Diagnostics
      if (!idbState.available) {
        if (idbState.privateBrowsing) {
          issues.push('Private browsing mode detected - IndexedDB restricted');
        } else {
          issues.push(`IndexedDB error: ${idbState.error}`);
        }
      }

      // Storage Quota Diagnostics
      if (!storageQuota.available) {
        issues.push('Storage API not available');
      } else if (storageQuota.percentage > 90) {
        issues.push(`Storage nearly full (${Math.round(storageQuota.percentage)}% used)`);
      }

      // Device-specific Diagnostics
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        // Mobile-specific checks
        if (!deviceInfo.isTWA && !deviceInfo.isPWA) {
          issues.push('Running in browser mode - consider installing the app for better reliability');
        }
        
        // Only check Play Services on Android
        if (deviceInfo.deviceType === 'android') {
          const playServices = await this.checkPlayServicesStatus();
          if (playServices.includes('missing') || playServices.includes('outdated')) {
            issues.push('Google Play Services issue detected');
          }
        }

        // Network connectivity check
        if (!navigator.onLine) {
          issues.push('No network connectivity');
        }
      }

      // Return all issues or empty string if none found
      return issues.length > 0 ? issues.join('; ') : '';
    } catch (error) {
      console.error('Error getting diagnostic info:', error);
      this.logDiagnosticState('Diagnostic Error', { error });
      return 'Could not complete diagnostic checks';
    }
  }

  async checkPlayServicesStatus(): Promise<string> {
    try {
      if (!platform.isAndroid()) {
        return 'Please ensure notifications are enabled in system settings.';
      }

      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.isTWA || deviceInfo.isPWA) {
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