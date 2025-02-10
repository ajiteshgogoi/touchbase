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
    // More reliable check - verify if Google Play Billing is available
    return !!(
      window.google?.payments?.subscriptions?.subscribe &&
      /Android/i.test(navigator.userAgent)
    );
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};