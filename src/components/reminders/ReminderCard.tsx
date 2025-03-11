import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, FlagIcon, CakeIcon, HeartIcon, StarIcon } from '@heroicons/react/24/outline/esm/index.js';
import type { Reminder, Contact, ImportantEvent } from '../../lib/supabase/types';
import { getEventTypeDisplay } from '../contacts/utils';
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
      className={`bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft hover:bg-white/70 hover:shadow-md transition-all duration-200 ${
        reminder.name ? 'border-l-4 border-primary-500' : ''
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
                  to={`/contacts#${reminder.contact_id}`}
                  className="text-xl sm:text-2xl font-semibold text-primary-500 tracking-[-0.01em] block hover:text-primary-600"
                >
                  {contact?.name || 'Unknown'}
                </Link>
                {/* Inline status indicator */}
                <div className="flex items-center text-[13px] sm:text-sm text-gray-500/90">
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
                        ? 'Bi-weekly contact'
                        : contact.contact_frequency.charAt(0).toUpperCase() +
                          contact.contact_frequency.slice(1).replace(/_/g, ' ') +
                          ' contact'}
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
                          ? 'bg-pink-50 text-pink-500'
                          : event.type === 'anniversary'
                          ? 'bg-rose-50 text-rose-500'
                          : 'bg-purple-50 text-purple-500'
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
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-500">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-xs font-medium">Quick Reminder</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-100">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Due
                </span>
              </div>
              <div className="px-3 py-2 text-sm text-gray-700">
                {contactsService.formatDueDate(reminder.due_date)}
              </div>
            </div>
            {reminder.name && (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </span>
                </div>
                <div className="px-3 py-2 text-sm text-gray-700">{reminder.name}</div>
              </div>
            )}
            {/* Only show suggestions for non-quick reminders */}
            {!reminder.name && (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suggestions
                  </span>
                </div>
                <div className="px-3 py-2">
                  {contact?.ai_last_suggestion === 'Upgrade to premium to get personalised suggestions!' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        ✨{' '}
                        <Link to="/settings" className="text-primary-600 hover:text-primary-500">
                          Upgrade to Premium
                        </Link>{' '}
                        to get personalised suggestions!
                      </span>
                    </div>
                  ) : (
                    <div className="group flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-700 whitespace-pre-line">
                        {contact?.ai_last_suggestion || 'No suggestions available'}
                      </span>
                      {contact?.ai_last_suggestion && (
                        <button
                          onClick={() => onReportContent(reminder.contact_id, contact.ai_last_suggestion!)}
                          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
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
        <div className="p-4 border-t border-gray-100/50 bg-white/30">
          <div className="flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 backdrop-blur-sm">
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
                className="inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
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
                  className="inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                  title="Log an interaction"
                >
                  Log Interaction
                </button>
                {(isPremium || isOnTrial) ? (
                  <Link
                    to={`/contacts/${reminder.contact_id}/interactions`}
                    className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-primary-600 bg-primary-50/90 hover:bg-primary-100/90 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                    title="View interaction history"
                  >
                    View History
                  </Link>
                ) : (
                  <Link
                    to={`/contacts/${reminder.contact_id}/interactions`}
                    className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
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