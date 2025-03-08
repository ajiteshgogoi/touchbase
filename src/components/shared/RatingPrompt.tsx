import { useEffect, useState } from 'react';
import { platform } from '../../utils/platform';

const RATING_STORAGE_KEY = 'app_rating';
const RATING_PROMPT_INTERVAL = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds

export const RatingPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only check for TWA environment
    if (!platform.isTWA()) return;

    const storageKey = platform.getDeviceStorageKey(RATING_STORAGE_KEY);
    const ratingData = localStorage.getItem(storageKey);
    const parsedData = ratingData ? JSON.parse(ratingData) : null;

    // Show prompt if:
    // 1. Never rated before (no data)
    // 2. Not rated yet and last prompt was > 14 days ago
    if (!parsedData || 
        (!parsedData.hasRated && 
         Date.now() - parsedData.lastPrompt >= RATING_PROMPT_INTERVAL)) {
      setShowPrompt(true);
      // Update last prompt time
      localStorage.setItem(storageKey, JSON.stringify({
        hasRated: parsedData?.hasRated || false,
        lastPrompt: Date.now()
      }));
    }
  }, []);

  const handleRate = () => {
    const packageName = 'app.touchbase.site.twa';
    const storageKey = platform.getDeviceStorageKey(RATING_STORAGE_KEY);
    
    // Mark as rated
    localStorage.setItem(storageKey, JSON.stringify({
      hasRated: true,
      lastPrompt: Date.now()
    }));

    // Hide prompt
    setShowPrompt(false);

    // Open Play Store
    window.location.href = `market://details?id=${packageName}`;
  };

  const handleLater = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-white rounded-lg shadow-lg p-4 mx-auto max-w-sm">
      <h3 className="text-lg font-semibold mb-2">Enjoying TouchBase?</h3>
      <p className="text-gray-600 mb-4">Your rating helps us improve the app!</p>
      <div className="flex justify-end space-x-3">
        <button
          onClick={handleLater}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          Maybe Later
        </button>
        <button
          onClick={handleRate}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Rate Now
        </button>
      </div>
    </div>
  );
};