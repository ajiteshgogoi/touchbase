import { platform } from '@/utils/platform';

export function InstagramBrowserBanner() {
  const status = platform.isInstagramBrowser();
  
  if (!status.isInstagram) {
    return null;
  }

  // For iOS Instagram, redirect to external browser
  if (status.isIOS) {
    // Force external browser for iOS Instagram
    const openInBrowser = () => {
      const url = window.location.href;
      window.location.href = `googlechrome://${url.substring(url.indexOf('://')+3)}`;
      // Fallback to Safari after a short delay
      setTimeout(() => {
        window.location.href = url;
      }, 500);
    };

    // Auto-trigger the external browser open
    if (typeof window !== 'undefined') {
      openInBrowser();
    }

    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 p-4">
        <div className="bg-primary-500 text-white px-6 py-4 rounded-lg text-center max-w-sm">
          <p className="text-lg font-medium mb-2">
            Opening in External Browser
          </p>
          <p className="text-sm">
            TouchBase requires features not available in the Instagram browser. Redirecting to your default browser...
          </p>
        </div>
      </div>
    );
  }

  // For Android Instagram, use the full-featured banner
  if (status.isAndroid) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-primary-600 to-primary-500 text-white px-4 py-3 text-center z-50 shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm">
            You're using TouchBase inside Instagram. For a better experience:{' '}
            <span className="font-semibold">
              Tap the three dots ⋮ and select 'Open in browser'
            </span>
          </p>
        </div>
      </div>
    );
  }

  return null;
}