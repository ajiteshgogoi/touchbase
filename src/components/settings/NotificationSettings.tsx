import { useState } from 'react';
import type { NotificationSettings as NotificationSettingsType } from '../../types';
import { TIMEZONE_LIST } from '../../constants/timezones';

interface Props {
  settings: NotificationSettingsType;
  onUpdate: (settings: Partial<NotificationSettingsType>) => void;
}

export const NotificationSettings = ({ settings, onUpdate }: Props) => {
  const [searchTerm, setSearchTerm] = useState('');

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
              onChange={(e) => onUpdate({
                notification_enabled: e.target.checked
              })}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
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
          <div className="mt-2 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100/50 overflow-hidden">
            <input
              type="text"
              className="block w-full border-0 border-b border-gray-200 py-2.5 px-3 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
              placeholder="Search timezone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search through timezone list"
            />
            <select
              id="timezone-select"
              className="block w-full border-0 py-2.5 px-3 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
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
      </div>
    </div>
  );
};