// Platform detection utilities
export const platform = {
  isAndroid(): boolean {
    // Check if running in TWA
    return window.matchMedia('(display-mode: standalone)').matches 
      && /Android/i.test(navigator.userAgent);
  },

  isWeb(): boolean {
    return !this.isAndroid();
  }
};