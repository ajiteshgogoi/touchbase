import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, FlagIcon, CakeIcon, HeartIcon, StarIcon, PhoneIcon } from '@heroicons/react/24/outline/esm/index.js';
import type { Reminder, Contact, ImportantEvent } from '../../lib/supabase/types';
import { getEventTypeDisplay, formatSocialMediaUrl } from '../contacts/utils';
import { contactsService } from '../../services/contacts';

const getEventIcon = (type: string) => {
  switch (type) {
    case 'birthday':
      return <CakeIcon className="h-4 w-4 text-pink-500" />;
    case 'anniversary':
      return <HeartIcon className="h-4 w-4 text-rose-500" />;
    case 'custom':
      return <StarIcon className="h-4 w-4 text-purple-500" />;
    default:
      return <CalendarIcon className="h-4 w-4 text-primary-500" />;
  }
};

interface ReminderCardProps {
  reminder: Reminder;
  contact: Contact | undefined;
  events: ImportantEvent[];
  isPremium: boolean;
  isOnTrial: boolean;
  onLogInteraction: (data: {
    contactId: string;
    contactName: string;
    type: "call" | "message" | "social" | "meeting";
  }) => void;
  onReportContent: (contactId: string, content: string) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  contact,
  events,
  isPremium,
  isOnTrial,
  onLogInteraction,
  onReportContent,
}) => {
  return (
    <div
      className={`bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md dark:hover:shadow-lg transition-all duration-200 ${
        reminder.name ? 'border-l-4 border-primary-500 dark:border-primary-400' : ''
      }${
        events.length > 0
          ? ` ring-2 ${
              events[0]?.type === 'birthday'
                ? 'ring-pink-300/90'
                : events[0]?.type === 'anniversary'
                ? 'ring-rose-300/90'
                : 'ring-purple-300/90'
            }`
          : ''
      }`}
    >
      <div className="flex flex-col">
        <div className="min-w-0 pb-4 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Link
                  to={`/contacts?search=${encodeURIComponent(contact?.name || '')}`}
                  className="text-xl sm:text-2xl font-semibold text-primary-500 dark:text-primary-400 tracking-[-0.01em] block hover:text-primary-600 dark:hover:text-primary-300"
                >
                  {contact?.name || 'Unknown'}
                </Link>
                {/* Inline status indicator */}
                <div className="flex items-center text-[13px] sm:text-sm text-gray-500/90 dark:text-gray-400">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 transition-colors ${
                      (contact?.missed_interactions || 0) > 3
                        ? 'bg-red-400/90'
                        : (contact?.missed_interactions || 0) > 2
                        ? 'bg-orange-400/90'
                        : (contact?.missed_interactions || 0) > 1
                        ? 'bg-yellow-400/90'
                        : (contact?.missed_interactions || 0) > 0
                        ? 'bg-lime-400/90'
                        : 'bg-green-400/90'
                    }`}
                    title={`${contact?.missed_interactions || 0} missed interactions`}
                  ></div>
                  {contact?.contact_frequency && (
                    <span className="font-[450]">
                      {contact.contact_frequency === 'every_three_days'
                        ? 'Bi-weekly'
                        : contact.contact_frequency.charAt(0).toUpperCase() +
                          contact.contact_frequency.slice(1).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Show important events badges */}
                {!reminder.name &&
                  events.length > 0 &&
                  events.map((event, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                        event.type === 'birthday'
                          ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-500 dark:text-pink-400'
                          : event.type === 'anniversary'
                          ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'
                          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400'
                      }`}
                    >
                      {getEventIcon(event.type)}
                      <span className="text-xs font-medium">
                        {event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}
                      </span>
                    </div>
                  ))}
                {/* Show quick reminder tag */}
                {reminder.name && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-500 dark:text-primary-400">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-xs font-medium">Quick Reminder</span>
                  </div>
                )}
              </div>
            </div>
            {/* Phone and Social Media section */}
            {(contact?.phone || (contact?.social_media_handle && contact?.social_media_platform)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-gray-600/90">
                {contact?.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center px-3 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                  >
                    <PhoneIcon className="h-4 w-4 mr-2 text-green-500/90 flex-shrink-0 group-hover:text-green-600/90 transition-colors" />
                    <span className="truncate leading-5 font-[450] text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {contact.phone}
                    </span>
                  </a>
                )}
                {contact?.social_media_handle && contact?.social_media_platform && (
                  <a
                    href={formatSocialMediaUrl(contact.social_media_handle, contact.social_media_platform)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                  >
                    {contact.social_media_platform === 'linkedin' ? (
                      <svg className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
                      </svg>
                    ) : contact.social_media_platform === 'twitter' ? (
                      <svg className="h-4 w-4 mr-2 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 mr-2 text-pink-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"></path>
                        <circle cx="17.5" cy="6.5" r="1.5"></circle>
                      </svg>
                    )}
                    <span className="truncate leading-5 font-[450] group-hover:text-primary-600 transition-colors">
                      @{contact.social_media_handle}
                    </span>
                  </a>
                )}
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact Due
                </span>
              </div>
              <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                {contactsService.formatDueDate(reminder.due_date)}
              </div>
            </div>
            {reminder.name && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </span>
                </div>
                <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{reminder.name}</div>
              </div>
            )}
            {/* Only show suggestions for non-quick reminders */}
            {!reminder.name && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Suggestions
                  </span>
                </div>
                <div className="px-3 py-2">
                  {contact?.ai_last_suggestion === 'Upgrade to premium to get personalised suggestions!' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        ✨{' '}
                        <Link to="/settings" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                          Upgrade to Premium
                        </Link>{' '}
                        to get personalised suggestions!
                      </span>
                    </div>
                  ) : (
                    <div className="group flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        {contact?.ai_last_suggestion || 'No suggestions available'}
                      </span>
                      {contact?.ai_last_suggestion && (
                        <button
                          onClick={() => onReportContent(reminder.contact_id, contact.ai_last_suggestion!)}
                          className="flex-shrink-0 p-1 text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-colors"
                          title="Report inappropriate suggestion"
                        >
                          <FlagIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-gray-100/50 dark:border-gray-800/50 bg-white/30 dark:bg-gray-900/30">
          <div className="flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
            {reminder.name ? (
              <button
                onClick={async () => {
                  if (confirm('Mark this quick reminder as complete?')) {
                    try {
                      await contactsService.completeQuickReminder(reminder.id);
                    } catch (error) {
                      console.error('Error completing quick reminder:', error);
                    }
                  }
                }}
                className="inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200"
                title="Complete quick reminder"
              >
                Complete
              </button>
            ) : (
              <>
                <button
                  onClick={() =>
                    onLogInteraction({
                      contactId: reminder.contact_id,
                      contactName: contact?.name || 'Unknown',
                      type: reminder.type,
                    })
                  }
                  className="inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200"
                  title="Log an interaction"
                >
                  Log Interaction
                </button>
                {(isPremium || isOnTrial) ? (
                  <Link
                    to={`/contacts/${reminder.contact_id}/interactions`}
                    className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200"
                    title="View interaction history"
                  >
                    View History
                  </Link>
                ) : (
                  <Link
                    to={`/contacts/${reminder.contact_id}/interactions`}
                    className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-gray-600 dark:text-gray-400 bg-gray-100/90 dark:bg-gray-800/60 hover:bg-gray-200/90 dark:hover:bg-gray-700/60 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-200"
                    title="Upgrade to view interaction history"
                  >
                    View History
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderCard;