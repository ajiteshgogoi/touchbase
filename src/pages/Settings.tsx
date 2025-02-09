import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import moment from 'moment-timezone';

const TIMEZONES = moment.tz.names();
import toast from 'react-hot-toast';
import { useStore } from '../stores/useStore';
import { paymentService, SUBSCRIPTION_PLANS } from '../services/payment';
import { supabase } from '../lib/supabase/client';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { notificationService } from '../services/notifications';
import type { UserPreferences, Database } from '../lib/supabase/types';
import { CheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface NotificationSettings {
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
}

type UserPreferencesUpsert = Database['public']['Tables']['user_preferences']['Insert'];

export const Settings = () => {
  const navigate = useNavigate();
  const { user, isPremium } = useStore();
  const queryClient = useQueryClient();
  const selectedPlan = isPremium ? 'premium' : 'free';
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Get subscription details
  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('valid_until, status')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isPremium
  });

  const handleResumeSubscription = async () => {
    if (!confirm('Would you like to resume your subscription?')) return;
    
    try {
      await paymentService.createSubscription('premium');
    } catch (error) {
      console.error('Resume subscription error:', error);
      toast.error('Failed to resume subscription');
    }
  };
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    notification_enabled: false,
    theme: 'light',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Filter timezones based on search
  const filteredTimezones = TIMEZONES.filter(zone =>
    zone.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          const defaultPreferences: UserPreferencesUpsert = {
            user_id: user.id,
            notification_enabled: false,
            theme: 'light',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
        timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
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
          timezone: newSettings.timezone
        }, {
          onConflict: 'id'
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
          timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        });
      }
    }
  });

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    if (!confirm('You will lose access to premium features at the end of your billing period. Are you absolutely sure?')) return;
    
    try {
      await paymentService.cancelSubscription();
      toast.success('Subscription cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (error) {
      console.error('Cancel subscription error:', error);
      toast.error('Failed to cancel subscription');
    }
  };

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

      {/* Subscription Plans */}
      <div className="bg-white rounded-xl shadow-soft p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Subscription Plan
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl p-6 transition-all ${
                selectedPlan === plan.id
                  ? 'border-2 border-primary-400 shadow-soft'
                  : 'border border-gray-200 hover:border-primary-200 shadow-sm hover:shadow-soft'
              }`}
            >
              {plan.id === 'premium' && (
                <span className="absolute -top-3 -right-3 bg-accent-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Recommended
                </span>
              )}
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {plan.id === 'free' ? 'Basic features' : 'All premium features'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600">/mo</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckIcon className="h-5 w-5 text-primary-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.id === 'premium' && !isPremium && (
                  <button
                    onClick={async () => {
                      try {
                        setIsSubscribing(true);
                        await paymentService.createSubscription('premium');
                        // Success toast will be shown after PayPal redirect and activation
                      } catch (error: any) {
                        console.error('Subscription error:', error);
                        toast.error(error?.message || 'Failed to create subscription');
                        setIsSubscribing(false);
                      }
                    }}
                    disabled={isSubscribing}
                    className="w-full px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubscribing ? (
                      <>
                        <LoadingSpinner />
                        <span>Redirecting to PayPal...</span>
                      </>
                    ) : (
                      'Subscribe Now'
                    )}
                  </button>
                )}
                {plan.id === 'premium' && isPremium && (
                  <div className="space-y-4">
                    {subscription?.valid_until && (
                      <div className="text-gray-600 text-sm bg-gray-50 rounded-lg p-4">
                        Your premium access is valid until{' '}
                        <span className="font-medium text-gray-900">
                          {moment(subscription.valid_until).tz(notificationSettings.timezone).format('MMMM D, YYYY')}
                        </span>
                        {subscription.status === 'canceled' && (
                          <span className="block mt-1 text-red-600">
                            Your subscription will not renew after this date
                          </span>
                        )}
                      </div>
                    )}
                    {subscription?.status === 'active' ? (
                      <button
                        onClick={handleCancelSubscription}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel Subscription
                      </button>
                    ) : subscription?.status === 'canceled' && (
                      <button
                        onClick={handleResumeSubscription}
                        className="w-full px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                      >
                        Resume Subscription
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-xl shadow-soft p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Notification Preferences
        </h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-900 font-medium">
                Notifications
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Get notified about your daily interactions
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationSettings.notification_enabled}
                onChange={(e) => handleNotificationChange({
                  notification_enabled: e.target.checked
                })}
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          {/* Timezone Settings */}
          <div className="flex flex-col">
            <label className="text-gray-900 font-medium">
              Timezone
            </label>
            <p className="text-sm text-gray-600 mt-1">
              Set your timezone for timely reminders
            </p>
            <input
              type="text"
              className="mt-2 block w-full rounded-t-md border border-gray-300 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              placeholder="Search timezone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="block w-full rounded-b-md border-t-0 border border-gray-300 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              value={notificationSettings.timezone}
              onChange={(e) => handleNotificationChange({
                timezone: e.target.value
              })}
              size={5}
            >
              {filteredTimezones.map((zone: string) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Account Deletion */}
      <div className="bg-white rounded-xl shadow-soft p-8">
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
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;