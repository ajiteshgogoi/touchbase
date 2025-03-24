import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { StarIcon } from '@heroicons/react/24/outline';
import { platform } from '../../utils/platform';
import { useRatingSettings } from '../../hooks/useRatingSettings';
import type { User } from '@supabase/supabase-js';
import type { NotificationSettings } from '../../types';

const INITIAL_WAIT_PERIOD = 10 * 24 * 60 * 60 * 1000; // 10 days
const REPEAT_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days

// For testing, uncomment these
// const INITIAL_WAIT_PERIOD = 30 * 1000; // 30 seconds
// const REPEAT_INTERVAL = 30 * 1000; // 30 seconds

interface RatingPromptProps {
  user?: User | null;
  settings?: NotificationSettings;
}

export const RatingPrompt = ({ user, settings }: RatingPromptProps) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { updateRatingStatus, updateLastPromptTime } = useRatingSettings();
  const depsReadyRef = useRef(false);

  useEffect(() => {
    console.log('Rating prompt effect running');

    // Reset ref when deps change
    depsReadyRef.current = false;
    
    // Only show for authenticated users in TWA
    if (!platform.isTWA() || !user || !settings) {
      console.log('Early return - Requirements not met:', {
        isTWA: platform.isTWA(),
        hasUser: !!user,
        hasSettings: !!settings
      });
      return;
    }

    // Skip if we've already processed these deps
    if (depsReadyRef.current) {
      console.log('Skip - Already processed these deps');
      return;
    }

    depsReadyRef.current = true;

    // Don't show if already rated
    if (settings.has_rated_app) {
      console.log('User has already rated app');
      return;
    }

    const now = Date.now();
    const installDate = new Date(settings.install_time || Date.now()).getTime();
    const lastPrompt = settings.last_rating_prompt ? new Date(settings.last_rating_prompt).getTime() : null;

    console.log('Checking prompt timing:', {
      now: new Date(now).toISOString(),
      installDate: new Date(installDate).toISOString(),
      lastPrompt: lastPrompt ? new Date(lastPrompt).toISOString() : 'never',
      daysSinceInstall: Math.floor((now - installDate) / (24 * 60 * 60 * 1000)),
      daysSinceLastPrompt: lastPrompt ? Math.floor((now - lastPrompt) / (24 * 60 * 60 * 1000)) : 'n/a'
    });

    // First time check: Wait 10 days after installation
    if (!lastPrompt) {
      if (now - installDate >= INITIAL_WAIT_PERIOD) {
        console.log('Showing first prompt after installation');
        setShowPrompt(true);
        updateLastPromptTime(user.id);
      } else {
        console.log('Not enough time passed since installation');
      }
      return;
    }

    // Subsequent checks: Show every 30 days if dismissed
    if (now - lastPrompt >= REPEAT_INTERVAL) {
      console.log('Showing repeat prompt');
      setShowPrompt(true);
      updateLastPromptTime(user.id);
    } else {
      console.log('Not enough time passed since last prompt');
    }
  }, [user?.id, settings?.install_time, settings?.has_rated_app, settings?.last_rating_prompt, updateLastPromptTime]);

  const tryNativeReview = () => {
    console.log('[Rating] Checking AndroidInterface availability');
    if (typeof (window as any).AndroidInterface?.requestInAppReview === 'function') {
      console.log('[Rating] AndroidInterface.requestInAppReview is available, calling it');
      (window as any).AndroidInterface.requestInAppReview();
      return true;
    }
    console.log('[Rating] AndroidInterface.requestInAppReview is NOT available');
    console.log('[Rating] window.AndroidInterface:', (window as any).AndroidInterface);
    return false;
  };

  const handleRate = async () => {
    const packageName = 'app.touchbase.site.twa';
    console.log('[Rating] Rate button clicked');
    
    // Update rating status in database
    if (user) {
      console.log('[Rating] Updating rating status in database');
      await updateRatingStatus(user.id);
    }

    setShowPrompt(false);
    
    // Try native review first
    if (platform.isTWA()) {
      console.log('[Rating] Running in TWA, attempting native review');
      const nativeReviewStarted = tryNativeReview();
      if (nativeReviewStarted) {
        console.log('[Rating] Native review flow started successfully');
        return;
      }
      console.log('[Rating] Native review failed, falling back to Play Store');
    } else {
      console.log('[Rating] Not in TWA environment');
    }

    // Fallback to Play Store
    try {
      console.log('[Rating] Trying market:// URL');
      window.location.href = `market://details?id=${packageName}`;
    } catch (e) {
      console.log('[Rating] market:// URL failed, falling back to web URL');
      window.location.href = `https://play.google.com/store/apps/details?id=${packageName}`;
    }
  };

  const handleLater = () => {
    setShowPrompt(false);
  };

  return (
    <Transition show={showPrompt} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[100]" onClose={handleLater}>
        <div className="min-h-full">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4 z-10">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-primary-50 rounded-xl mb-4">
                    <StarIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <Dialog.Title as="h3" className="text-xl font-semibold text-gray-900">
                    Enjoying TouchBase?
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-600">
                    Your rating helps us improve and create better features for everyone.
                  </p>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50/80 border-t border-gray-100/75">
                  <button
                    onClick={handleLater}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white/80 ring-1 ring-gray-200/75 rounded-xl hover:bg-gray-50/90 transition-all duration-200 shadow-sm"
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={handleRate}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all duration-200 shadow-sm"
                  >
                    Rate Now
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};