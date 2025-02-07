import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { contactsService } from '../services/contacts';
import dayjs from 'dayjs';
import type { Reminder, Contact, Interaction } from '../lib/supabase/types';
import { CalendarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { QuickInteraction } from '../components/contacts/QuickInteraction';

export const Reminders = () => {
  const navigate = useNavigate();
  const { data: reminders } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders()
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts
  });

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
              {dueTodayReminders.length === 0 ? (
                <p className="text-sm text-gray-600">No interactions due today!</p>
              ) : (
                dueTodayReminders.map((reminder) => (
                  <div key={reminder.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0 flex-1">
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
                                  contactsMap[reminder.contact_id]?.ai_last_suggestion || 'No suggestions available'
                                )}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center sm:self-start">
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
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0 flex-1">
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
                                  contactsMap[reminder.contact_id]?.ai_last_suggestion || 'No suggestions available'
                                )}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center sm:self-start">
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