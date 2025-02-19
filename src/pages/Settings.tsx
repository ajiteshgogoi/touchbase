import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { useStore } from '../stores/useStore';
import { supabase } from '../lib/supabase/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { notificationService } from '../services/notifications';
import type { NotificationSettings } from '../types/settings';
import type { UserPreferences } from '../lib/supabase/types';
import type { Subscription } from '../types/subscription';

// Lazy load components
const NotificationSettings = lazy(() => import('../components/settings/NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const SubscriptionSettings = lazy(() => import('../components/settings/SubscriptionSettings').then(m => ({ default: m.SubscriptionSettings })));
const AISettings = lazy(() => import('../components/settings/AISettings').then(m => ({ default: m.AISettings })));
const FeedbackModal = lazy(() => import('../components/shared/FeedbackModal').then(m => ({ default: m.FeedbackModal })));

// Loading fallback component
const SectionLoader = () => (
  <div className="bg-white rounded-xl shadow-soft p-6 flex items-center justify-center min-h-[200px]">
    <LoadingSpinner />
  </div>
);

export const Settings = () => {
  const navigate = useNavigate();
  const { user, isPremium } = useStore();
  const queryClient = useQueryClient();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    notification_enabled: false,
    theme: 'light',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ai_suggestions_enabled: true
  });

  // Get subscription details
  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('valid_until, status, trial_end_date, plan_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!user?.id
  });

  // Get user preferences
  const { data: preferences } = useQuery({
    queryKey: ['preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create default
          const defaultPreferences = {
            user_id: user.id,
            notification_enabled: false,
            theme: 'light',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ai_suggestions_enabled: true
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
      return data as UserPreferences;
    },
    enabled: !!user?.id,
    retry: 1,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (preferences) {
      setNotificationSettings({
        notification_enabled: preferences.notification_enabled,
        theme: preferences.theme,
        timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        ai_suggestions_enabled: preferences.ai_suggestions_enabled
      });
    }
  }, [preferences]);

  useEffect(() => {
    // Initialize notification service when component mounts
    notificationService.initialize().catch(console.error);
    
    // Handle PayPal redirect and subscription activation
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get('subscription_id') || params.get('token');
    
    if (subscriptionId) {
      const activateSubscription = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No active session');

          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ baToken: subscriptionId })
          });

          if (!response.ok) {
            throw new Error('Failed to activate subscription');
          }

          toast.success('Subscription activated successfully');
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
        } catch (error) {
          console.error('Subscription activation error:', error);
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
      if (!user?.id || !preferences?.id) throw new Error('No user ID or preferences ID');

      // Handle notification permission
      if (newSettings.notification_enabled) {
        const hasPermission = await notificationService.checkPermission();
        if (!hasPermission) {
          throw new Error('Notification permission denied');
        }
        await notificationService.subscribeToPushNotifications(user.id);
      } else {
        await notificationService.unsubscribeFromPushNotifications(user.id);
      }

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          id: preferences.id,
          user_id: user.id,
          notification_enabled: newSettings.notification_enabled,
          theme: newSettings.theme,
          timezone: newSettings.timezone,
          ai_suggestions_enabled: newSettings.ai_suggestions_enabled
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
          ai_suggestions_enabled: preferences.ai_suggestions_enabled
        });
      }
    }
  });

  const handleNotificationChange = async (newSettings: Partial<NotificationSettings>) => {
    const updated = { ...notificationSettings, ...newSettings };
    setNotificationSettings(updated); // Optimistically update UI
    updatePreferencesMutation.mutate(updated);
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
            className="p-2 -m-2 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage your account preferences and subscription
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
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
            settings={notificationSettings}
            onUpdate={handleNotificationChange}
          />
        </Suspense>

        {/* AI Settings */}
        <Suspense fallback={<SectionLoader />}>
          <AISettings
            settings={notificationSettings}
            onUpdate={handleNotificationChange}
            isPremium={isPremium}
            subscription={subscription}
          />
        </Suspense>

        {/* Feedback Section */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Help Us Improve
          </h2>
          <div className="space-y-4">
            <p className="text-gray-600">
              We value your feedback to make TouchBase better. Share your thoughts and suggestions with us.
            </p>
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600"
            >
              Send Feedback
            </button>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Delete Account
          </h2>
          <div className="space-y-4">
            <p className="text-gray-600">
              Warning: This action cannot be undone. All your data will be permanently deleted.
            </p>
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
                if (!confirm('This will permanently delete all your contacts and interaction history. Are you absolutely sure?')) return;
                
                try {
                  await import('../services/delete-user').then(m => m.deleteUserService.deleteAccount());
                  toast.success('Account deleted successfully');
                  navigate('/');
                } catch (error) {
                  console.error('Delete account error:', error);
                  toast.error('Failed to delete account');
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 space-y-2 pt-1">
          <div>
            View our{' '}
            <a href="/terms" className="text-primary-500 hover:text-primary-600">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-primary-500 hover:text-primary-600">Privacy Policy</a>
          </div>
        </div>

        <Suspense fallback={null}>
          <FeedbackModal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default Settings;