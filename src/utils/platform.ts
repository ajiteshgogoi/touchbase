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
    };
    google?: {
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

export const platform = {
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
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isWeb(): boolean {
    return !this.isAndroid();
  },

  // Check if running in TWA (Trusted Web Activity)
  isTWA(): boolean {
    return this.isAndroid() && window.matchMedia('(display-mode: standalone)').matches;
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
    const deviceType = this.isAndroid() ? 'android' : this.isIOS() ? 'ios' : 'web';
    return {
      deviceType,
      deviceBrand: this.getDeviceBrand(),
      browserInfo: this.getBrowserInfo(),
      isTWA: this.isTWA(),
      isPWA: this.isPWA()
    };
  },

  generateDeviceId(): string {
    const info = this.getDeviceInfo();
    const prefix = info.isTWA ? 'twa' : info.isPWA ? 'pwa' : 'browser';
    const deviceType = info.deviceType;
    const brand = info.deviceBrand.toLowerCase();
    const browser = info.isTWA ? '' : `-${info.browserInfo.toLowerCase()}`;
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${prefix}-${deviceType}-${brand}${browser}-${random}`;
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

      const rawInstallType = parts[0].toUpperCase();
      const installType = (rawInstallType === 'TWA' || rawInstallType === 'PWA')
        ? rawInstallType as 'TWA' | 'PWA'
        : 'Browser';
      
      const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      
      const deviceType = capitalizeFirst(parts[1] || 'web');
      const brand = capitalizeFirst(parts[2] || 'unknown');
      const browser = parts[3] ? capitalizeFirst(parts[3] ?? '') : undefined;

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