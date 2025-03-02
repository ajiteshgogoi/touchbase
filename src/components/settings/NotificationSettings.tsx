import { useState } from 'react';
import type { NotificationSettings as NotificationSettingsType } from '../../types';
import { TIMEZONE_LIST } from '../../constants/timezones';
import { DeviceManagement } from './DeviceManagement';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  settings: NotificationSettingsType;
  onUpdate: (settings: Partial<NotificationSettingsType>) => Promise<void>;
  userId: string;
}

export const NotificationSettings = ({ settings, onUpdate, userId }: Props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Get user's timezone and ensure it's in the list
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Create final timezone list with user's timezone at the top if not already included
  const TIMEZONES = Array.from(new Set([userTimezone, ...TIMEZONE_LIST]))
    .sort((a, b) => {
      // Always keep user's timezone first
      if (a === userTimezone) return -1;
      if (b === userTimezone) return 1;
      // Sort others by continent/city
      const [contA = '', cityA = ''] = a.split('/');
      const [contB = '', cityB = ''] = b.split('/');
      return contA.localeCompare(contB) || cityA.localeCompare(cityB);
    });

  // Filter timezones based on search
  const filteredTimezones = TIMEZONES.filter((zone: string) =>
    zone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft hover:bg-white/70 transition-all duration-200 p-6">
      <h2 className="text-xl font-semibold text-primary-500 mb-6">
        Notification Preferences
      </h2>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="notifications-toggle" className="text-gray-900 font-medium">
              Notifications
            </label>
            <p className="text-sm text-gray-600/90 mt-1">
              Get notified about your daily interactions
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="notifications-toggle"
              type="checkbox"
              className="sr-only peer"
              checked={settings.notification_enabled}
              disabled={isRegistering}
              onChange={(e) => {
               const enabled = e.target.checked;
               setIsRegistering(true);
               onUpdate({
                 notification_enabled: enabled
               }).finally(() => {
                 setIsRegistering(false);
               });
             }}
            />
            <div className="relative w-11 h-6">
              <div className={`
               w-11 h-6 rounded-full
               ${settings.notification_enabled ? 'bg-primary-500' : 'bg-gray-200'}
               relative
               after:content-['']
               after:absolute
               after:top-[2px]
               after:left-[2px]
               after:bg-white
               after:rounded-full
               after:h-5
               after:w-5
               after:transition-all
               ${settings.notification_enabled ? 'after:translate-x-full' : ''}
               ${isRegistering ? 'opacity-0' : ''}
             `}></div>
              {isRegistering && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="scale-[0.6] origin-center">
                    <LoadingSpinner />
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Timezone Settings */}
        <div className="flex flex-col">
          <label htmlFor="timezone-select" className="text-gray-900 font-medium">
            Timezone
          </label>
          <p className="text-sm text-gray-600/90 mt-1">
            Set your timezone for timely reminders
          </p>
          <div className="mt-2 bg-white/40 backdrop-blur-sm rounded-xl border border-gray-100/30 overflow-hidden transition-colors hover:bg-white/50 [&_*:focus:not(:focus-visible)]:ring-0 [&_*]:focus:outline-none">
            <input
              type="text"
              className="block w-full border-0 border-b border-gray-200 py-2.5 px-3 text-gray-900 placeholder:text-gray-500 outline-none focus-visible:ring-1 focus-visible:ring-primary-400/20 focus-visible:border-primary-400/20 transition-all sm:text-sm"
              placeholder="Search timezone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search through timezone list"
            />
            <select
              id="timezone-select"
              className="block w-full border-0 py-2.5 px-3 text-gray-900 outline-none focus-visible:ring-1 focus-visible:ring-primary-400/15 focus-visible:border-primary-400/15 transition-all sm:text-sm appearance-none bg-transparent"
              value={settings.timezone}
              onChange={(e) => onUpdate({
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

       {/* Device Management */}
       <div>
         <DeviceManagement userId={userId} />
       </div>
      </div>
    </div>
  );
};