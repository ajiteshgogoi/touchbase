import { platform } from '@/utils/platform';

export function InstagramBrowserBanner() {
  if (!platform.isInstagramBrowser()) {
    return null;
  }

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