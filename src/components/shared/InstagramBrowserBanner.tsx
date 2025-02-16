import { platform } from '@/utils/platform';

export function InstagramBrowserBanner() {
  if (!platform.isInstagramBrowser()) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4 text-center z-50">
      <p className="text-sm">
        For the best experience, including PWA installation, please{' '}
        <a href={window.location.href} 
           target="_blank" 
           rel="noopener noreferrer" 
           className="underline font-semibold">
          open in your browser
        </a>
      </p>
    </div>
  );
}