import { useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';
import { RatingPrompt } from '../components/shared/RatingPrompt';
import {
  UserPlusIcon
} from '@heroicons/react/24/outline/esm/index.js';
import type { Contact } from '../lib/supabase/types';
import type { NotificationSettings } from '../types/settings';

// Lazy load components
const DashboardMetrics = lazy(() => import('../components/dashboard/DashboardMetrics'));
const RecentContacts = lazy(() => import('../components/dashboard/RecentContacts'));
const TrialBanner = lazy(() => import('../components/dashboard/TrialBanner'));
const ImportantEventsTimeline = lazy(() => import('../components/dashboard/ImportantEventsTimeline'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="animate-pulse">
    <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4"></div>
  </div>
);

export const Dashboard = () => {
  const { user, isPremium, isOnTrial, trialDaysRemaining, preferences } = useStore();
  
  // Convert UserPreferences to NotificationSettings
  const settings: NotificationSettings | undefined = preferences ? {
    notification_enabled: preferences.notification_enabled,
    theme: preferences.theme,
    timezone: preferences.timezone,
    ai_suggestions_enabled: preferences.ai_suggestions_enabled,
    has_rated_app: preferences.has_rated_app,
    last_rating_prompt: preferences.last_rating_prompt || undefined,
    install_time: preferences.install_time
  } : undefined;
  const { shouldShow: showOnboarding, markCompleted: markOnboardingCompleted } = useOnboarding();
  const { data: contacts, isLoading: isLoadingContacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
  const { data: totalCount, isLoading: isLoadingTotal } = useQuery<number>({
    queryKey: ['contactsCount'],
    queryFn: contactsService.getTotalContactCount,
    enabled: !isPremium && !isOnTrial
  });
  const contactLimit = isPremium ? Infinity : (isOnTrial ? Infinity : 15);
  const canAddMore = (contacts?.length || 0) < contactLimit;

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="space-y-8">
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={markOnboardingCompleted}
      />
      <RatingPrompt user={user} settings={settings} />
      {!isPremium && isOnTrial && trialDaysRemaining !== null && (
        <Suspense fallback={<LoadingFallback />}>
          <TrialBanner daysRemaining={trialDaysRemaining} />
        </Suspense>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl font-[650] text-gray-900 dark:text-white tracking-[-0.01em]">
            Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300">{user?.user_metadata?.name?.split(' ')[0] || 'Friend'}</span>
          </h1>
          <p className="mt-2 text-[15px] text-gray-600/90 dark:text-gray-400">
            Here's what's happening with your relationships
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          {!isPremium && !isOnTrial ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/settings"
                className="inline-flex items-center justify-center text-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-600 dark:to-indigo-600 hover:from-purple-600 hover:to-indigo-600 dark:hover:from-purple-700 dark:hover:to-indigo-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <span className="inline-flex items-center justify-center">
                  ✨ Upgrade to Premium
                </span>
              </Link>
              <Link
                to={canAddMore ? "/contacts/new" : "/settings"}
                state={{ from: '/' }}
                className={`inline-flex items-center justify-center text-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white ${
                  isLoadingContacts || isLoadingTotal ? 'text-gray-400 bg-gray-100 dark:text-gray-600 dark:bg-gray-800 cursor-not-allowed' :
                  canAddMore ? 'bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700' :
                  'bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-700'
                } shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200`}
              >
                <span className="min-w-[130px] inline-flex items-center justify-center">
                  <span className="min-w-[130px] inline-flex items-center justify-center">
                    {isLoadingContacts || isLoadingTotal ? (
                      <span className="text-center">Loading...</span>
                    ) : canAddMore ? (
                      <span className="inline-flex items-center">
                        <UserPlusIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                        Add Contact
                      </span>
                    ) : (
                      <span className="text-center">Upgrade to add more contacts</span>
                    )}
                  </span>
                </span>
              </Link>
            </div>
          ) : (
            <Link
              to="/contacts/new"
              state={{ from: '/' }}
              className="inline-flex items-center justify-center text-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <UserPlusIcon className="h-5 w-5 mr-2 flex-shrink-0" />
              Add Contact
            </Link>
          )}
        </div>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <DashboardMetrics />
      </Suspense>

      {/* Show banner only to free users when total contacts exceed 15 */}
      {!isPremium && !isOnTrial && totalCount !== undefined && totalCount > 15 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You're seeing your 15 most recent contacts. {' '}
            <Link to="/settings" className="font-medium text-amber-900 dark:text-amber-200 underline hover:no-underline">
              Upgrade to Premium
            </Link>{' '}
            to manage all {totalCount} of your contacts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingFallback />}>
          <ImportantEventsTimeline />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <RecentContacts />
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;