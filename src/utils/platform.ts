export type DeviceType = 'web' | 'android' | 'ios';

interface BrowserInfo {
  name: string;
  version: string;
}

const getBrowserInfo = (): BrowserInfo => {
  const ua = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "";

  // Chrome
  if (/Chrome/.test(ua) && !/Chromium|Edge|OPR|Samsung/.test(ua)) {
    browserName = "Chrome";
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || "";
  }
  // Firefox
  else if (/Firefox/.test(ua) && !/Seamonkey/.test(ua)) {
    browserName = "Firefox";
    browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || "";
  }
  // Safari
  else if (/Safari/.test(ua) && !/Chrome|Chromium|Edge|OPR|Samsung/.test(ua)) {
    browserName = "Safari";
    browserVersion = ua.match(/Version\/(\d+)/)?.[1] || "";
  }
  // Edge
  else if (/Edge|Edg/.test(ua)) {
    browserName = "Edge";
    browserVersion = ua.match(/(?:Edge|Edg)\/(\d+)/)?.[1] || "";
  }
  // Samsung Internet
  else if (/Samsung/.test(ua)) {
    browserName = "Samsung";
    browserVersion = ua.match(/SamsungBrowser\/(\d+)/)?.[1] || "";
  }
  // Opera
  else if (/OPR/.test(ua)) {
    browserName = "Opera";
    browserVersion = ua.match(/OPR\/(\d+)/)?.[1] || "";
  }

  return {
    name: browserName,
    version: browserVersion
  };
};

export const platform = {
  isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  },

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches &&
           !document.referrer.startsWith('android-app://') &&
           !navigator.userAgent.includes('wv') &&
           'serviceWorker' in navigator;
  },

  isTWA(): boolean {
    return this.isAndroid() && 
           window.matchMedia('(display-mode: standalone)').matches &&
           (document.referrer.startsWith('android-app://') ||
            navigator.userAgent.includes('wv'));
  },

  getBrowserIdentifier(): string {
    const { name, version } = getBrowserInfo();
    return `${name}${version}`;
  },

  getDeviceModel(): string {
    const ua = navigator.userAgent;
    let model = "Unknown";
    
    if (this.isAndroid()) {
      // Try to extract Android device model
      const match = ua.match(/\(Linux;.+?;(.+?)\)/i);
      if (match?.[1]) {
        model = match[1].split(';').pop()?.trim() || "Android Device";
      }
    } else if (this.isIOS()) {
      // Try to extract iOS device model
      const match = ua.match(/\(([^;]+);.+?OS/);
      if (match?.[1]) {
        model = match[1].trim();
      }
    }
    
    return model;
  },

  getDeviceType(): DeviceType {
    // Return device type that aligns with database schema:
    // Check mobile platforms first
    if (this.isAndroid()) {
      return 'android';
    }
    if (this.isIOS()) {
      return 'ios';
    }
    // For TWA/PWA, still report as 'android' or 'web' to match schema
    if (this.isTWA()) {
      return 'android';
    }
    if (this.isPWA()) {
      return this.isAndroid() ? 'android' : 'web';
    }
    // Default to web
    return 'web';
  },

  getDisplayName(): string {
    if (this.isTWA()) {
      return 'Android App';
    }
    if (this.isPWA()) {
      return this.isAndroid() ? 'Android App' : 'Mobile App';
    }

    const deviceType = this.getDeviceType();
    switch (deviceType) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iOS';
      case 'web':
        return 'Desktop';
      default:
        return deviceType;
    }
  },

  formatDeviceType(type: DeviceType): string {
    switch (type) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iOS';
      case 'web':
        return 'Desktop';
      default:
        return type;
    }
  },

  async isGooglePlayBillingAvailable(): Promise<boolean> {
    try {
      if (!this.isAndroid()) {
        console.log('Not on Android, Google Play Billing not available');
        return false;
      }

      if (typeof PaymentRequest === 'undefined') {
        console.log('PaymentRequest API not available');
        return false;
      }

      const request = new PaymentRequest(
        [{
          supportedMethods: 'https://play.google.com/billing',
          data: { test: 'test' }
        }],
        { total: { label: 'Test', amount: { currency: 'USD', value: '0' } } }
      );

      console.log('Checking Google Play Billing support...');
      const canMakePayment = await request.canMakePayment();
      console.log('Google Play Billing support result:', canMakePayment);

      return canMakePayment;
    } catch (error) {
      console.error('Error checking Google Play Billing availability:', error);
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      return false;
    }
  }
};