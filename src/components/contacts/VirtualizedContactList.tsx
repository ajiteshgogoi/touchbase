import { useCallback, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from './ContactCard';

interface VirtualizedContactListProps {
  contacts: Contact[];
  eventsMap: Record<string, ImportantEvent[]>;
  isPremium: boolean;
  isOnTrial: boolean;
  onDelete: (contactId: string) => Promise<void>;
  onQuickInteraction: (params: { 
    contactId: string; 
    type: Interaction['type']; 
    contactName: string 
  }) => void;
  hasNextPage: boolean;
  loadMore: () => void;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    contacts: Contact[];
    eventsMap: Record<string, ImportantEvent[]>;
    isPremium: boolean;
    isOnTrial: boolean;
    onDelete: (contactId: string) => Promise<void>;
    onQuickInteraction: VirtualizedContactListProps['onQuickInteraction'];
    hasNextPage: boolean;
    loadMore: () => void;
  };
}

const Row = memo(({ index, style, data }: RowProps) => {
  const { 
    contacts, 
    eventsMap, 
    isPremium, 
    isOnTrial, 
    onDelete, 
    onQuickInteraction,
    hasNextPage,
    loadMore 
  } = data;

  // If we're at the last item and there's more to load, trigger loading more
  if (index === contacts.length - 1 && hasNextPage) {
    loadMore();
  }

  const contact = contacts[index];
  if (!contact) return null;

  return (
    <div style={style}>
      <ContactCard
        contact={contact}
        eventsMap={eventsMap}
        isPremium={isPremium}
        isOnTrial={isOnTrial}
        onDelete={onDelete}
        onQuickInteraction={onQuickInteraction}
      />
    </div>
  );
});

Row.displayName = 'ContactRow';

export const VirtualizedContactList = ({
  contacts,
  eventsMap,
  isPremium,
  isOnTrial,
  onDelete,
  onQuickInteraction,
  hasNextPage,
  loadMore
}: VirtualizedContactListProps) => {
  const itemSize = 200; // Height for each contact card (adjust based on your design)
  
  const getItemKey = useCallback((index: number) => {
    const contact = contacts[index];
    return contact ? contact.id : index;
  }, [contacts]);

  return (
    <List
      height={window.innerHeight - 200} // Adjust based on your layout
      itemCount={contacts.length}
      itemSize={itemSize}
      width="100%"
      itemKey={getItemKey}
      itemData={{
        contacts,
        eventsMap,
        isPremium,
        isOnTrial,
        onDelete,
        onQuickInteraction,
        hasNextPage,
        loadMore
      }}
    >
      {Row}
    </List>
  );
};