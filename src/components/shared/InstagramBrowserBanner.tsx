import { platform } from '@/utils/platform';

/**
 * Displays a banner when the app is running inside Instagram's in-app browser.
 * Shows platform-specific instructions for opening in an external browser.
 *
 * Uses early detection results from inline script in index.html for iOS,
 * ensuring the banner appears immediately without white screen issues.
 */
export function InstagramBrowserBanner() {
  const status = platform.isInstagramBrowser();
  
  // Only show banner if we're in Instagram's browser
  if (!status.isInstagram) {
    return null;
  }

  // Platform-specific instructions
  const instructions = status.isIOS
    ? "Tap ⋯ and select 'Open in external browser'"  // iOS uses dots menu
    : "Tap ⋮ and select 'Open in browser'";         // Android uses vertical dots

  return (
    <div
      // z-[9999] ensures banner stays above other content
      // visibility: visible prevents any inadvertent hiding
      className="fixed bottom-0 left-0 right-0 bg-primary-500 text-white px-4 py-3 text-center z-[9999] shadow-lg"
      style={{ visibility: 'visible' }}
    >
      <div className="flex items-center justify-center gap-2">
        <p className="text-sm">
          You're using TouchBase inside Instagram. For the best experience:{' '}
          <span className="font-semibold">{instructions}</span>
        </p>
      </div>
    </div>
  );
}