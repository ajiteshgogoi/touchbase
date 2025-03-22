import { FC, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Contact } from '../../lib/supabase/types';

interface NeglectedContactsListProps {
  contacts: Contact[];
}

export const NeglectedContactsList: FC<NeglectedContactsListProps> = ({ contacts }) => {
  const [showAll, setShowAll] = useState(false);
  const sortedContacts = useMemo(() => 
    [...contacts].sort((a, b) => a.name.localeCompare(b.name))
  , [contacts]);
  
  const displayedContacts = showAll ? sortedContacts : sortedContacts.slice(0, 17);

  return (
    <>
      {displayedContacts.map(contact => (
        <Link
          key={contact.id}
          to={`/contacts?search=${encodeURIComponent(contact.name)}`}
          className="block text-[15px] font-semibold text-primary-500 hover:text-primary-600 transition-colors"
        >
          {contact.name}
        </Link>
      ))}
      {sortedContacts.length > 15 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[14px] text-gray-600 hover:text-primary-500 transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${sortedContacts.length})`}
        </button>
      )}
    </>
  );
};