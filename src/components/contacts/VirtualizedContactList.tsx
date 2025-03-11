import { useCallback, memo, useState, useRef, useEffect } from 'react';
import { VariableSizeList as List, VariableSizeList } from 'react-window';
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
    expandedIndex: number | null;
    setExpandedIndex: (index: number | null) => void;
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
    loadMore,
    expandedIndex,
    setExpandedIndex
  } = data;

  // If we're at the last item and there's more to load, trigger loading more
  if (index === contacts.length - 1 && hasNextPage) {
    loadMore();
  }

  const contact = contacts[index];
  if (!contact) return null;

  return (
    <div style={{...style, padding: '8px 0'}}>
      <ContactCard
        contact={contact}
        eventsMap={eventsMap}
        isPremium={isPremium}
        isOnTrial={isOnTrial}
        onDelete={onDelete}
        onQuickInteraction={onQuickInteraction}
        isExpanded={expandedIndex === index}
        onExpandChange={(expanded) => setExpandedIndex(expanded ? index : null)}
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const getItemSize = (index: number) => {
    return expandedIndex === index ? 600 : 216; // Expanded cards get more space
  };
  
  const listRef = useRef<VariableSizeList>(null);
  
  const getItemKey = useCallback((index: number) => {
    const contact = contacts[index];
    return contact ? contact.id : index;
  }, [contacts]);

  // Reset size cache when expanded state changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedIndex]);

  return (
    <List
      ref={listRef}
      height={window.innerHeight - 200} // Adjust based on your layout
      itemCount={contacts.length}
      itemSize={getItemSize}
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
        loadMore,
        expandedIndex,
        setExpandedIndex
      }}
    >
      {Row}
    </List>
  );
};