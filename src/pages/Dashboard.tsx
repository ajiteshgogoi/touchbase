import { useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import {
  UserPlusIcon
} from '@heroicons/react/24/outline/esm/index.js';
import type { Contact } from '../lib/supabase/types';

// Lazy load components
const DashboardMetrics = lazy(() => import('../components/dashboard/DashboardMetrics'));
const RecentContacts = lazy(() => import('../components/dashboard/RecentContacts'));
const TrialBanner = lazy(() => import('../components/dashboard/TrialBanner'));
const ImportantEventsTimeline = lazy(() => import('../components/dashboard/ImportantEventsTimeline'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="animate-pulse">
    <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
  </div>
);

export const Dashboard = () => {
  const { user, isPremium, isOnTrial, trialDaysRemaining } = useStore();
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
  const { data: totalCount } = useQuery<number>({
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
      {!isPremium && isOnTrial && trialDaysRemaining !== null && (
        <Suspense fallback={<LoadingFallback />}>
          <TrialBanner daysRemaining={trialDaysRemaining} />
        </Suspense>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl font-[650] text-gray-900 tracking-[-0.01em]">
            Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400">{user?.user_metadata?.name?.split(' ')[0] || 'Friend'}</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-600/90 font-[450]">
            Here's what's happening with your relationships
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          {!isPremium && !isOnTrial && (
            <Link
              to="/settings"
              className="inline-flex items-center justify-center text-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <span className="inline-flex items-center justify-center">
                ✨ Upgrade to Premium
              </span>
            </Link>
          )}
          {canAddMore ? (
            <Link
              to="/contacts/new"
              state={{ from: '/' }}
              className="inline-flex items-center justify-center text-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              <UserPlusIcon className="h-5 w-5 mr-2 flex-shrink-0" />
              Add Contact
            </Link>
          ) : (
            <Link
              to="/settings"
              className="inline-flex items-center justify-center text-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-gray-400 hover:bg-gray-500 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              Upgrade to add more contacts
            </Link>
          )}
        </div>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <DashboardMetrics />
      </Suspense>

      {/* Show banner only to free users when total contacts exceed 15 */}
      {!isPremium && !isOnTrial && totalCount !== undefined && totalCount > 15 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            You're seeing your 15 most recent contacts. {' '}
            <Link to="/settings" className="font-medium text-amber-900 underline hover:no-underline">
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