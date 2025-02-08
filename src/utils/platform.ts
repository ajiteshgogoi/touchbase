// Platform detection utilities
declare global {
  interface Window {
    chrome?: {
      app?: {
        window?: unknown;
      };
    };
  }
}

export const platform = {
  isAndroid(): boolean {
    return (
      // Check if running in TWA
      (window.chrome?.app?.window !== undefined || 
       document.referrer.includes('android-app://')) &&
      // Verify Android
      /Android/i.test(navigator.userAgent)
    );
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};