import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import { useStore } from '../stores/useStore';
import { supabase } from '../lib/supabase/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { notificationService } from '../services/notifications';
import { platform } from '../utils/platform';
import type { NotificationSettings } from '../types/settings';
import type { UserPreferences } from '../lib/supabase/types';
import type { Subscription } from '../types/subscription';

// Lazy load components
const NotificationSettings = lazy(() => import('../components/settings/NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const SubscriptionSettings = lazy(() => import('../components/settings/SubscriptionSettings').then(m => ({ default: m.SubscriptionSettings })));
const ThemeSettings = lazy(() => import('../components/settings/ThemeSettings').then(m => ({ default: m.ThemeSettings })));
const AISettings = lazy(() => import('../components/settings/AISettings').then(m => ({ default: m.AISettings })));
const FeedbackModal = lazy(() => import('../components/shared/FeedbackModal').then(m => ({ default: m.FeedbackModal })));
const DataExportModal = lazy(() => import('../components/settings/DataExportModal').then(m => ({ default: m.DataExportModal })));

// Loading fallback component
const SectionLoader = () => (
  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-soft dark:shadow-soft-dark p-6 flex items-center justify-center min-h-[200px]">
    <LoadingSpinner />
  </div>
);

export const Settings = () => {
  const navigate = useNavigate();
  const { user, isPremium } = useStore();
  const queryClient = useQueryClient();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    notification_enabled: false,
    theme: localStorage.getItem('theme') as 'system' | 'light' | 'dark' || 'system',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ai_suggestions_enabled: false,
    has_rated_app: false
  });

  // Ensure settings always have defined values
  const safeSettings = {
    notification_enabled: notificationSettings.notification_enabled ?? false,
    theme: notificationSettings.theme ?? 'system',
    timezone: notificationSettings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ai_suggestions_enabled: notificationSettings.ai_suggestions_enabled ?? false,
    has_rated_app: notificationSettings.has_rated_app ?? false
  };

  // Get subscription details
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id] as const,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('valid_until, status, trial_end_date, subscription_plan_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      const subscriptionData = data as unknown as Subscription;
      
      // Sync with store
      const now = new Date();
      const isPremium = Boolean(
        (subscriptionData.subscription_plan_id === 'premium' || subscriptionData.subscription_plan_id === 'premium-annual') &&
        subscriptionData.valid_until &&
        new Date(subscriptionData.valid_until) > now
      );
      
      useStore.getState().setIsPremium(isPremium);
      
      const isOnTrial = subscriptionData.trial_end_date ? new Date(subscriptionData.trial_end_date) > now : false;
      const trialDaysRemaining = subscriptionData.trial_end_date
        ? Math.ceil((new Date(subscriptionData.trial_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      useStore.getState().setTrialStatus(isOnTrial, trialDaysRemaining);
      
      return subscriptionData;
    },
    enabled: !!user?.id
  });

  // Get user preferences
  const { data: preferences, isLoading: isPreferencesLoading, refetch } = useQuery<UserPreferences>({
    queryKey: ['preferences', user?.id],
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache the data
    queryFn: async () => {
      console.log('[Preferences] Starting preferences fetch');
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select(`
          id,
          user_id,
          notification_enabled,
          theme,
          timezone,
          ai_suggestions_enabled,
          has_rated_app,
          last_rating_prompt,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .single();

      console.log('[Preferences] Raw DB response:', data);
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create default
          const defaultPreferences = {
            user_id: user.id,
            notification_enabled: false,
            theme: 'system',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ai_suggestions_enabled: true,
            has_rated_app: false
          };

          const { data: newPrefs, error: insertError } = await supabase
            .from('user_preferences')
            .insert(defaultPreferences)
            .select()
            .single();

          if (insertError) throw insertError;
          return newPrefs;
        }
        throw error;
      }
      if (!data) {
        console.log('[Preferences] No data returned from DB');
        return null;
      }
      
      const typedData = data as UserPreferences;
      console.log('[Preferences] Typed data:', typedData);
      return typedData;
    },
    enabled: !!user?.id,
    retry: 1
  });

  // Update notification settings whenever preferences change or are initially loaded
  useEffect(() => {
    if (preferences && typeof preferences === 'object') {
      // Ensure we have valid values
      const newSettings = {
        notification_enabled: preferences.notification_enabled ?? false,
        theme: preferences.theme || 'system',
        timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        ai_suggestions_enabled: preferences.ai_suggestions_enabled ?? false,
        has_rated_app: preferences.has_rated_app ?? false
      };
      
      console.log('Updating notification settings from preferences:', newSettings);
      setNotificationSettings(newSettings);
      
      // Check browser permission asynchronously
      const checkNotificationPermission = async () => {
        try {
          if (Notification.permission === 'denied' && preferences.notification_enabled) {
            updatePreferencesMutation.mutate({
              ...newSettings,
              notification_enabled: false
            });
          }
        } catch (error) {
          console.error('Error checking notification permission:', error);
        }
      };
      
      checkNotificationPermission();
    }
  }, [preferences]);

  useEffect(() => {
    // Force a fresh fetch when component mounts
    refetch();
    // Initialize notification service when component mounts
    notificationService.initialize().catch(console.error);
    
    // Handle PayPal redirect and subscription activation
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get('subscription_id') || params.get('token');
    const planId = params.get('plan') || 'premium'; // Get selected plan from URL
    
    if (subscriptionId) {
      const activateSubscription = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No active session');

          // Optimistically update the subscription in the cache
          const optimisticSubscription: Subscription = {
            valid_until: new Date(Date.now() + (planId === 'premium-annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            trial_end_date: null,
            subscription_plan_id: planId
          };

          // Update React Query cache
          queryClient.setQueryData(['subscription', user?.id], optimisticSubscription);
          
          // Update Zustand store
          useStore.getState().setIsPremium(true);

          const response = await fetch(`https://api.touchbase.site/functions/v1/activate-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'X-Client-Secret': import.meta.env.VITE_CLIENT_SECRET
            },
            body: JSON.stringify({ baToken: subscriptionId })
          });

          if (!response.ok) {
            throw new Error('Failed to activate subscription');
          }

          toast.success('Subscription activated successfully');
          
          // Refetch to get the actual subscription data
          await queryClient.invalidateQueries({ queryKey: ['subscription'] });
        } catch (error) {
          console.error('Subscription activation error:', error);
          
          // Revert optimistic updates on error
          queryClient.setQueryData(['subscription', user?.id], subscription); // Revert to previous state
          useStore.getState().setIsPremium(isPremium); // Revert to previous state
          
          toast.error('Failed to activate subscription');
        }
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      };

      activateSubscription();
    } else if (params.get('subscription') === 'cancelled') {
      toast.error('Subscription process cancelled');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      if (!user?.id) throw new Error('No user ID available');

      // If we don't have preferences, get or create them
      let prefsId = preferences?.id;
      if (!prefsId) {
        const { data: existingPrefs, error: fetchError } = await supabase
          .from('user_preferences')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (!existingPrefs) {
          // Create new preferences
          const { data: newPrefs, error: insertError } = await supabase
            .from('user_preferences')
            .insert({
              user_id: user.id,
              notification_enabled: newSettings.notification_enabled,
              theme: newSettings.theme,
              timezone: newSettings.timezone,
              ai_suggestions_enabled: newSettings.ai_suggestions_enabled,
              has_rated_app: newSettings.has_rated_app
            })
            .select()
            .single();

          if (insertError) throw insertError;
          prefsId = newPrefs.id;
        } else {
          prefsId = existingPrefs.id;
        }
      }

      // Only check notification permission when enabling global notifications
      // AND there's at least one device with enabled=true
      if (newSettings.notification_enabled) {
        // Check if any devices have notifications enabled
        const { data: devices } = await supabase
          .from('push_subscriptions')
          .select('enabled')
          .eq('user_id', user.id);
        
        const hasEnabledDevices = devices?.some(device => device.enabled) ?? false;
        
        // Only check permission if there are enabled devices
        if (hasEnabledDevices) {
          const hasPermission = await notificationService.checkPermission(true);
          if (!hasPermission) {
            throw new Error('Notification permission denied');
          }
        }

        // If there are no enabled devices, just update the global setting
        // without checking browser permissions
      }
      
      // Get device info if available
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      
      // Check if device already exists in database
      let deviceExists = false;
      if (deviceId) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('device_id')
          .match({ user_id: user.id, device_id: deviceId })
          .maybeSingle();
        deviceExists = !!data;
      }

      // Only attempt device registration when:
      // 1. Notifications are being enabled globally AND
      // 2. Either no device ID exists OR device isn't registered
      if (newSettings.notification_enabled && (!deviceId || !deviceExists)) {
        await notificationService.subscribeToPushNotifications(user.id, true, true);
      }

      // When toggling global notifications off, leave device registrations intact
      // Device-specific toggles will be handled by DeviceManagement component

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          id: prefsId,
          user_id: user.id,
          notification_enabled: newSettings.notification_enabled,
          theme: newSettings.theme,
          timezone: newSettings.timezone,
          ai_suggestions_enabled: newSettings.ai_suggestions_enabled,
          has_rated_app: newSettings.has_rated_app
        });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences', user?.id] });
      toast.success('Settings updated');
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast.error(error?.message || 'Failed to update settings');
      // Revert the local state on error
      if (preferences) {
        setNotificationSettings({
          notification_enabled: preferences.notification_enabled,
          theme: preferences.theme,
          timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          ai_suggestions_enabled: preferences.ai_suggestions_enabled,
          has_rated_app: preferences.has_rated_app
        });
      }
    }
  });

  const handleNotificationChange = async (newSettings: Partial<NotificationSettings>) => {
    const updated = { ...notificationSettings, ...newSettings };
    setNotificationSettings(updated); // Optimistically update UI
    await updatePreferencesMutation.mutateAsync(updated);
    // After successful mutation, invalidate devices query
    queryClient.invalidateQueries({ queryKey: ['devices'] });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 -m-2.5 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-50/10 dark:hover:bg-gray-900/10 rounded-xl transition-all duration-200"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300 bg-clip-text text-transparent leading-tight pb-1">Settings</h1>
            <p className="mt-1 text-[15px] text-gray-600/90 dark:text-gray-400">
              Manage your subscription and account preferences
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isPreferencesLoading ? (
          <div className="space-y-6">
            <SectionLoader />
            <SectionLoader />
            <SectionLoader />
          </div>
        ) : (
          <>
            {/* Subscription Settings */}
            <Suspense fallback={<SectionLoader />}>
              <SubscriptionSettings
                isPremium={isPremium}
                subscription={subscription}
                timezone={notificationSettings.timezone}
              />
            </Suspense>

            {/* Notification Settings */}
            <Suspense fallback={<SectionLoader />}>
              <NotificationSettings
                settings={safeSettings}
                onUpdate={handleNotificationChange}
                userId={user.id}
              />
            </Suspense>

            {/* Theme Settings */}
            <Suspense fallback={<SectionLoader />}>
              <ThemeSettings
                settings={safeSettings}
                onUpdate={handleNotificationChange}
              />
            </Suspense>

            {/* AI Settings */}
            <Suspense fallback={<SectionLoader />}>
              <AISettings
                settings={safeSettings}
                onUpdate={handleNotificationChange}
                isPremium={isPremium}
                subscription={subscription}
              />
            </Suspense>
          </>
        )}

        {/* Export Data Section */}
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary-500 dark:text-primary-400">
              Export Your Data
            </h2>
            {!(isPremium || useStore.getState().isOnTrial) && (
              <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
                Premium Only
              </span>
            )}
          </div>
          <div className="space-y-4">
            <p className={isPremium ? "text-gray-600/90 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}>
              Download all your contacts, interactions, events and reminders in CSV format.
            </p>
            <button
              onClick={() => (isPremium || useStore.getState().isOnTrial) && setIsExportModalOpen(true)}
              disabled={!(isPremium || useStore.getState().isOnTrial)}
              className={`inline-flex items-center justify-center px-5 py-3 rounded-xl text-[15px] font-[500] transition-all duration-200 ${
                isPremium || useStore.getState().isOnTrial
                  ? 'text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
              }`}
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Export Data
            </button>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200 p-6">
          <h2 className="text-xl font-semibold text-primary-500 dark:text-primary-400 mb-6">
            Help Us Improve
          </h2>
          <div className="space-y-4">
            <p className="text-gray-600/90 dark:text-gray-400">
              We value your feedback to make TouchBase better. Share your thoughts and suggestions with us.
            </p>
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg transition-all duration-200"
            >
              Send Feedback
            </button>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200 p-6">
          <h2 className="text-xl font-semibold text-gray-600/90 dark:text-gray-400 mb-6">
            Delete Account
          </h2>
          <div className="space-y-4">
            <p className="text-gray-500/90 dark:text-gray-400">
              Warning: This action cannot be undone. All your data will be permanently deleted.
            </p>
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
                if (!confirm('This will permanently delete all your contacts and interaction history. Are you absolutely sure?')) return;
                
                setIsDeleting(true);
                try {
                  await import('../services/delete-user').then(m => m.deleteUserService.deleteAccount());
                  toast.success('Account deleted successfully');
                  navigate('/');
                } catch (error) {
                  console.error('Delete account error:', error);
                  toast.error('Failed to delete account');
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-[15px] font-[500] text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-100/50 dark:border-red-900/50 shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              <span className="min-w-[108px] inline-block text-center">
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 space-y-2 pt-1">
          <div>
            View our{' '}
            <a href="/terms" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">Privacy Policy</a>
          </div>
          <div>
            Need help? Email us at{' '}
            <a href="mailto:help@touchbase.site" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">
              help@touchbase.site
            </a>
          </div>
        </div>

        <Suspense fallback={null}>
          <FeedbackModal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
          />
        </Suspense>

        <Suspense fallback={null}>
          <DataExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default Settings;