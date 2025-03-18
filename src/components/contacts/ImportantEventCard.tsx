import { Link } from 'react-router-dom';
import type { ImportantEvent } from '../../lib/supabase/types';
import { formatEventDate, getEventTypeDisplay } from './utils';

interface ImportantEventCardProps {
  event: ImportantEvent;
  contactName: string;
}

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

export const ImportantEventCard = ({ event, contactName }: ImportantEventCardProps) => {
  return (
    <div
      className="flex items-center gap-4 px-3 py-2.5 bg-gray-50/90 rounded-lg hover:bg-gray-100/90 transition-all duration-200"
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
          to={`/contacts?search=${encodeURIComponent(contactName)}`}
          className="block text-base font-semibold text-primary-500 tracking-[-0.01em] hover:text-primary-600 transition-colors"
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
};

export default ImportantEventCard;
