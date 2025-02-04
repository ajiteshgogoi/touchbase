import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PayPalButtons } from '@paypal/react-paypal-js';
import toast from 'react-hot-toast';
import { useStore } from '../stores/useStore';
import { paymentService, SUBSCRIPTION_PLANS } from '../services/payment';
import { supabase } from '../lib/supabase/client';
import type { UserPreferences, Database } from '../lib/supabase/types';
import { CheckIcon } from '@heroicons/react/24/outline';

interface NotificationSettings {
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

type UserPreferencesUpsert = Database['public']['Tables']['user_preferences']['Insert'];

export const Settings = () => {
  const { user, isPremium } = useStore();
  const queryClient = useQueryClient();
  const [selectedPlan] = useState(isPremium ? 'premium' : 'free');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    notification_enabled: true,
    theme: 'light'
  });

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
            notification_enabled: true,
            theme: 'light'
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
        theme: preferences.theme
      });
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      if (!user?.id || !preferences?.id) throw new Error('No user ID or preferences ID');

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          id: preferences.id, // Include the ID for update
          user_id: user.id,
          notification_enabled: newSettings.notification_enabled,
          theme: newSettings.theme
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
          theme: preferences.theme
        });
      }
    }
  });

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    try {
      await paymentService.cancelSubscription();
      // Subscription cancelled, handle success
    } catch (error) {
      console.error('Cancel subscription error:', error);
    }
  };

  const handleNotificationChange = (newSettings: Partial<NotificationSettings>) => {
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account preferences and subscription
        </p>
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
                  <PayPalButtons
                    createSubscription={(_, actions) => {
                      return actions.subscription.create({
                        'plan_id': 'P-XXXXXXXXXXXX' // Replace with your PayPal plan ID
                      });
                    }}
                    onApprove={() => {
                      console.log('Subscription approved');
                      return Promise.resolve();
                    }}
                  />
                )}
                {plan.id === 'premium' && isPremium && (
                  <button
                    onClick={handleCancelSubscription}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel Subscription
                  </button>
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
                Enable or disable push notifications
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
        </div>
      </div>
    </div>
  );
};

export default Settings;