import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { contactsService } from '../../services/contacts';
import type { Contact, ImportantEvent } from '../../lib/supabase/types';
import { ImportantEventCard } from '../contacts/ImportantEventCard';

/**
 * Component to display upcoming important events in a timeline format
 */
export const ImportantEventsTimeline = () => {
  // For free users, we'll only get the 15 most recent contacts
    const { isPremium, isOnTrial } = useStore();
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

 // Fetch upcoming events with optimized backend query
 const { data: events } = useQuery<ImportantEvent[]>({
   queryKey: ['important-events', 'upcoming', 6],
   queryFn: () => contactsService.getUpcomingEvents(12, 6), // Get next 6 events within 12 months
   staleTime: 5 * 60 * 1000, // 5 minutes
 });

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

  if (!upcomingEvents?.length) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Important Events</h2>
          <p className="mt-1 text-sm text-gray-600">
            Upcoming events for your contacts
          </p>
        </div>
        <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
          <div className="p-12 text-center">
            <p className="text-[15px] text-gray-600/90">No upcoming important events</p>
          </div>
          <div className="p-6 border-t border-gray-100">
            <Link
              to="/important-events"
              className="inline-flex items-center text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              View all events
              <svg className="w-5 h-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Important Events</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upcoming events for your contacts
        </p>
      </div>
      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
        <div className="p-4 space-y-6">
          {Object.entries(groupedEvents || {}).map(([month, monthEvents]) => (
            <div key={month} className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-4 hover:shadow-md transition-all duration-200">
              <div className="px-3 py-2 bg-gray-100 rounded-lg mb-4">
                <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">{month}</span>
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
        <div className="p-6 border-t border-gray-100">
          <Link
            to="/important-events"
            className="inline-flex items-center text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            View all events
            <svg className="w-5 h-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ImportantEventsTimeline;