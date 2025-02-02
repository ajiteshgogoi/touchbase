import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useStore } from '../stores/useStore';
import { paymentService, SUBSCRIPTION_PLANS } from '../services/payment';
import { supabase } from '../lib/supabase/client';
import type { UserPreferences } from '../lib/supabase/types';

interface NotificationSettings {
  notification_enabled: boolean;
  reminder_frequency: 'daily' | 'weekly' | 'monthly';
  theme: 'light' | 'dark' | 'system';
}

export const Settings = () => {
  const { user, isPremium, darkMode, setDarkMode } = useStore();
  const [selectedPlan, setSelectedPlan] = useState(isPremium ? 'premium' : 'free');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    notification_enabled: true,
    reminder_frequency: 'weekly',
    theme: darkMode ? 'dark' : 'light'
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as UserPreferences;
    }
  });

  useEffect(() => {
    if (preferences) {
      setNotificationSettings({
        notification_enabled: preferences.notification_enabled,
        reminder_frequency: preferences.reminder_frequency,
        theme: preferences.theme
      });
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      if (!user?.id) throw new Error('No user ID');
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...newPreferences,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
    }
  });

  const handleSubscribe = async () => {
    try {
      const subscriptionId = await paymentService.createPayPalSubscription(selectedPlan);
      // Subscription created, handle success
    } catch (error) {
      console.error('Subscription error:', error);
    }
  };

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
    setNotificationSettings(updated);
    updatePreferencesMutation.mutate(updated);
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    const newTheme = theme === 'system' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    
    setDarkMode(newTheme === 'dark');
    handleNotificationChange({ theme });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage your account preferences and subscription
        </p>
      </div>

      {/* Subscription Plans */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Subscription Plan
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`border rounded-lg p-6 ${
                selectedPlan === plan.id
                  ? 'border-primary-500 ring-2 ring-primary-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                </h3>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${plan.price}/mo
                </span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-600 dark:text-gray-400">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.id === 'premium' && !isPremium && (
                <PayPalButtons
                  createSubscription={(data, actions) => {
                    return actions.subscription.create({
                      'plan_id': 'P-XXXXXXXXXXXX' // Replace with your PayPal plan ID
                    });
                  }}
                  onApprove={(data, actions) => {
                    console.log('Subscription approved:', data);
                    return Promise.resolve();
                  }}
                />
              )}
              {plan.id === 'premium' && isPremium && (
                <button
                  onClick={handleCancelSubscription}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Notification Settings
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 dark:text-gray-300 font-medium">
                Notifications
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable or disable all notifications
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
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium">
              Reminder Frequency
            </label>
            <select
              value={notificationSettings.reminder_frequency}
              onChange={(e) => handleNotificationChange({
                reminder_frequency: e.target.value as NotificationSettings['reminder_frequency']
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium">
              Theme
            </label>
            <select
              value={notificationSettings.theme}
              onChange={(e) => handleThemeChange(e.target.value as NotificationSettings['theme'])}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;