import React, { useState, lazy, Suspense } from 'react';
import QuickReminderModal from '../components/reminders/QuickReminderModal';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { contactsService } from '../services/contacts';
import { contentReportsService } from '../services/content-reports';
import { useStore } from '../stores/useStore';
import dayjs from 'dayjs';
import type { Reminder, Contact, Interaction, ImportantEvent } from '../lib/supabase/types';
import { CalendarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline/esm/index.js';
import ReminderCard from '../components/reminders/ReminderCard';

// Lazy load QuickInteraction
const QuickInteraction = lazy(() => import('../components/contacts/QuickInteraction'));

export const Reminders = () => {
  const navigate = useNavigate();
  const { isPremium, isOnTrial } = useStore();
  const { data: reminders } = useQuery<Reminder[]>({
    queryKey: ['reminders'],
    queryFn: () => contactsService.getReminders(),
    staleTime: 5 * 60 * 1000
  });

  // For free users, we'll only get the 15 most recent contacts
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts', isPremium, isOnTrial],
    queryFn: async () => {
      const allContacts = await contactsService.getContacts();
      // If user is not premium and not on trial, get 15 most recent contacts by created_at
      if (!isPremium && !isOnTrial) {
        return allContacts
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 15);
      }
      return allContacts;
    },
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
        alert('Thank you for reporting. We will review this suggestion.');
      } catch (error) {
        console.error('Error reporting content:', error);
        alert('Failed to report content. Please try again.');
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
  // Get visible contact IDs (all for premium/trial, only first 15 for free users)
  const visibleContactIds = contacts?.map(contact => contact.id) || [];

  // Filter reminders to only show those for visible contacts
  const dueTodayReminders = reminders?.filter((r: Reminder) => {
    const dueDate = dayjs(r.due_date);
    return dueDate.isSame(today, 'day') && visibleContactIds.includes(r.contact_id);
  }) || [];

  const upcomingReminders = reminders?.filter((r: Reminder) => {
    const dueDate = dayjs(r.due_date);
    return dueDate.isAfter(today) &&
           !dueDate.isSame(today, 'day') &&
           visibleContactIds.includes(r.contact_id);
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
   <React.Fragment>
      <div className="space-y-8">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2.5 -m-2.5 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-50/10 dark:hover:bg-gray-900/10 rounded-xl transition-all duration-200"
                  aria-label="Go back"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300 bg-clip-text text-transparent">Reminders</h1>
                  <p className="mt-1.5 text-[15px] text-gray-600/90 dark:text-gray-400">
                    See who's due for a check-in
                  </p>
                </div>
              </div>
            </div>
            {contacts && contacts.length > 0 && (
              <button
                onClick={() => setQuickReminder({ isOpen: true })}
                className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                <CalendarIcon className="h-5 w-5 mr-2" />
                Add Quick Reminder
              </button>
            )}
          </div>
        </div>

        {/* Show banner only to free users when total contacts exceed 15 */}
        {!isPremium && !isOnTrial && totalCount !== undefined && totalCount > 15 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              You're seeing reminders for your 15 most recent contacts. {' '}
              <Link to="/settings" className="font-medium text-amber-900 dark:text-amber-200 underline hover:no-underline">
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
              <div className="p-2.5 bg-yellow-50/90 dark:bg-yellow-900/30 rounded-xl">
                <CalendarIcon className="h-5 w-5 text-yellow-500/90 dark:text-yellow-400/90" />
              </div>
              <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white">Interactions Due Today</h2>
            </div>
            <div className="space-y-4">
              {dueTodayReminders.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No interactions due today!</p>
              ) : (
                dueTodayReminders.map((reminder) => {
                  const contact = contactsMap[reminder.contact_id];
                  const events = getImportantEventsForDate(reminder.contact_id, reminder.due_date);

                  return (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      contact={contact}
                      events={events}
                      isPremium={isPremium}
                      isOnTrial={isOnTrial}
                      onLogInteraction={({ contactId, contactName, type }) =>
                        setQuickInteraction({
                          isOpen: true,
                          contactId,
                          contactName,
                          type
                        })
                      }
                      onReportContent={handleReportContent}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2.5 bg-primary-50/90 dark:bg-primary-900/30 rounded-xl">
                <CalendarIcon className="h-5 w-5 text-primary-500/90 dark:text-primary-400/90" />
              </div>
              <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white">Upcoming Reminders</h2>
            </div>
            <div className="space-y-4">
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No upcoming reminders!</p>
              ) : (
                upcomingReminders.map((reminder) => {
                  const contact = contactsMap[reminder.contact_id];
                  const events = getImportantEventsForDate(reminder.contact_id, reminder.due_date);

                  return (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      contact={contact}
                      events={events}
                      isPremium={isPremium}
                      isOnTrial={isOnTrial}
                      onLogInteraction={({ contactId, contactName, type }) =>
                        setQuickInteraction({
                          isOpen: true,
                          contactId,
                          contactName,
                          type
                        })
                      }
                      onReportContent={handleReportContent}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      {quickInteraction && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-500/30 dark:bg-gray-900/50 flex items-center justify-center">
          <div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg p-6">Loading...</div>
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
        <Suspense fallback={<div className="fixed inset-0 bg-gray-500/30 dark:bg-gray-900/50 flex items-center justify-center">
          <div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg p-6">Loading...</div>
        </div>}>
          <QuickReminderModal
            isOpen={quickReminder.isOpen}
            onClose={() => setQuickReminder(null)}
          />
        </Suspense>
      )}
    </React.Fragment>
  );
};

export default Reminders;
