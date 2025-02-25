import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { contactsService } from '../services/contacts';
import { formatEventDate, getEventTypeDisplay, getNextOccurrence } from '../components/contacts/utils';
import type { Contact, ImportantEvent } from '../lib/supabase/types';

export const ImportantEventsPage = () => {
  const navigate = useNavigate();

  // Fetch all contacts to get their names
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all important events
  const { data: events, isLoading } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events'],
    queryFn: () => contactsService.getImportantEvents(),
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

  // Filter and sort upcoming events for next 12 months using yearly recurrence logic
  const upcomingEvents = events
    ?.map(event => ({
      ...event,
      nextOccurrence: dayjs(getNextOccurrence(event.date)).toDate()
    }))
    .filter(event => {
      const nextYear = dayjs().add(12, 'months').toDate();
      return event.nextOccurrence >= new Date() && event.nextOccurrence <= nextYear;
    })
    .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());

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

  // Get emoji for event type
  const getEventEmoji = (type: string): string => {
    switch (type) {
      case 'birthday':
        return '🎂';
      case 'anniversary':
        return '❤️';
      default:
        return '📅';
    }
  };

  return (
    <div className="space-y-6">
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
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">Important Events</h1>
              <p className="mt-1.5 text-[15px] text-gray-600/90">
                Keep track of birthdays, anniversaries and other important dates
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-3 text-primary-500/90">
              <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-base font-medium text-gray-600">Loading events...</span>
            </div>
          </div>
        ) : !upcomingEvents?.length ? (
          <div className="p-12 text-center">
            <p className="text-[15px] text-gray-600/90">No upcoming important events</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            {Object.entries(groupedEvents || {}).map(([month, monthEvents]) => (
              <div key={month} className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-4 hover:shadow-md transition-all duration-200">
                <h2 className="text-[15px] font-[600] text-gray-900/90 mb-4">{month}</h2>
                <div className="space-y-4">
                  {monthEvents.map((event) => {
                    const contactName = getContactName(event.contact_id);
                    
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-4 p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100/50 hover:bg-white/70 transition-all duration-200"
                      >
                        <div
                          className="text-2xl"
                          role="img"
                          aria-label={event.type}
                        >
                          {getEventEmoji(event.type)}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            to={`/contacts#${event.contact_id}`}
                            className="block text-xl sm:text-2xl font-semibold text-primary-500 tracking-[-0.01em] hover:text-primary-600 transition-colors"
                          >
                            {contactName}
                          </Link>
                          <p className="text-sm text-gray-500">
                            {event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}
                          </p>
                          <p className="text-[13px] text-gray-500/90 font-[450]">
                            {formatEventDate(event.date)}
                          </p>
                        </div>
                      </div>
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