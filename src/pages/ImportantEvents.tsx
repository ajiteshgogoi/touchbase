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
        return '🎊';
      default:
        return '📅';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -m-2 text-gray-400 hover:text-gray-500"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Important Events</h1>
          <p className="mt-1 text-sm text-gray-600">
            Keep track of birthdays, anniversaries and other important dates
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-pulse">Loading events...</div>
          </div>
        ) : !upcomingEvents?.length ? (
          <div className="p-12 text-center text-gray-500">
            No upcoming important events
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {Object.entries(groupedEvents || {}).map(([month, monthEvents]) => (
              <div key={month} className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900 sticky top-0 bg-white py-2">{month}</h2>
                <div className="space-y-4">
                  {monthEvents.map((event) => {
                    const contactName = getContactName(event.contact_id);
                    return (
                      <div 
                        key={event.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="text-2xl" role="img" aria-label={event.type}>
                          {getEventEmoji(event.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/contacts#${event.contact_id}`}
                            className="text-base font-medium text-gray-900 hover:text-primary-600"
                          >
                            {contactName}
                          </Link>
                          <p className="text-sm text-gray-500">
                            {getEventTypeDisplay(event.type)}
                            {event.type === 'custom' && event.name ? `: ${event.name}` : ''}
                          </p>
                          <p className="text-xs text-gray-400">
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