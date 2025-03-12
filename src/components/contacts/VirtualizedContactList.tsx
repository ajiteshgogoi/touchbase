import { useCallback, memo, useState, useRef, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { VariableSizeList as List, VariableSizeList } from 'react-window';
import { BasicContact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from './ContactCard';

// Calculate dynamic overscan based on viewport height
const calculateOverscan = (viewportHeight: number): number => {
  // Approximate number of items visible in viewport assuming average item height
  const approxVisibleItems = Math.ceil(viewportHeight / 250); // 250px average item height
  // Set overscan to roughly 50% of visible items, min 5 max 20
  return Math.min(Math.max(Math.ceil(approxVisibleItems * 0.5), 5), 20);
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
                updateHeight(index, LOADING_HEIGHT, true);
              } else {
                next.delete(index);
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
  const [listHeight, setListHeight] = useState(window.innerHeight - 200);
  const initialOverscan = useMemo(() => calculateOverscan(listHeight), [listHeight]);
  const [overscanCount, setOverscanCount] = useState(initialOverscan);

  // Refs for scroll momentum calculation
  const lastScrollTop = useRef(0);
  const lastScrollTime = useRef(performance.now());
  const scrollVelocity = useRef(0);
  const scrollMomentumTimer = useRef<number>();
  const isScrolling = useRef(false);

  // Handle scroll momentum and overscan adjustments
  const updateOverscanWithMomentum = useCallback((velocity: number) => {
    const baseOverscan = calculateOverscan(listHeight);
    const targetOverscan = Math.ceil(baseOverscan * Math.min(Math.max(velocity * 2, 1), 2.5));
    
    // Smooth transition for overscan changes
    setOverscanCount(current => {
      const diff = targetOverscan - current;
      return Math.round(current + diff * 0.3); // Smooth interpolation
    });

    // Continue momentum updates if velocity is significant
    if (Math.abs(velocity) > 0.1) {
      scrollVelocity.current *= 0.95; // Decay factor
      scrollMomentumTimer.current = window.requestAnimationFrame(() => {
        updateOverscanWithMomentum(scrollVelocity.current);
      });
    } else {
      // Gradually return to base overscan when nearly stopped
      setOverscanCount(baseOverscan);
      isScrolling.current = false;
    }
  }, [listHeight]);

  // Handle scroll events
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    const currentTime = performance.now();
    const timeDelta = currentTime - lastScrollTime.current;
    
    if (timeDelta > 0) {
      // Calculate and smooth out velocity
      const scrollDelta = scrollOffset - lastScrollTop.current;
      const newVelocity = Math.abs(scrollDelta) / timeDelta;
      scrollVelocity.current = isScrolling.current ?
        scrollVelocity.current * 0.8 + newVelocity * 0.2 : // Smooth while scrolling
        newVelocity; // Initial velocity
      
      // Clear any pending momentum updates
      if (scrollMomentumTimer.current) {
        cancelAnimationFrame(scrollMomentumTimer.current);
      }

      isScrolling.current = true;
      updateOverscanWithMomentum(scrollVelocity.current);

      // Update refs for next calculation
      lastScrollTop.current = scrollOffset;
      lastScrollTime.current = currentTime;
    }
  }, [updateOverscanWithMomentum]);

  // Update list height on window resize and handle cleanup
  useEffect(() => {
    const handleResize = () => {
      const newHeight = window.innerHeight - 200;
      setListHeight(newHeight);
      
      // Reset momentum and overscan on resize
      if (scrollMomentumTimer.current) {
        cancelAnimationFrame(scrollMomentumTimer.current);
      }
      scrollVelocity.current = 0;
      isScrolling.current = false;
      setOverscanCount(calculateOverscan(newHeight));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up momentum calculations
      if (scrollMomentumTimer.current) {
        cancelAnimationFrame(scrollMomentumTimer.current);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollMomentumTimer.current) {
        cancelAnimationFrame(scrollMomentumTimer.current);
      }
    };
  }, []);

  const listRef = useRef<VariableSizeList>(null);

  // Callback to update height of an expanded card
  // Batch updates for height measurements
  const pendingUpdates = useRef<Map<number, { height: number; isLoading: boolean }>>(new Map());
  const updateScheduled = useRef(false);

  const flushPendingUpdates = useCallback(() => {
    const updates = pendingUpdates.current;
    if (updates.size === 0) return;

    const loadingUpdates = new Set<number>();
    const heightUpdates: Record<number, number> = {};
    let minChangedIndex = Infinity;

    updates.forEach(({ height, isLoading }, index) => {
      minChangedIndex = Math.min(minChangedIndex, index);
      
      if (isLoading) {
        loadingUpdates.add(index);
      } else {
        heightUpdates[index] = height;
      }
    });

    setLoadingStates(prev => {
      const next = new Set(prev);
      updates.forEach(({ isLoading }, index) => {
        if (isLoading) {
          next.add(index);
        } else {
          next.delete(index);
        }
      });
      return next;
    });

    setHeightMap(prev => {
      const newHeightMap = { ...prev };
      Object.entries(heightUpdates).forEach(([index, height]) => {
        if (newHeightMap[Number(index)] !== height) {
          newHeightMap[Number(index)] = height;
        }
      });
      return newHeightMap;
    });

    if (listRef.current && minChangedIndex !== Infinity) {
      listRef.current.resetAfterIndex(minChangedIndex);
    }

    pendingUpdates.current.clear();
    updateScheduled.current = false;
  }, []);

  const updateHeight = useCallback((index: number, height: number, isLoading?: boolean) => {
    pendingUpdates.current.set(index, { height, isLoading: Boolean(isLoading) });
    
    if (!updateScheduled.current) {
      updateScheduled.current = true;
      requestAnimationFrame(() => {
        flushPendingUpdates();
      });
    }
  }, [flushPendingUpdates]);

  const getItemKey = useCallback((index: number) => {
    const contact = contacts[index];
    return contact ? contact.id : index;
  }, [contacts]);

  const getItemSize = useCallback((index: number) => {
    if (loadingStates.has(index)) return LOADING_HEIGHT;
    
    const cachedHeight = heightMap[index];
    const isExpanded = expandedIndices.has(index);

    if (isExpanded) {
      return cachedHeight || EXPANDED_HEIGHT;
    }
    
    return cachedHeight ? Math.max(cachedHeight, COLLAPSED_HEIGHT) : COLLAPSED_HEIGHT;
  }, [loadingStates, heightMap, expandedIndices]);

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
      height={listHeight}
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