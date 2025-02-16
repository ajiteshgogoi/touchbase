import { platform } from '@/utils/platform';

export function InstagramBrowserBanner() {
  const status = platform.isInstagramBrowser();
  
  if (!status.isInstagram) {
    return null;
  }

  // Use unified banner for both platforms
  if (status.isIOS || status.isAndroid) {
    const instructions = status.isIOS
      ? "Tap ⋯ and select 'Open in external browser'"
      : "Tap ⋮ and select 'Open in browser'";

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-primary-500 text-white px-4 py-3 text-center z-50 shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm">
            You're using TouchBase inside Instagram. For the best experience:{' '}
            <span className="font-semibold">{instructions}</span>
          </p>
        </div>
      </div>
    );
  }

  return null;
}