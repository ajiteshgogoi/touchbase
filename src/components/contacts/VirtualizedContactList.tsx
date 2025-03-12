import { useCallback, memo, useState, useRef, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { VariableSizeList as List, VariableSizeList } from 'react-window';
import { BasicContact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from './ContactCard';

// Scroll velocity thresholds for overscan adjustment
const VELOCITY_THRESHOLDS = {
  LOW: 10,    // pixels/frame
  MEDIUM: 30,
  HIGH: 50
};

// Overscan items based on velocity
const OVERSCAN_ITEMS = {
  DEFAULT: 5,
  LOW: 8,
  MEDIUM: 12,
  HIGH: 20
};

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
  isLoading?: boolean;
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
    heightMap: Record<number, number>;
    isLoading?: boolean;
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
    setLoadingStates,
    heightMap,
    isLoading
  } = data;

  const cardRef = useRef<HTMLDivElement>(null);

  // Prefetch when within last 10 items
  const PREFETCH_THRESHOLD = 10;
  useEffect(() => {
    if (hasNextPage && index >= contacts.length - PREFETCH_THRESHOLD) {
      const timeoutId = setTimeout(() => {
        loadMore();
      }, 100); // Small delay to prevent multiple rapid calls
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [index, contacts.length, hasNextPage, loadMore]);

  // Fallback: Always load more at the last item to ensure we don't miss loading data
  if (index === contacts.length - 1 && hasNextPage) {
    loadMore();
  }

  // Handle empty state
  if (!isLoading && contacts.length === 0) {
    return (
      <div style={{ ...style, padding: '8px 0' }}>
        <div className="p-12 text-center text-gray-500">
          No contacts found
        </div>
      </div>
    );
  }

  const contact = contacts[index];
  if (!contact) return null;

  if (isLoading) {
    return (
      <div style={{ ...style, padding: '8px 0' }}>
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Update height when expanded or on initial render
  useEffect(() => {
    if (!cardRef.current) return;

    const isExpanded = expandedIndices.has(index);
    const hasInitialHeight = index in heightMap;

    // Only measure if expanded or not yet measured
    if (isExpanded || !hasInitialHeight) {
      requestAnimationFrame(() => {
        if (cardRef.current) {
          const height = cardRef.current.offsetHeight + 16;
          updateHeight(index, height);
        }
      });
    }
  }, [expandedIndices, index, loadingStates, updateHeight, heightMap]);

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
  loadMore,
  isLoading
}: VirtualizedContactListProps) => {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Set<number>>(new Set());
  const [heightMap, setHeightMap] = useState<Record<number, number>>({});
  const [overscanCount, setOverscanCount] = useState(OVERSCAN_ITEMS.DEFAULT);
  
  // Refs for scroll velocity calculation
  const lastScrollTop = useRef(0);
  const lastScrollTime = useRef(performance.now());

  // Handle scroll events to adjust overscan count
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    const currentTime = performance.now();
    const timeDelta = currentTime - lastScrollTime.current;
    
    if (timeDelta > 0) {
      // Calculate velocity in pixels per millisecond
      const scrollDelta = Math.abs(scrollOffset - lastScrollTop.current);
      const velocity = scrollDelta / timeDelta;

      // Convert to pixels per frame (assuming 60fps)
      const pixelsPerFrame = velocity * (1000 / 60);

      // Update overscan count based on velocity
      let newOverscanCount = OVERSCAN_ITEMS.DEFAULT;
      if (pixelsPerFrame > VELOCITY_THRESHOLDS.HIGH) {
        newOverscanCount = OVERSCAN_ITEMS.HIGH;
      } else if (pixelsPerFrame > VELOCITY_THRESHOLDS.MEDIUM) {
        newOverscanCount = OVERSCAN_ITEMS.MEDIUM;
      } else if (pixelsPerFrame > VELOCITY_THRESHOLDS.LOW) {
        newOverscanCount = OVERSCAN_ITEMS.LOW;
      }

      setOverscanCount(newOverscanCount);
    }

    // Update refs for next calculation
    lastScrollTop.current = scrollOffset;
    lastScrollTime.current = currentTime;
  }, []);
    
  const getItemSize = useCallback((index: number) => {
    if (loadingStates.has(index)) return LOADING_HEIGHT;
    
    const cachedHeight = heightMap[index];
    const isExpanded = expandedIndices.has(index);

    if (isExpanded) {
      return cachedHeight || EXPANDED_HEIGHT;
    }
    
    // For collapsed cards, use cached height but ensure minimum height
    return cachedHeight ? Math.max(cachedHeight, COLLAPSED_HEIGHT) : COLLAPSED_HEIGHT;
  }, [loadingStates, heightMap, expandedIndices]);
  
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
  // Reset size cache when expanded state changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedIndices]);

  // Handle hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && listRef.current) {
        const targetIndex = contacts.findIndex(contact => contact.id === hash);
        if (targetIndex !== -1) {
          listRef.current.scrollToItem(targetIndex, 'start');
        }
      }
    };

    // Handle initial hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [contacts]);

  const itemData = useMemo(() => ({
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
    setLoadingStates,
    heightMap,
    isLoading
  }), [
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
    setLoadingStates,
    heightMap,
    isLoading
  ]);

  return (
    <List
      ref={listRef}
      height={window.innerHeight - 200}
      itemCount={contacts.length}
      itemSize={getItemSize}
      width="100%"
      itemKey={getItemKey}
      overscanCount={overscanCount}
      onScroll={handleScroll}
      itemData={itemData}
    >
      {Row}
    </List>
  );
};