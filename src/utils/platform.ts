// Platform detection utilities used for payment and app functionality
// Also includes device identification for notifications

export type DeviceInfo = {
  deviceType: 'android' | 'ios' | 'web';
  deviceBrand: string;
  browserInfo: string;
  isTWA: boolean;
  isPWA: boolean;
};
declare global {
  interface Window {
    chrome?: {
      app?: {
        window?: unknown;
      };
      googlePlayReview?: {
        requestReview(): Promise<void>;
      };
    };
    google?: {
      play?: {
        inAppReview?: {
          requestReviewFlow(): Promise<void>;
          launchReviewFlow(): Promise<void>;
        };
      };
      payments: {
        subscriptions: {
          subscribe(sku: string): Promise<{ purchaseToken: string }>;
          acknowledge(token: string): Promise<void>;
          cancel(token: string): Promise<void>;
        };
      };
    };
  }
}

const BROWSER_INSTANCE_KEY = 'browser_instance_id';

export const platform = {
  browserInstanceId: (() => {
    let instanceId = localStorage.getItem(BROWSER_INSTANCE_KEY);
    if (!instanceId) {
      instanceId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(BROWSER_INSTANCE_KEY, instanceId);
    }
    return instanceId;
  })(),

  isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  },

  async isGooglePlayBillingAvailable(): Promise<boolean> {
    try {
      // Check if we're on Android first
      if (!this.isAndroid()) {
        console.log('Not on Android, Google Play Billing not available');
        return false;
      }

      // In TWA, Google Play Billing is exposed through PaymentRequest API
      // Check if PaymentRequest API is available
      if (typeof PaymentRequest === 'undefined') {
        console.log('PaymentRequest API not available');
        return false;
      }

      // Check if Google Play billing method is supported
      const request = new PaymentRequest(
        [{
          supportedMethods: 'https://play.google.com/billing',
          data: { test: 'test' } // Minimal data to test support
        }],
        { total: { label: 'Test', amount: { currency: 'USD', value: '0' } } }
      );

      console.log('Checking Google Play Billing support...');
      const canMakePayment = await request.canMakePayment();
      console.log('Google Play Billing support result:', canMakePayment);

      return canMakePayment;
    } catch (error) {
      console.error('Error checking Google Play Billing availability:', error);
      // Log more details about the error if it's an Error object
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      return false;
    }
  },

  isIOS(): boolean {
    // First try the traditional user agent check
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      return true;
    }

    // Check for iPad requesting desktop site
    // iPad on iOS 13+ reports as Mac
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0) {
      return true;
    }

    // Fallback check for standalone mode + iOS-specific features
    if (window.matchMedia('(display-mode: standalone)').matches) {
      // Check for iOS-specific features
      const isIOSPWA =
        'standalone' in window.navigator &&
        // @ts-ignore - iOS-specific property
        window.navigator.standalone === true;
      
      return isIOSPWA;
    }

    return false;
  },

  isWeb(): boolean {
    return !this.isAndroid() && !this.isIOS();
  },

  // Check if running in TWA (Trusted Web Activity)
  isTWA(): boolean {
    // More reliable TWA detection via Chrome navigation
    const isTrustedWebActivity = document.referrer.includes('android-app://');
    
    // Fallback check for standalone + android
    const isStandaloneAndroid = this.isAndroid() && window.matchMedia('(display-mode: standalone)').matches;
    
    // TWA specific: check for Digital Asset Links
    const hasAssetLinks = document.head.querySelector('link[rel="assetlinks.json"]') !== null;
    
    return isTrustedWebActivity || (isStandaloneAndroid && hasAssetLinks);
  },

  // Check if running as PWA
  isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches && !this.isTWA();
  },

  getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera')) return 'Opera';
    return 'Unknown';
  },

  getDeviceBrand(): string {
    const ua = navigator.userAgent;
    if (this.isAndroid()) {
      const matches = ua.match(/(Samsung|Google|OnePlus|Huawei|Xiaomi|OPPO|vivo|LG|Sony|Motorola|Nokia|ASUS|ZTE|HTC)/i);
      return matches?.[1] ?? 'Android';
    }
    if (this.isIOS()) {
      return 'Apple';
    }
    return 'Desktop';
  },

  getDeviceInfo(): DeviceInfo {
    // First check basic platform types
    if (this.isAndroid()) {
      const isTWAApp = this.isTWA();
      const isPWAApp = this.isPWA();
      return {
        deviceType: 'android',
        deviceBrand: this.getDeviceBrand(),
        browserInfo: this.getBrowserInfo(),
        isTWA: isTWAApp,
        isPWA: isPWAApp
      };
    }
    
    if (this.isIOS()) {
      return {
        deviceType: 'ios',
        deviceBrand: this.getDeviceBrand(),
        browserInfo: this.getBrowserInfo(),
        isTWA: false,
        isPWA: this.isPWA()
      };
    }
    
    // Default to web for desktop browsers
    return {
      deviceType: 'web',
      deviceBrand: this.getDeviceBrand(),
      browserInfo: this.getBrowserInfo(),
      isTWA: false,
      isPWA: this.isPWA()
    };
  },

  getStorageNamespace(): string {
    return this.isTWA() ? 'twa' : this.isPWA() ? 'pwa' : 'browser';
  },

  getDeviceStorageKey(key: string): string {
    const namespace = this.getStorageNamespace();
    return `${namespace}_${key}`;
  },

  generateDeviceFingerprint(): string {
    // Use available browser properties to generate a stable fingerprint
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const vendor = gl?.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? 0) ?? '';
    const renderer = gl?.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? 0) ?? '';
    
    // Combine hardware info with screen properties
    const components = [
      vendor,
      renderer,
      screen.colorDepth,
      screen.width,
      screen.height,
      navigator.hardwareConcurrency,
      navigator.userAgent
    ].join('|');

    // Generate a deterministic hash
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
      const char = components.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert hash to base36 and take first 8 chars
    const fingerprint = Math.abs(hash).toString(36).substring(0, 8);
    return fingerprint;
  },

  generateDeviceId(): string {
    const deviceInfo = this.getDeviceInfo();
    
    // Create a comprehensive device signature
    const deviceSignature = JSON.stringify({
      type: deviceInfo.deviceType,
      brand: deviceInfo.deviceBrand,
      browser: deviceInfo.browserInfo,
      isTWA: deviceInfo.isTWA,
      isPWA: deviceInfo.isPWA,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      vendor: navigator.vendor,
      hardwareConcurrency: navigator.hardwareConcurrency,
      browserInstanceId: this.browserInstanceId
    });

    // Create unique hash from device signature
    const deviceHash = btoa(deviceSignature).slice(0, 12);
    
    // Build final device ID
    const deviceId = `${deviceInfo.deviceType}-${deviceHash}`;
    
    // Store in namespaced storage
    localStorage.setItem(this.getDeviceStorageKey('device_id'), deviceId);
    return deviceId;
  },

  parseDeviceId(deviceId: string): {
    installType: 'TWA' | 'PWA' | 'Browser';
    deviceType: string;
    brand: string;
    browser?: string;
  } {
    try {
      const parts = deviceId.split('-');
      
      // Handle legacy or malformed device IDs
      if (parts.length < 3) {
        return {
          installType: 'Browser',
          deviceType: 'Web',
          brand: 'Unknown'
        };
      }

      const rawInstallType = (parts[0] ?? '').toUpperCase();
      const installType = (rawInstallType === 'TWA' || rawInstallType === 'PWA')
        ? rawInstallType as 'TWA' | 'PWA'
        : 'Browser';
      
      const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      
      const deviceType = capitalizeFirst(parts[1] ?? 'web');
      const brand = capitalizeFirst(parts[2] ?? 'unknown');
      const browser = parts[3] ? capitalizeFirst(parts[3]) : undefined;

      return {
        installType,
        deviceType,
        brand,
        browser
      };
    } catch (error) {
      // Fallback for any parsing errors
      return {
        installType: 'Browser',
        deviceType: 'Web',
        brand: 'Unknown'
      };
    }
  }
};