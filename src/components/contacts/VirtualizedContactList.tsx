import { useCallback, memo, useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
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
    expandedIndices: Set<number>;
    setExpandedIndices: Dispatch<SetStateAction<Set<number>>>;
    updateHeight: (index: number, height: number) => void;
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
    expandedIndices,
    setExpandedIndices,
    updateHeight
  } = data;

  const cardRef = useRef<HTMLDivElement>(null);

  // If we're at the last item and there's more to load, trigger loading more
  if (index === contacts.length - 1 && hasNextPage) {
    loadMore();
  }

  const contact = contacts[index];
  if (!contact) return null;

  // Update height when card expands/collapses
  useEffect(() => {
    if (cardRef.current && expandedIndices.has(index)) {
      // Add padding to maintain consistent gap
      const height = cardRef.current.offsetHeight + 16; // Account for 8px padding top and bottom
      updateHeight(index, height);
    }
  }, [expandedIndices, index, updateHeight]);

  return (
    <div style={{ ...style, padding: '8px 0' }}>
      <div ref={cardRef}>
        <ContactCard
          contact={contact}
          eventsMap={eventsMap}
          isPremium={isPremium}
          isOnTrial={isOnTrial}
          onDelete={onDelete}
          onQuickInteraction={onQuickInteraction}
          isExpanded={expandedIndices.has(index)}
          onExpandChange={(expanded) => {
            setExpandedIndices(prev => {
              const next = new Set(prev);
              if (expanded) {
                next.add(index);
              } else {
                next.delete(index);
              }
              return next;
            });
          }}
        />
      </div>
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
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [heightMap, setHeightMap] = useState<Record<number, number>>({});
  
  // Default height for collapsed cards
  const COLLAPSED_HEIGHT = 175;
  const EXPANDED_HEIGHT = 216;
  
  const getItemSize = (index: number) => {
    return expandedIndices.has(index) ? (heightMap[index] || EXPANDED_HEIGHT) : COLLAPSED_HEIGHT;
  };
  
  const listRef = useRef<VariableSizeList>(null);
  
  // Callback to update height of an expanded card
  const updateHeight = useCallback((index: number, height: number) => {
    setHeightMap(prev => {
      if (prev[index] === height) return prev;
      return { ...prev, [index]: height };
    });
    
    if (listRef.current) {
      listRef.current.resetAfterIndex(index);
    }
  }, []);
  
  const getItemKey = useCallback((index: number) => {
    const contact = contacts[index];
    return contact ? contact.id : index;
  }, [contacts]);

  // Reset size cache when expanded state changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedIndices]);

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
        expandedIndices,
        setExpandedIndices,
        updateHeight
      }}
    >
      {Row}
    </List>
  );
};