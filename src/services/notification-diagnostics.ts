import { platform } from '../utils/platform';
import { DeviceInfo } from '../utils/platform';

export class NotificationDiagnostics {
  private readonly firebaseSWURL: string;
  private diagnosticCache: Record<string, any> = {};

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  private async getStorageQuota(): Promise<Record<string, any>> {
    if (this.diagnosticCache.storage) return this.diagnosticCache.storage;

    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { available: false, error: 'Storage API not supported' };
      }

      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota ? (usage / quota) * 100 : 0;

      const storageState = {
        available: true,
        usage,
        quota,
        percentage,
        remaining: quota - usage
      };
      
      this.diagnosticCache.storage = storageState;
      return storageState;
    } catch (error: any) {
      return { available: false, error: error.message };
    }
  }

  private async getServiceWorkerState(): Promise<Record<string, any>> {
    if (this.diagnosticCache.sw) return this.diagnosticCache.sw;

    console.log('🔍 Checking Service Worker state...');
    const registrations = await navigator.serviceWorker.getRegistrations();
    const firebaseSW = registrations.find(reg => reg.active?.scriptURL === this.firebaseSWURL);
    
    const swState = {
      hasFirebaseSW: !!firebaseSW,
      swState: firebaseSW?.active?.state || 'none',
      totalRegistrations: registrations.length,
      registeredScripts: registrations.map(reg => reg.active?.scriptURL).filter(Boolean)
    };

    console.log('⚙️ Service Worker:', {
      state: swState.swState,
      active: swState.hasFirebaseSW
    });

    this.diagnosticCache.sw = swState;
    return swState;
  }

  private async getIndexedDBState(): Promise<Record<string, any>> {
    if (this.diagnosticCache.idb) return this.diagnosticCache.idb;

    console.log('🗄️ Checking IndexedDB state...');
    try {
      const databases = await window.indexedDB.databases();
      const request = indexedDB.open('fcm-test-db');
      
      const state = await new Promise<Record<string, any>>((resolve) => {
        request.onerror = () => {
          console.log('❌ IndexedDB error:', request.error?.name);
          resolve({
            available: false,
            error: request.error?.message || 'Access denied',
            errorCode: request.error?.name || 'Unknown'
          });
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const idbState = {
            available: true,
            version: db.version,
            objectStoreNames: Array.from(db.objectStoreNames),
            existingDatabases: databases.map(db => db.name)
          };
          db.close();
          console.log('✅ IndexedDB available');
          resolve(idbState);
        };
      });

      this.diagnosticCache.idb = state;
      return state;
    } catch (error: any) {
      console.log('❌ IndexedDB error:', error.name);
      return {
        available: false,
        error: error.message,
        errorCode: error.name,
        privateBrowsing: !window.indexedDB.databases
      };
    }
  }

  async handleFCMError(error: any, deviceInfo: DeviceInfo): Promise<never> {
    console.log('🔍 Starting FCM Error Diagnosis...');
    const swState = await this.getServiceWorkerState();
    const idbState = await this.getIndexedDBState();
    
    // Log critical information only
    console.log('📱 Device State:', {
      error: { message: error.message, code: error.code },
      deviceType: deviceInfo.deviceType,
      swState: swState.swState,
      idbAvailable: idbState.available,
      notificationPermission: Notification.permission
    });

    if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
      const errorMessage = error.message?.toLowerCase() || '';
      console.log('📱 Processing Mobile-Specific Error...');
      
      // Check critical mobile errors
      if (errorMessage.includes('messaging/permission-blocked')) {
        throw new Error('Push notification permission blocked. Please enable notifications in your device settings.');
      }
      
      if (errorMessage.includes('messaging/failed-service-worker')) {
        console.log('⚠️ Service Worker Failure Detected');
        const issues = await this.getDiagnosticInfo();
        throw new Error(`Push service error. ${issues}`);
      }

      // Installation-specific errors
      if ((deviceInfo.isTWA || deviceInfo.isPWA) && errorMessage.includes('messaging/unsupported-browser')) {
        throw new Error('Push notifications require the installed app version from Google Play Store.');
      }
    }
    
    // Get final diagnostic info
    console.log('🔍 Getting Final Diagnostic Info...');
    const diagnostics = await this.getDiagnosticInfo();
    throw new Error(`Push service error: ${diagnostics || error.message}`);
  }

  async getDiagnosticInfo(): Promise<string> {
    try {
      console.log('🔍 Starting Diagnostic Collection...');
      const swState = await this.getServiceWorkerState();
      const idbState = await this.getIndexedDBState();
      const storageQuota = await this.getStorageQuota();
      const deviceInfo = platform.getDeviceInfo();

      const issues: string[] = [];

      if (!swState.hasFirebaseSW) {
        issues.push('Firebase service worker not found');
      } else if (swState.swState !== 'activated') {
        issues.push(`Service worker state: ${swState.swState}`);
      }

      if (!idbState.available) {
        if (idbState.privateBrowsing) {
          issues.push('Private browsing mode detected');
        } else {
          issues.push('IndexedDB unavailable');
        }
      }

      if (!storageQuota.available) {
        issues.push('Storage API not available');
      } else if (storageQuota.percentage > 90) {
        issues.push('Storage nearly full');
      }

      if (deviceInfo.deviceType === 'android' && !navigator.onLine) {
        issues.push('No network connectivity');
      }

      if (issues.length > 0) {
        console.log('⚠️ Diagnostic Issues Found:', issues);
      } else {
        console.log('✅ No Diagnostic Issues Found');
      }

      return issues.length > 0 ? issues.join('; ') : '';
    } catch (error) {
      console.log('❌ Diagnostic Error');
      return 'Could not complete diagnostic checks';
    }
  }

  async checkPlayServicesStatus(): Promise<string> {
    console.log('🔍 Checking Play Services Status...');
    if (!platform.isAndroid()) {
      return 'Please ensure notifications are enabled in system settings.';
    }

    const deviceInfo = platform.getDeviceInfo();
    if (deviceInfo.isTWA || deviceInfo.isPWA) {
      try {
        const request = new PaymentRequest(
          [{ supportedMethods: 'https://play.google.com/billing' }],
          { total: { label: 'Test', amount: { currency: 'USD', value: '0' } } }
        );
        await request.canMakePayment();
        console.log('✅ Play Services Check Passed');
        return 'Please ensure Google Play Services is up to date.';
      } catch {
        console.log('❌ Play Services Check Failed');
        return 'Google Play Services appears to be missing or outdated.';
      }
    }

    return 'Please ensure Google Play Services is installed and updated.';
  }
}

export const notificationDiagnostics = new NotificationDiagnostics();