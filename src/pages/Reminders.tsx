import { useState, useEffect, lazy, Suspense } from 'react';
import QuickReminderModal from '../components/reminders/QuickReminderModal';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { contactsService } from '../services/contacts';
import { contentReportsService } from '../services/content-reports';
import { useStore } from '../stores/useStore';
import dayjs from 'dayjs';
import type { Reminder, Contact, Interaction, ImportantEvent } from '../lib/supabase/types';
import { CalendarIcon, ArrowLeftIcon, FlagIcon, CakeIcon, HeartIcon, StarIcon } from '@heroicons/react/24/outline/esm/index.js';
import { getEventTypeDisplay } from '../components/contacts/utils';

// Lazy load QuickInteraction
const QuickInteraction = lazy(() => import('../components/contacts/QuickInteraction'));

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

export const Reminders = () => {
  const navigate = useNavigate();
  const { isPremium, isOnTrial } = useStore();
  const { data: reminders } = useQuery<Reminder[]>({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders(),
    staleTime: 5 * 60 * 1000
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000
  });

  const { data: totalCount } = useQuery<number>({
    queryKey: ['contactsCount'],
    queryFn: contactsService.getTotalContactCount,
    enabled: !isPremium && !isOnTrial
  });

  const { data: importantEvents } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events'],
    queryFn: () => contactsService.getImportantEvents(),
    staleTime: 5 * 60 * 1000
  });

  const handleReportContent = async (contactId: string, content: string) => {
    if (confirm('Report this AI suggestion as inappropriate?')) {
      try {
        await contentReportsService.reportContent(content, {
          contactId,
          contentType: 'suggestion'
        });
      } catch (error) {
        console.error('Error reporting content:', error);
      }
    }
  };
const [quickInteraction, setQuickInteraction] = useState<{
  isOpen: boolean;
  contactId: string;
  contactName: string;
  type: Interaction['type'];
} | null>(null);

const [quickReminder, setQuickReminder] = useState<{
  isOpen: boolean;
} | null>(null);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const contactsMap = contacts?.reduce((acc, contact) => {
    acc[contact.id] = contact;
    return acc;
  }, {} as Record<string, Contact>) || {};

  const importantEventsMap: Record<string, ImportantEvent[]> = {};
  importantEvents?.forEach((event: ImportantEvent) => {
    if (event) {
      const contactId = event.contact_id as string;
      if (!importantEventsMap[contactId]) {
        importantEventsMap[contactId] = [];
      }
      importantEventsMap[contactId].push(event);
    }
  });

  const today = dayjs();
  const dueTodayReminders = reminders?.filter((r: Reminder) => {
    const dueDate = dayjs(r.due_date);
    return dueDate.isSame(today, 'day');
  }) || [];

  const upcomingReminders = reminders?.filter((r: Reminder) => {
    const dueDate = dayjs(r.due_date);
    return dueDate.isAfter(today) && !dueDate.isSame(today, 'day');
  }) || [];

  // Find important events for a contact that fall on the given date
  const getImportantEventsForDate = (contactId: string, date: string): ImportantEvent[] => {
    const events = importantEventsMap[contactId] || [];
    const reminderDate = dayjs(date);
    
    return events.filter(event => {
      const eventDate = dayjs(event.date);
      return eventDate.month() === reminderDate.month() && 
             eventDate.date() === reminderDate.date();
    });
  };

  return (
    <>
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -m-2 text-gray-400 hover:text-gray-500"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Track your upcoming reminders
                  </p>
                </div>
                {contacts && contacts.length > 0 && (
                  <button
                    onClick={() => setQuickReminder({ isOpen: true })}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm hover:shadow transition-all"
                  >
                    Add Quick Reminder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Show banner only to free users when total contacts exceed 15 */}
        {!isPremium && !isOnTrial && totalCount !== undefined && totalCount > 15 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              You're seeing reminders for your 15 most recent contacts. {' '}
              <Link to="/settings" className="font-medium text-amber-900 underline hover:no-underline">
                Upgrade to Premium
              </Link>{' '}
              to manage reminders for all {totalCount} of your contacts.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Due Today Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-yellow-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Interactions Due Today</h2>
            </div>
            <div className="space-y-4">
              {dueTodayReminders.length === 0 ? (
                <p className="text-sm text-gray-600">No interactions due today!</p>
              ) : (
                dueTodayReminders.map((reminder) => {
                  const contact = contactsMap[reminder.contact_id];
                  const events = getImportantEventsForDate(reminder.contact_id, reminder.due_date);

                  return (
                    <div
                      key={reminder.id}
                      className={`bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow ${
                        events.length > 0 ? `ring-2 ${
                          events[0]?.type === 'birthday' ? 'ring-pink-300' :
                          events[0]?.type === 'anniversary' ? 'ring-rose-300' :
                          'ring-purple-300'
                        }` : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                          <div className="space-y-2.5">
                            <div className="space-y-2 text-sm">
                              <Link
                                to={`/contacts#${reminder.contact_id}`}
                                className="text-lg font-semibold text-primary-500 block hover:text-primary-600"
                              >
                                {contact?.name || 'Unknown'}
                              </Link>
                              {/* Show important events badges */}
                              {events.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 -ml-2">
                                  {events.map((event, idx) => (
                                    <div key={idx} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                                      event.type === 'birthday' ? 'bg-pink-50 text-pink-500' :
                                      event.type === 'anniversary' ? 'bg-rose-50 text-rose-500' :
                                      'bg-purple-50 text-purple-500'
                                    }`}>
                                      {getEventIcon(event.type)}
                                      <span className="text-xs font-medium">
                                        {event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <span>
                                <span className="text-gray-700 font-medium">Contact due:</span>{' '}
                                <span className="text-gray-600">{contactsService.formatDueDate(reminder.due_date)}</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <span>
                                <span className="text-gray-700 font-medium">Suggestions:</span>{' '}
                                <span className="text-gray-600 whitespace-pre-line">
                                  {contact?.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                      <span className="text-sm text-gray-600">
                                        ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="group inline-flex items-start gap-1">
                                      <span className="flex-1">
                                        {contact?.ai_last_suggestion || 'No suggestions available'}
                                      </span>
                                      <button
                                        onClick={() => handleReportContent(
                                          reminder.contact_id,
                                          contact?.ai_last_suggestion || ''
                                        )}
                                        className="flex-shrink-0 p-1 mt-0.5 text-gray-300 hover:text-red-400 transition-colors"
                                        title="Report inappropriate suggestion"
                                      >
                                        <FlagIcon className="h-4 w-4" />
                                      </button>
                                    </span>
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-start gap-2 w-full">
                          <button
                            onClick={() => setQuickInteraction({
                              isOpen: true,
                              contactId: reminder.contact_id,
                              contactName: contact?.name || 'Unknown',
                              type: reminder.type
                            })}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm hover:shadow transition-all"
                            title="Log an interaction"
                          >
                            Log Interaction
                          </button>
                          {(isPremium || isOnTrial) ? (
                            <Link
                              to={`/contacts/${reminder.contact_id}/interactions`}
                              className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg shadow-sm hover:shadow transition-all"
                              title="View interaction history"
                            >
                              View History
                            </Link>
                          ) : (
                            <Link
                              to={`/contacts/${reminder.contact_id}/interactions`}
                              className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm hover:shadow transition-all"
                              title="Upgrade to view interaction history"
                            >
                              View History
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Reminders</h2>
            </div>
            <div className="space-y-4">
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-gray-600">No upcoming reminders!</p>
              ) : (
                upcomingReminders.map((reminder) => {
                  const contact = contactsMap[reminder.contact_id];
                  const events = getImportantEventsForDate(reminder.contact_id, reminder.due_date);

                  return (
                    <div
                      key={reminder.id}
                      className={`bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow ${
                        events.length > 0 ? `ring-2 ${
                          events[0]?.type === 'birthday' ? 'ring-pink-300' :
                          events[0]?.type === 'anniversary' ? 'ring-rose-300' :
                          'ring-purple-300'
                        }` : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                          <div className="space-y-2.5">
                            <div className="space-y-2 text-sm">
                              <Link
                                to={`/contacts#${reminder.contact_id}`}
                                className="text-lg font-semibold text-primary-500 block hover:text-primary-600"
                              >
                                {contact?.name || 'Unknown'}
                              </Link>
                              {/* Show important events badges */}
                              {events.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 -ml-2">
                                  {events.map((event, idx) => (
                                    <div key={idx} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                                      event.type === 'birthday' ? 'bg-pink-50 text-pink-500' :
                                      event.type === 'anniversary' ? 'bg-rose-50 text-rose-500' :
                                      'bg-purple-50 text-purple-500'
                                    }`}>
                                      {getEventIcon(event.type)}
                                      <span className="text-xs font-medium">
                                        {event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <span>
                                <span className="text-gray-700 font-medium">Contact due:</span>{' '}
                                <span className="text-gray-600">{contactsService.formatDueDate(reminder.due_date)}</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <span>
                                <span className="text-gray-700 font-medium">Suggestions:</span>{' '}
                                <span className="text-gray-600 whitespace-pre-line">
                                  {contact?.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                      <span className="text-sm text-gray-600">
                                        ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="group inline-flex items-start gap-1">
                                      <span className="flex-1">
                                        {contact?.ai_last_suggestion || 'No suggestions available'}
                                      </span>
                                      <button
                                        onClick={() => handleReportContent(
                                          reminder.contact_id,
                                          contact?.ai_last_suggestion || ''
                                        )}
                                        className="flex-shrink-0 p-1 mt-0.5 text-gray-300 hover:text-red-400 transition-colors"
                                        title="Report inappropriate suggestion"
                                      >
                                        <FlagIcon className="h-4 w-4" />
                                      </button>
                                    </span>
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-start gap-2 w-full">
                          <button
                            onClick={() => setQuickInteraction({
                              isOpen: true,
                              contactId: reminder.contact_id,
                              contactName: contact?.name || 'Unknown',
                              type: reminder.type
                            })}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm hover:shadow transition-all"
                            title="Log an interaction"
                          >
                            Log Interaction
                          </button>
                          {(isPremium || isOnTrial) ? (
                            <Link
                              to={`/contacts/${reminder.contact_id}/interactions`}
                              className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg shadow-sm hover:shadow transition-all"
                              title="View interaction history"
                            >
                              View History
                            </Link>
                          ) : (
                            <Link
                              to={`/contacts/${reminder.contact_id}/interactions`}
                              className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm hover:shadow transition-all"
                              title="Upgrade to view interaction history"
                            >
                              View History
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      {quickInteraction && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-500/30 flex items-center justify-center">
          <div className="animate-pulse bg-white rounded-lg p-6">Loading...</div>
        </div>}>
          <QuickInteraction
            isOpen={quickInteraction.isOpen}
            onClose={() => setQuickInteraction(null)}
            contactId={quickInteraction.contactId}
            contactName={quickInteraction.contactName}
            defaultType={quickInteraction.type}
          />
        </Suspense>
      )}
      {quickReminder && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-500/30 flex items-center justify-center">
          <div className="animate-pulse bg-white rounded-lg p-6">Loading...</div>
        </div>}>
          <QuickReminderModal
            isOpen={quickReminder.isOpen}
            onClose={() => setQuickReminder(null)}
          />
        </Suspense>
      )}
    </>
  );
};

export default Reminders;