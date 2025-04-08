import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useStore } from '../stores/useStore';
import { useEffect } from 'react';
import { contactsService } from '../services/contacts';
import type { Contact, ImportantEvent } from '../lib/supabase/types';
import { ImportantEventCard } from '../components/contacts/ImportantEventCard';

export const ImportantEventsPage = () => {
  const navigate = useNavigate();

  const { isPremium, isOnTrial } = useStore();

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
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const { data: totalCount } = useQuery<number>({
    queryKey: ['contactsCount'],
    queryFn: contactsService.getTotalContactCount,
    enabled: !isPremium && !isOnTrial
  });

  // Fetch upcoming events with optimized backend query
  const { data: events, isLoading } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events', 'upcoming'],
    queryFn: () => contactsService.getUpcomingEvents(12), // Get all events within 12 months
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  // Get contact name by ID
  const getContactName = (contactId: string): string => {
    return contacts?.find(c => c.id === contactId)?.name || 'Unknown';
  };

  // Events are already filtered and sorted by the backend
  const upcomingEvents = events?.map(event => ({
    ...event,
    nextOccurrence: event.next_occurrence ? new Date(event.next_occurrence) : new Date(event.date)
  }));

  // Group events by month using next occurrence date
  const groupedEvents = upcomingEvents?.reduce((groups, event) => {
    const date = event.nextOccurrence;
    const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups[month]) {
      groups[month] = [];
    }
    groups[month].push(event);
    return groups;
  }, {} as Record<string, ImportantEvent[]>);

  return (
    <div className="space-y-6">
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
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300 bg-clip-text text-transparent">Important Events</h1>
              <p className="mt-1.5 text-[15px] text-gray-600/90 dark:text-gray-400">
                Keep track of birthdays, anniversaries and other important dates
              </p>
            </div>
          </div>
        </div>
      </div>

      {!isPremium && !isOnTrial && totalCount !== undefined && totalCount > 15 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mb-6">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You're seeing important events for your 15 most recent contacts. {' '}
            <Link to="/settings" className="font-medium text-amber-900 dark:text-amber-200 underline hover:no-underline">
              Upgrade to Premium
            </Link>{' '}
            to manage events for all {totalCount} of your contacts.
          </p>
        </div>
      )}
      
      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-3 text-primary-500/90">
              <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-base font-medium text-gray-600 dark:text-gray-400">Loading events...</span>
            </div>
          </div>
        ) : !upcomingEvents?.length ? (
          <div className="p-12 text-center">
            <p className="text-[15px] text-gray-600/90 dark:text-gray-400">No upcoming important events</p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(groupedEvents || {}).map(([month, monthEvents]) => (
              <div key={month} className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark p-4 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                  <span className="text-xs font-[500] text-gray-500/90 dark:text-gray-400 uppercase tracking-wider">{month}</span>
                </div>
                <div className="space-y-4">
                  {monthEvents.map((event) => {
                    const contactName = getContactName(event.contact_id);
                    
                    return (
                      <ImportantEventCard
                        key={event.id}
                        event={event}
                        contactName={contactName}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportantEventsPage;