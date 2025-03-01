import { platform } from '../utils/platform';
import { DeviceInfo } from '../utils/platform';

export class NotificationDiagnostics {
  private readonly firebaseSWURL: string;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  private logDiagnosticState(context: string, state: Record<string, any>) {
    // Using console.log for better visibility
    console.log(`
========== FCM DIAGNOSTICS: ${context} ==========
${JSON.stringify(state, null, 2)}
===============================================`);
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
    
    const state = {
      hasFirebaseSW: !!firebaseSW,
      swState: firebaseSW?.active?.state || 'none',
      totalRegistrations: registrations.length,
      registeredScripts: registrations.map(reg => reg.active?.scriptURL).filter(Boolean)
    };

    console.log('🔍 Service Worker State:', state);
    return state;
  }

  private async getIndexedDBState(): Promise<Record<string, any>> {
    try {
      const databases = await window.indexedDB.databases();
      const request = indexedDB.open('fcm-test-db');
      
      const state = await new Promise<Record<string, any>>((resolve) => {
        request.onerror = () => {
          const errorState = {
            available: false,
            error: request.error?.message || 'Access denied',
            errorCode: request.error?.name || 'Unknown'
          };
          console.log('❌ IndexedDB Error:', errorState);
          resolve(errorState);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const state = {
            available: true,
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
            existingDatabases: databases.map(db => db.name)
          };
          db.close();
          console.log('✅ IndexedDB State:', state);
          resolve(state);
        };
      });

      return state;
    } catch (error: any) {
      const errorState = {
        available: false,
        error: error.message,
        errorCode: error.name,
        privateBrowsing: !window.indexedDB.databases
      };
      console.log('❌ IndexedDB Error:', errorState);
      return errorState;
    }
  }

  async handleFCMError(error: any, deviceInfo: DeviceInfo): Promise<never> {
    console.log('🔍 Starting FCM Error Diagnosis...');
    
    // Collect comprehensive diagnostic information
    console.log('📱 Device Info:', deviceInfo);
    console.log('❌ Original Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    const swState = await this.getServiceWorkerState();
    const idbState = await this.getIndexedDBState();
    const storageState = await this.getStorageQuota();
    console.log('💾 Storage State:', storageState);

    const browserFeatures = {
      serviceWorkerSupported: 'serviceWorker' in navigator,
      notificationSupported: 'Notification' in window,
      notificationPermission: Notification.permission,
      persistentStorageSupported: 'persist' in navigator.storage,
      cookiesEnabled: navigator.cookieEnabled,
      language: navigator.language,
      onLine: navigator.onLine
    };
    console.log('🌐 Browser Features:', browserFeatures);

    const diagnosticState = {
      error: { message: error.message, code: error.code, stack: error.stack },
      device: deviceInfo,
      serviceWorker: swState,
      indexedDB: idbState,
      storage: storageState,
      browserFeatures
    };

    this.logDiagnosticState('Complete System State', diagnosticState);

    // Mobile-specific error handling with improved diagnostics
    if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
      const errorMessage = error.message?.toLowerCase() || '';
      console.log('📱 Processing Mobile-Specific Error...');
      
      // Check for common mobile-specific errors
      if (errorMessage.includes('messaging/permission-blocked')) {
        throw new Error('Push notification permission blocked. Please enable notifications in your device settings.');
      }
      
      if (errorMessage.includes('messaging/failed-service-worker')) {
        console.log('❌ Service Worker Failure Detected');
        const swDiagnostics = await this.getDiagnosticInfo();
        throw new Error(swDiagnostics || 'Push service error. Please check that notifications are enabled in system settings.');
      }
      
      if (errorMessage.includes('messaging/failed-token-generation')) {
        console.log('❌ Token Generation Failure Detected');
        const playServicesStatus = await this.checkPlayServicesStatus();
        throw new Error(playServicesStatus);
      }

      // Installation type specific errors with improved messaging
      if (deviceInfo.isTWA || deviceInfo.isPWA) {
        console.log('📱 Checking Installation-Specific Issues...');
        if (errorMessage.includes('messaging/unsupported-browser')) {
          if (deviceInfo.isTWA) {
            throw new Error('Push notifications are not working. Please ensure you\'re using the installed app version from Google Play Store.');
          } else {
            const swDiagnostics = await this.getDiagnosticInfo();
            throw new Error(`${swDiagnostics} For best experience, please install the app from Google Play Store.`);
          }
        }
      }

      // Token errors require special handling
      if (errorMessage.includes('messaging/token') || errorMessage.includes('fcm_token')) {
        console.log('🔑 FCM Token Issue Detected');
        const swState = await this.getServiceWorkerState();
        if (!swState.hasFirebaseSW) {
          throw new Error('Firebase service worker not found. Please refresh the page and try again.');
        }
      }

      // Get final diagnostic info
      console.log('🔍 Getting Final Diagnostic Info...');
      const finalDiagnostics = await this.getDiagnosticInfo();
      const fullError = `Push registration failed: ${finalDiagnostics || error.message}. Please ensure notifications are enabled in both app and system settings.`;
      console.log('❌ Final Error:', { diagnostics: finalDiagnostics, fullError });
      throw new Error(fullError);
    }
    
    // Non-mobile error handling
    console.log('💻 Processing Desktop Error...');
    const finalDiagnostics = await this.getDiagnosticInfo();
    const fullError = `Push service error: ${finalDiagnostics || error.message}. Please check browser notification permissions.`;
    console.log('❌ Final Error:', { diagnostics: finalDiagnostics, fullError });
    throw new Error(fullError);
  }

  async getDiagnosticInfo(): Promise<string> {
    try {
      console.log('🔍 Starting Diagnostic Collection...');
      
      const swState = await this.getServiceWorkerState();
      const idbState = await this.getIndexedDBState();
      const storageQuota = await this.getStorageQuota();
      const deviceInfo = platform.getDeviceInfo();

      const diagnosticState = {
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
      };

      this.logDiagnosticState('Diagnostic Collection', diagnosticState);

      const issues: string[] = [];

      if (!swState.hasFirebaseSW) {
        issues.push('Firebase service worker not found');
      } else if (swState.swState !== 'activated') {
        issues.push(`Service worker state: ${swState.swState}`);
      }
      if (swState.totalRegistrations > 1) {
        issues.push(`Multiple service workers detected (${swState.totalRegistrations})`);
      }

      if (Notification.permission === 'denied') {
        issues.push('Notification permission denied in browser settings');
      } else if (Notification.permission === 'default') {
        issues.push('Notification permission not granted');
      }

      if (!idbState.available) {
        if (idbState.privateBrowsing) {
          issues.push('Private browsing mode detected - IndexedDB restricted');
        } else {
          issues.push(`IndexedDB error: ${idbState.error}`);
        }
      }

      if (!storageQuota.available) {
        issues.push('Storage API not available');
      } else if (storageQuota.percentage > 90) {
        issues.push(`Storage nearly full (${Math.round(storageQuota.percentage)}% used)`);
      }

      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        if (!deviceInfo.isTWA && !deviceInfo.isPWA) {
          issues.push('Running in browser mode - consider installing the app for better reliability');
        }
        
        if (deviceInfo.deviceType === 'android') {
          const playServices = await this.checkPlayServicesStatus();
          if (playServices.includes('missing') || playServices.includes('outdated')) {
            issues.push('Google Play Services issue detected');
          }
        }

        if (!navigator.onLine) {
          issues.push('No network connectivity');
        }
      }

      if (issues.length > 0) {
        console.log('⚠️ Diagnostic Issues Found:', issues);
      } else {
        console.log('✅ No Diagnostic Issues Found');
      }

      return issues.length > 0 ? issues.join('; ') : '';
    } catch (error) {
      console.error('❌ Error in Diagnostics:', error);
      this.logDiagnosticState('Diagnostic Error', { error });
      return 'Could not complete diagnostic checks';
    }
  }

  async checkPlayServicesStatus(): Promise<string> {
    try {
      console.log('🔍 Checking Play Services Status...');
      
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
          } catch (error) {
            console.log('❌ Play Services Check Failed:', error);
            return 'Google Play Services appears to be missing or outdated.';
          }
        }
      }

      return 'Please ensure Google Play Services is installed and updated.';
    } catch (error) {
      console.error('❌ Error checking Play Services:', error);
      return 'Could not verify Google Play Services status.';
    }
  }
}

export const notificationDiagnostics = new NotificationDiagnostics();