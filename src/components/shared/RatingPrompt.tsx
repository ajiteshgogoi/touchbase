import { Fragment, useEffect, useState } from 'react';
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

  useEffect(() => {
    // Only show for authenticated users in TWA
    if (!platform.isTWA() || !user || !settings) return;

    // Don't show if already rated
    if (settings.has_rated_app) return;

    const now = Date.now();
    const installDate = new Date(settings.install_time || Date.now()).getTime();
    const lastPrompt = settings.last_rating_prompt ? new Date(settings.last_rating_prompt).getTime() : null;

    // First time check: Wait 10 days after installation
    if (!lastPrompt) {
      if (now - installDate >= INITIAL_WAIT_PERIOD) {
        setShowPrompt(true);
        updateLastPromptTime(user.id);
      }
      return;
    }

    // Subsequent checks: Show every 30 days if dismissed
    if (now - lastPrompt >= REPEAT_INTERVAL) {
      setShowPrompt(true);
      updateLastPromptTime(user.id);
    }
  }, [user, settings, updateLastPromptTime]);

  const handleRate = async () => {
    const packageName = 'app.touchbase.site.twa';
    
    // Update rating status in database
    if (user) {
      await updateRatingStatus(user.id);
    }

    setShowPrompt(false);
    
    try {
      window.location.href = `market://details?id=${packageName}`;
    } catch (e) {
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