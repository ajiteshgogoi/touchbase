import { useState } from 'react';
import { notificationService } from '../../../services/notifications';
import { BellIcon, BellSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface OnboardingStep2Props {
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingStep2 = ({ onNext, onBack }: OnboardingStep2Props) => {
  const [isEnabling, setIsEnabling] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [error, setError] = useState('');

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    setError('');

    try {
      await notificationService.initialize();
      const hasPermission = await notificationService.checkPermission();
      setNotificationsEnabled(hasPermission);
      
      if (hasPermission) {
        // Delay to show success state before moving to next step
        setTimeout(onNext, 1500);
      } else {
        setError('Please allow notifications to stay connected with your contacts.');
      }
    } catch (err) {
      setError('Unable to enable notifications. You can enable them later in settings.');
      console.error('Error enabling notifications:', err);
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-primary-600
          to-primary-400 bg-clip-text text-transparent leading-relaxed pb-1">
          Stay Connected
        </h2>
        <p className="text-base text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
          Remember to connect with your contacts regularly
        </p>
      </div>

      {/* Notification Features */}
      <div className="space-y-4">
        <div className="p-8 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-100/50 dark:border-gray-700/50 shadow-soft dark:shadow-soft-dark space-y-4">
          <div className="flex items-center gap-4">
            {notificationsEnabled ? (
              <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <BellIcon className="w-6 h-6 text-primary-500 dark:text-primary-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                <BellSlashIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Smart Notifications</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Get gentle nudges when it's time to reach out</p>
            </div>
          </div>
        </div>

        {notificationsEnabled && (
          <div className="p-6 bg-primary-50/50 dark:bg-primary-900/20 rounded-xl border border-primary-100/50 dark:border-primary-800/50 shadow-soft dark:shadow-soft-dark">
            <div className="flex items-center justify-center gap-3">
              <CheckCircleIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
              <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                Notifications enabled successfully!
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={handleEnableNotifications}
          disabled={isEnabling || notificationsEnabled}
          className="w-full px-6 py-3 text-white bg-primary-500 dark:bg-primary-600 rounded-xl font-medium
            hover:bg-primary-600 dark:hover:bg-primary-700 transition-all duration-200 shadow-sm dark:shadow-soft-dark hover:shadow-md
            active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
            disabled:hover:bg-primary-500 dark:disabled:hover:bg-primary-600 disabled:hover:shadow-sm disabled:active:scale-100"
        >
          {isEnabling ? 'Enabling...' : 
           notificationsEnabled ? 'Notifications Enabled ✓' : 
           'Enable Notifications'}
        </button>
        <button
          onClick={onNext}
          className="w-full px-6 py-3 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl font-medium
            hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        >
          Do This Later
        </button>
        <button
          onClick={onBack}
          className="w-full px-6 py-3 text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl
            font-medium transition-colors duration-200"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default OnboardingStep2;