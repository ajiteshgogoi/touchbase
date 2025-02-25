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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">Reminders</h1>
                  <p className="mt-1.5 text-[15px] text-gray-600/90">
                    Track your upcoming reminders
                  </p>
                </div>
              </div>
            </div>
            {contacts && contacts.length > 0 && (
              <button
                onClick={() => setQuickReminder({ isOpen: true })}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <CalendarIcon className="h-5 w-5 mr-2" />
                Add Quick Reminder
              </button>
            )}
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
              <div className="p-2.5 bg-yellow-50/90 rounded-xl">
                <CalendarIcon className="h-5 w-5 text-yellow-500/90" />
              </div>
              <h2 className="text-xl font-[600] text-gray-900/90">Interactions Due Today</h2>
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
                      className={`bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-3 sm:p-4 hover:bg-white/70 hover:shadow-md transition-all duration-200 ${
                        reminder.name ? 'border-l-4 border-primary-500' : ''
                      }${
                        events.length > 0 ? ` ring-2 ${
                          events[0]?.type === 'birthday' ? 'ring-pink-300/90' :
                          events[0]?.type === 'anniversary' ? 'ring-rose-300/90' :
                          'ring-purple-300/90'
                        }` : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Link
                                to={`/contacts#${reminder.contact_id}`}
                                className="text-xl sm:text-2xl font-semibold text-primary-500 tracking-[-0.01em] block hover:text-primary-600"
                              >
                                {contact?.name || 'Unknown'}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Show important events badges */}
                                {events.length > 0 && events.map((event, idx) => (
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
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Due</span>
                              </div>
                              <div className="px-3 py-2 text-sm text-gray-700">
                                {contactsService.formatDueDate(reminder.due_date)}
                              </div>
                            </div>
                            {reminder.name && (
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-100">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</span>
                                </div>
                                <div className="px-3 py-2 text-sm text-gray-700">
                                  {reminder.name}
                                </div>
                              </div>
                            )}
                            {/* Only show suggestions for non-quick reminders */}
                            {!reminder.name && (
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-100">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestions</span>
                                </div>
                                <div className="px-3 py-2">
                                  {contact?.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">
                                        ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="group flex items-start gap-2">
                                      <span className="flex-1 text-sm text-gray-700 whitespace-pre-line">
                                        {contact?.ai_last_suggestion || 'No suggestions available'}
                                      </span>
                                      <button
                                        onClick={() => handleReportContent(
                                          reminder.contact_id,
                                          contact?.ai_last_suggestion || ''
                                        )}
                                        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                                        title="Report inappropriate suggestion"
                                      >
                                        <FlagIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-start gap-2 w-full">
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
                            </>
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
              <div className="p-2.5 bg-primary-50/90 rounded-xl">
                <CalendarIcon className="h-5 w-5 text-primary-500/90" />
              </div>
              <h2 className="text-xl font-[600] text-gray-900/90">Upcoming Reminders</h2>
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
                        reminder.name ? 'border-l-4 border-primary-500 ' : ''
                      }${
                        events.length > 0 ? `ring-2 ${
                          events[0]?.type === 'birthday' ? 'ring-pink-300' :
                          events[0]?.type === 'anniversary' ? 'ring-rose-300' :
                          'ring-purple-300'
                        }` : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Link
                                to={`/contacts#${reminder.contact_id}`}
                                className="text-xl sm:text-2xl font-semibold text-primary-500 tracking-[-0.01em] block hover:text-primary-600"
                              >
                                {contact?.name || 'Unknown'}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Show important events badges, but skip if this is a quick reminder */}
                                {!reminder.name && events.length > 0 && events.map((event, idx) => (
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
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Due</span>
                              </div>
                              <div className="px-3 py-2 text-sm text-gray-700">
                                {contactsService.formatDueDate(reminder.due_date)}
                              </div>
                            </div>
                            {reminder.name && (
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-100">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</span>
                                </div>
                                <div className="px-3 py-2 text-sm text-gray-700">
                                  {reminder.name}
                                </div>
                              </div>
                            )}
                            {/* Only show suggestions for non-quick reminders */}
                            {!reminder.name && (
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-100">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestions</span>
                                </div>
                                <div className="px-3 py-2">
                                  {contact?.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">
                                        ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="group flex items-start gap-2">
                                      <span className="flex-1 text-sm text-gray-700 whitespace-pre-line">
                                        {contact?.ai_last_suggestion || 'No suggestions available'}
                                      </span>
                                      <button
                                        onClick={() => handleReportContent(
                                          reminder.contact_id,
                                          contact?.ai_last_suggestion || ''
                                        )}
                                        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                                        title="Report inappropriate suggestion"
                                      >
                                        <FlagIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-start gap-2 w-full">
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
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm hover:shadow transition-all"
                              title="Complete quick reminder"
                            >
                              Complete
                            </button>
                          ) : (
                            <>
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