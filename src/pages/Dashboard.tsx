import { useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '../services/contacts';
import { useStore } from '../stores/useStore';
import { 
  UserPlusIcon,
  ChartBarIcon
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
      {isOnTrial && trialDaysRemaining !== null && (
        <Suspense fallback={<LoadingFallback />}>
          <TrialBanner daysRemaining={trialDaysRemaining} />
        </Suspense>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.user_metadata?.name || 'Friend'}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here's what's happening with your relationships
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
          {!isPremium && (
            <Link
              to="/settings"
              className="flex-1 inline-flex items-center justify-center text-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-soft hover:shadow-lg transition-all"
            >
              <span className="inline-flex items-center justify-center">
                ✨ Upgrade to Premium
              </span>
            </Link>
          )}
          <Link
            to="/analytics"
            className={`flex-1 inline-flex items-center justify-center text-center px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm hover:shadow ${
              isPremium || isOnTrial
                ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            } transition-all`}
          >
            <span className="inline-flex items-center justify-center">
              <ChartBarIcon className="h-5 w-5 mr-2 flex-shrink-0" />
              Get Detailed Analytics
            </span>
          </Link>
          {canAddMore ? (
            <Link
              to="/contacts/new"
              state={{ from: '/' }}
              className="flex-1 inline-flex items-center justify-center text-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg transition-all"
            >
              <span className="inline-flex items-center justify-center">
                <UserPlusIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                Add Contact
              </span>
            </Link>
          ) : (
            <Link
              to="/settings"
              className="flex-1 inline-flex items-center justify-center text-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gray-400 hover:bg-gray-500 shadow-soft hover:shadow-lg transition-all"
            >
              <span className="inline-flex items-center justify-center">
                Upgrade to add more contacts
              </span>
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