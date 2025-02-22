import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../../services/contacts';
import { formatEventDate, getEventTypeDisplay } from '../contacts/utils';
import type { Contact, ImportantEvent } from '../../lib/supabase/types';

/**
 * Component to display upcoming important events in a timeline format
 */
export const ImportantEventsTimeline = () => {
  // Fetch all contacts to get their names
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all important events
  const { data: events } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events'],
    queryFn: () => contactsService.getImportantEvents(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get contact name by ID
  const getContactName = (contactId: string): string => {
    return contacts?.find(c => c.id === contactId)?.name || 'Unknown';
  };

  // Filter and sort upcoming events
  const upcomingEvents = events
    ?.filter(event => new Date(event.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10); // Show only next 10 events

  // Group events by month
  const groupedEvents = upcomingEvents?.reduce((groups, event) => {
    const date = new Date(event.date);
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

  if (!upcomingEvents?.length) {
    return (
      <div className="bg-white rounded-xl shadow-soft p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-primary-50 rounded-lg">
            <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Important Events</h2>
        </div>
        <p className="text-sm text-gray-500">No upcoming important events</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-soft p-6">
      <div className="mb-6 flex items-center gap-2">
        <div className="p-2 bg-primary-50 rounded-lg">
          <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Important Events</h2>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedEvents || {}).map(([month, monthEvents]) => (
          <div key={month}>
            <h3 className="text-sm font-medium text-gray-500 mb-4">{month}</h3>
            <div className="space-y-4">
              {monthEvents.map((event) => {
                const contactName = getContactName(event.contact_id);
                return (
                  <div 
                    key={event.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="text-2xl" role="img" aria-label={event.type}>
                      {getEventEmoji(event.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/contacts/${event.contact_id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600"
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
    </div>
  );
};

export default ImportantEventsTimeline;