import { useCallback, memo, useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import { VariableSizeList as List, VariableSizeList } from 'react-window';
import { BasicContact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from './ContactCard';

// Default heights for cards
const COLLAPSED_HEIGHT = 216;
const LOADING_HEIGHT = 300;    // Height when showing loading spinner
const EXPANDED_HEIGHT = 600;   // Initial height for expanded state before measurement

interface VirtualizedContactListProps {
  contacts: BasicContact[];
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
    contacts: BasicContact[];
    eventsMap: Record<string, ImportantEvent[]>;
    isPremium: boolean;
    isOnTrial: boolean;
    onDelete: (contactId: string) => Promise<void>;
    onQuickInteraction: VirtualizedContactListProps['onQuickInteraction'];
    hasNextPage: boolean;
    loadMore: () => void;
    expandedIndices: Set<number>;
    setExpandedIndices: Dispatch<SetStateAction<Set<number>>>;
    updateHeight: (index: number, height: number, isLoading?: boolean) => void;
    loadingStates: Set<number>;
    setLoadingStates: Dispatch<SetStateAction<Set<number>>>;
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
    updateHeight,
    loadingStates,
    setLoadingStates
  } = data;

  const cardRef = useRef<HTMLDivElement>(null);

  // If we're at the last item and there's more to load, trigger loading more
  if (index === contacts.length - 1 && hasNextPage) {
    loadMore();
  }

  const contact = contacts[index];
  if (!contact) return null;

  // Update height when card expands/collapses or content loads
  useEffect(() => {
    if (cardRef.current && expandedIndices.has(index)) {
      // Use requestAnimationFrame to make the height update non-blocking
      requestAnimationFrame(() => {
        if (cardRef.current) {  // Re-check ref in case component unmounted
          const height = cardRef.current.offsetHeight + 16; // Account for 8px padding top and bottom
          updateHeight(index, height);
        }
      });
    }
  }, [expandedIndices, index, loadingStates, updateHeight]);

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
                // When expanding, immediately mark as loading and update height
                updateHeight(index, LOADING_HEIGHT, true);
              } else {
                next.delete(index);
                // When collapsing, clear loading state
                setLoadingStates(prev => {
                  const next = new Set(prev);
                  next.delete(index);
                  return next;
                });
              }
              return next;
            });
          }}
          onLoadingChange={(isLoading) => {
            if (!expandedIndices.has(index)) return;
            if (isLoading) {
              updateHeight(index, LOADING_HEIGHT, true);
            } else if (cardRef.current) {
              const height = cardRef.current.offsetHeight + 16;
              updateHeight(index, height, false);
            }
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
  const [loadingStates, setLoadingStates] = useState<Set<number>>(new Set());
  const [heightMap, setHeightMap] = useState<Record<number, number>>({});
    
  const getItemSize = (index: number) => {
    if (!expandedIndices.has(index)) return COLLAPSED_HEIGHT;
    if (loadingStates.has(index)) return LOADING_HEIGHT;
    return heightMap[index] || EXPANDED_HEIGHT;
  };
  
  const listRef = useRef<VariableSizeList>(null);
  
  // Callback to update height of an expanded card
  const updateHeight = useCallback((index: number, height: number, isLoading?: boolean) => {
    // Use requestAnimationFrame to make the height update non-blocking
    requestAnimationFrame(() => {
      if (isLoading) {
        setLoadingStates(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
        });
      } else {
        setLoadingStates(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        setHeightMap(prev => {
          if (prev[index] === height) return prev;
          return { ...prev, [index]: height };
        });
      }
      
      if (listRef.current) {
        listRef.current.resetAfterIndex(index);
      }
    });
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
        updateHeight,
        loadingStates,
        setLoadingStates
      }}
    >
      {Row}
    </List>
  );
};