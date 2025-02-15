import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { contactsService } from '../services/contacts';
import { contentReportsService } from '../services/content-reports';
import { useStore } from '../stores/useStore';
import dayjs from 'dayjs';
import type { Reminder, Contact, Interaction } from '../lib/supabase/types';
import { CalendarIcon, ArrowLeftIcon, FlagIcon } from '@heroicons/react/24/outline';
import { QuickInteraction } from '../components/contacts/QuickInteraction';

export const Reminders = () => {
  const navigate = useNavigate();
  const { isPremium, isOnTrial } = useStore();
  const { data: reminders } = useQuery<Reminder[]>({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders()
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });

  const { data: totalCount } = useQuery<number>({
    queryKey: ['contactsCount'],
    queryFn: contactsService.getTotalContactCount,
    enabled: !isPremium && !isOnTrial
  });

  const handleReportContent = async (contactId: string, content: string) => {
    if (confirm('Report this AI suggestion as inappropriate?')) {
      try {
        await contentReportsService.reportContent(contactId, content);
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

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const contactsMap = contacts?.reduce((acc, contact) => {
    acc[contact.id] = contact;
    return acc;
  }, {} as Record<string, Contact>) || {};

  const today = dayjs();
  const dueTodayReminders = reminders?.filter((r: Reminder) => {
    const dueDate = dayjs(r.due_date);
    return dueDate.isSame(today, 'day');
  }) || [];

  const upcomingReminders = reminders?.filter((r: Reminder) => {
    const dueDate = dayjs(r.due_date);
    return dueDate.isAfter(today) && !dueDate.isSame(today, 'day');
  }) || [];

  return (
    <>
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -m-2 text-gray-400 hover:text-gray-500"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
              <p className="mt-1 text-sm text-gray-600">
                Track your upcoming reminders
              </p>
            </div>
          </div>
        </div>

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
              {!isPremium && !isOnTrial && contacts && totalCount && totalCount > contacts.length && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <p className="text-sm text-amber-800">
                    You're only seeing reminders for your first 15 contacts.{' '}
                    <Link to="/settings" className="font-medium text-amber-900 underline hover:no-underline">
                      Upgrade to Premium
                    </Link>{' '}
                    to manage reminders for all {totalCount} contacts.
                  </p>
                </div>
              )}
              {dueTodayReminders.length === 0 ? (
                <p className="text-sm text-gray-600">No interactions due today!</p>
              ) : (
                dueTodayReminders.map((reminder) => (
                  <div key={reminder.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0">
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap gap-4 text-sm">
                            <span className="text-lg font-semibold text-primary-500">{contactsMap[reminder.contact_id]?.name || 'Unknown'}</span>
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
                                {contactsMap[reminder.contact_id]?.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                  <div className="p-4 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">
                                      ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                    </span>
                                  </div>
                                ) : (
                                  <span className="group inline-flex items-start gap-1">
                                    <span className="flex-1">
                                      {contactsMap[reminder.contact_id]?.ai_last_suggestion || 'No suggestions available'}
                                    </span>
                                    <button
                                      onClick={() => handleReportContent(
                                        reminder.contact_id,
                                        contactsMap[reminder.contact_id]?.ai_last_suggestion || ''
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
                            contactName: contactsMap[reminder.contact_id]?.name || 'Unknown',
                            type: reminder.type
                          })}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg shadow-sm hover:shadow transition-all"
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
                ))
              )}
            </div>
          </div>

          {/* Upcoming Reminders Column */}
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
                upcomingReminders.map((reminder) => (
                  <div key={reminder.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0">
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap gap-4 text-sm">
                            <span className="text-lg font-semibold text-primary-500">{contactsMap[reminder.contact_id]?.name || 'Unknown'}</span>
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
                                {contactsMap[reminder.contact_id]?.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                                  <div className="p-4 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">
                                      ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                    </span>
                                  </div>
                                ) : (
                                  <span className="group inline-flex items-start gap-1">
                                    <span className="flex-1">
                                      {contactsMap[reminder.contact_id]?.ai_last_suggestion || 'No suggestions available'}
                                    </span>
                                    <button
                                      onClick={() => handleReportContent(
                                        reminder.contact_id,
                                        contactsMap[reminder.contact_id]?.ai_last_suggestion || ''
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
                            contactName: contactsMap[reminder.contact_id]?.name || 'Unknown',
                            type: reminder.type
                          })}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg shadow-sm hover:shadow transition-all"
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {quickInteraction && (
        <QuickInteraction
          isOpen={quickInteraction.isOpen}
          onClose={() => setQuickInteraction(null)}
          contactId={quickInteraction.contactId}
          contactName={quickInteraction.contactName}
          defaultType={quickInteraction.type}
        />
      )}
    </>
  );
};

export default Reminders;