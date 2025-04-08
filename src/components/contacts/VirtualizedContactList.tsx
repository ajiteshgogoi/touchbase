import { useCallback, memo, useState, useRef, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { VariableSizeList as List, VariableSizeList } from 'react-window';
import { BasicContact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from './ContactCard';
import { LoadingSpinner } from '../shared/LoadingSpinner';

// Calculate dynamic overscan based on viewport height
const calculateOverscan = (viewportHeight: number): number => {
  // Approximate number of items visible in viewport assuming average item height
  const approxVisibleItems = Math.ceil(viewportHeight / 250); // 250px average item height
  // Set overscan to 100% of visible items, min 10 max 30
  return Math.min(Math.max(Math.ceil(approxVisibleItems * 1.0), 10), 30);
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
  isContactsPage?: boolean;
  selectedContacts?: Set<string>;
  isSelectionMode?: boolean;
  onToggleSelect?: (contactId: string) => void;
  onStartSelectionMode?: () => void;
  isBulkDeleting?: boolean;
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
    isScrolling: boolean;
    isContactsPage?: boolean;
    selectedContacts?: Set<string>;
    isSelectionMode?: boolean;
    onToggleSelect?: (contactId: string) => void;
    onStartSelectionMode?: () => void;
    isBulkDeleting?: boolean;
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
    isLoading,
    isScrolling,
    isContactsPage,
    selectedContacts,
    isSelectionMode,
    onToggleSelect,
    onStartSelectionMode,
    isBulkDeleting
  } = data;

  const cardRef = useRef<HTMLDivElement>(null);
  const heightPatterns = useRef<Map<string, number>>(new Map());
  const isLastRow = index === contacts.length - 1;
  const showLoadingSpinner = isLastRow && hasNextPage;

  // Prefetch when within last 5 items to reduce aggressive loading
  const PREFETCH_THRESHOLD = 5;
  useEffect(() => {
    if (hasNextPage && index >= contacts.length - PREFETCH_THRESHOLD) {
      const timeoutId = setTimeout(() => {
        loadMore();
      }, 100); // Small delay to prevent multiple rapid calls
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [index, contacts.length, hasNextPage, loadMore]);

  // Setup ResizeObserver for efficient height tracking
  useEffect(() => {
    if (!cardRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLDivElement;
        const height = entry.borderBoxSize[0]?.blockSize ?? target.offsetHeight;
        const finalHeight = height + 16;

        // Cache height pattern based on content characteristics
        const isExpanded = expandedIndices.has(index);
        const contentHash = `${isExpanded}-${loadingStates.has(index)}`;
        heightPatterns.current.set(contentHash, finalHeight);

        // Only update if significant change (>5px) to reduce unnecessary updates
        const currentHeight = heightMap[index];
        if (!currentHeight || Math.abs(currentHeight - finalHeight) > 5) {
          // Throttle updates during scroll
          if (isScrolling) {
            setTimeout(() => updateHeight(index, finalHeight), 100);
          } else {
            updateHeight(index, finalHeight);
          }
        }
      }
    });

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [expandedIndices, index, loadingStates, updateHeight, heightMap, isScrolling, isSelectionMode]);

  // Use cached height patterns when available
  useEffect(() => {
    const contentHash = `${expandedIndices.has(index)}-${loadingStates.has(index)}-${isSelectionMode}`;
    const cachedHeight = heightPatterns.current.get(contentHash);
    if (cachedHeight && !heightMap[index]) {
      updateHeight(index, cachedHeight);
    }
  }, [expandedIndices, index, loadingStates, heightMap, updateHeight, isSelectionMode]);

  // Handle empty state
  if (!isLoading && contacts.length === 0) {
    return (
      <div style={{
        ...style,
        padding: '8px 0',
        transition: 'padding 150ms ease-in-out'
      }}>
        <div className="p-12 text-center text-gray-500 dark:text-gray-400">
          No contacts found
        </div>
      </div>
    );
  }

  const contact = contacts[index];
  if (!contact) return null;

  if (isLoading) {
    return (
      <div style={{
        ...style,
        padding: '8px 0',
        transition: 'padding 150ms ease-in-out'
      }}>
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-soft-dark">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...style,
      padding: '8px 0'
    }}>
      <div
        ref={cardRef}
        style={{
          transform: 'translate3d(0, 0, 0)', // Enable GPU acceleration
          willChange: isScrolling ? 'transform' : 'auto' // Optimize for scrolling
        }}
      >
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
                updateHeight(index, COLLAPSED_HEIGHT, false);
                setLoadingStates(prev => {
                  const next = new Set(prev);
                  next.delete(index);
                  return next;
                });
              }
              return next;
            });
          }}
          isContactsPage={isContactsPage}
          onLoadingChange={(isLoading) => {
            if (!expandedIndices.has(index)) return;
            if (isLoading) {
              updateHeight(index, LOADING_HEIGHT, true);
            } else if (cardRef.current) {
              const height = cardRef.current.offsetHeight + 16;
              updateHeight(index, height, false);
            }
          }}
          isSelected={selectedContacts?.has(contact.id)}
          isSelectionMode={isSelectionMode}
          onToggleSelect={onToggleSelect}
          onStartSelectionMode={onStartSelectionMode}
          isBulkDeleting={isBulkDeleting}
        />
      </div>
      {showLoadingSpinner && (
        <div style={{
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="scale-75 opacity-70">
            <LoadingSpinner />
          </div>
        </div>
      )}
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
  isLoading,
  isContactsPage,
  selectedContacts,
  isSelectionMode,
  onToggleSelect,
  onStartSelectionMode,
  isBulkDeleting
}: VirtualizedContactListProps) => {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Set<number>>(new Set());
  const [heightMap, setHeightMap] = useState<Record<number, number>>({});
  const [listHeight, setListHeight] = useState(window.innerHeight - 200);
  const initialOverscan = useMemo(() => calculateOverscan(listHeight), [listHeight]);
  const [overscanCount, setOverscanCount] = useState(initialOverscan);
  
  // Common height patterns cache
  const heightPatterns = useRef<Map<string, number>>(new Map());

  // Refs for scroll momentum calculation
  const lastScrollTop = useRef(0);
  const lastScrollTime = useRef(performance.now());
  const scrollVelocity = useRef(0);
  const scrollMomentumTimer = useRef<number | null>(null);
  const isScrolling = useRef(false);

  // Track touch/wheel events to detect explicit scroll stops
  const lastUserInteraction = useRef<number>(0);
  
  // Handle scroll momentum and overscan adjustments
  const updateOverscanWithMomentum = useCallback((velocity: number) => {
    const baseOverscan = calculateOverscan(listHeight);
    const currentTime = performance.now();
    
    // Custom easing for natural deceleration
    const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4);
    
    // If user hasn't interacted recently (200ms threshold), start natural deceleration
    if (currentTime - lastUserInteraction.current > 200) {
      const timeSinceLastInteraction = (currentTime - lastUserInteraction.current) / 1000;
      const decelerationFactor = easeOutQuart(Math.min(timeSinceLastInteraction * 2, 1));
      
      setOverscanCount(prev => {
        const diff = baseOverscan - prev;
        // Smoother transition using the deceleration factor
        return Math.round(prev + diff * (0.2 + (0.3 * decelerationFactor)));
      });
      
      if (decelerationFactor >= 0.95) {
        isScrolling.current = false;
        return;
      }
    }

    // Calculate target overscan with velocity-based scaling
    const velocityFactor = Math.min(Math.max(velocity, 0.5), 3); // Increased range
    const targetOverscan = Math.ceil(baseOverscan * (1.5 + velocityFactor)); // Scale up with velocity
    
    // Apply smooth interpolation with faster response to velocity
    setOverscanCount(current => {
      const progress = Math.min(velocity * 0.5, 1); // Increased velocity influence
      const easedProgress = easeOutQuart(progress);
      const diff = targetOverscan - current;
      return Math.round(current + diff * (0.3 + (0.4 * easedProgress))); // Faster adaptation
    });

    // Natural momentum decay with variable rate
    if (Math.abs(velocity) > 0.05) {
      // Apply gentler decay to maintain higher overscan longer
      const baseDecay = isSelectionMode ? 0.985 : 0.975;
      const velocityInfluence = isSelectionMode ? 0.015 : 0.025;
      const decayFactor = baseDecay + (Math.min(Math.abs(velocity), 1.5) * velocityInfluence);
      scrollVelocity.current *= decayFactor;
      
      scrollMomentumTimer.current = window.requestAnimationFrame(() => {
        updateOverscanWithMomentum(scrollVelocity.current);
      });
    } else {
      // Graceful return to base overscan
      setOverscanCount(prev => {
        const diff = baseOverscan - prev;
        return Math.round(prev + diff * 0.2);
      });
      isScrolling.current = false;
    }
  }, [listHeight]);

  // Enhanced scroll handling with improved velocity calculation
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    const currentTime = performance.now();
    const timeDelta = currentTime - lastScrollTime.current;
    
    if (timeDelta > 0) {
      const scrollDelta = scrollOffset - lastScrollTop.current;
      const rawVelocity = Math.abs(scrollDelta) / timeDelta;
      
      // Enhanced smoothing using cubic bezier like easing
      // Reduce velocity and smoothing in selection mode
      const velocityScale = isSelectionMode ? 0.5 : 1;
      const velocityFactor = Math.min((rawVelocity * velocityScale) / 1.5, 1);
      const smoothingStart = isSelectionMode ? 0.25 : 0.15;
      const smoothingEnd = isSelectionMode ? 0.45 : 0.35;
      const t = velocityFactor * velocityFactor * (3 - 2 * velocityFactor); // Smoothstep easing
      const smoothingFactor = smoothingStart + (smoothingEnd - smoothingStart) * t;
      
      // Calculate target velocity with gradual acceleration/deceleration
      const targetVelocity = rawVelocity * (1 - Math.pow(1 - velocityFactor, 2));
      
      // Apply smoothing with momentum preservation
      scrollVelocity.current = isScrolling.current
        ? scrollVelocity.current * (1 - smoothingFactor) + targetVelocity * smoothingFactor
        : targetVelocity;

      // Limit maximum velocity change per frame for extra smoothness
      const maxVelocityDelta = 1.2;
      const velocityDelta = Math.abs(scrollVelocity.current - rawVelocity);
      if (velocityDelta > maxVelocityDelta) {
        const direction = rawVelocity > scrollVelocity.current ? 1 : -1;
        scrollVelocity.current = scrollVelocity.current + (maxVelocityDelta * direction);
      }

      // Clean up previous momentum calculation
      if (scrollMomentumTimer.current) {
        cancelAnimationFrame(scrollMomentumTimer.current);
      }

      isScrolling.current = true;
      updateOverscanWithMomentum(scrollVelocity.current);

      // Update tracking refs
      lastScrollTop.current = scrollOffset;
      lastScrollTime.current = currentTime;
    }
  }, [updateOverscanWithMomentum]);

  // Update list height on resize and handle user interactions
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

    // Track user interactions to detect explicit scroll stops
    const handleUserInteraction = () => {
      lastUserInteraction.current = performance.now();
    };

    // Use passive listeners for better scroll performance
    window.addEventListener('resize', handleResize);
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('touchmove', handleUserInteraction, { passive: true });
    window.addEventListener('wheel', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('touchmove', handleUserInteraction);
      window.removeEventListener('wheel', handleUserInteraction);
      
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

  // Throttle frame updates during scroll
  const throttleRAF = useCallback((callback: () => void) => {
    requestAnimationFrame(callback);
  }, []);

  const updateHeight = useCallback((index: number, height: number, isLoading?: boolean) => {
    pendingUpdates.current.set(index, {
      height,
      isLoading: Boolean(isLoading)
    });
    
    if (!updateScheduled.current) {
      updateScheduled.current = true;
      throttleRAF(() => {
        flushPendingUpdates();
      });
    }
  }, [flushPendingUpdates, throttleRAF]);

  const getItemKey = useCallback((index: number) => {
    const contact = contacts[index];
    return contact ? contact.id : index;
  }, [contacts]);

  const getItemSize = useCallback((index: number) => {
    const isExpanded = expandedIndices.has(index);
    const isLoading = loadingStates.has(index);
    
    // Use cached height pattern if available
    const contentHash = `${isExpanded}-${loadingStates.has(index)}`;
    const patternHeight = heightPatterns.current?.get(contentHash);
    
    if (patternHeight) {
      // Use pattern height as fallback for uncached items
      return heightMap[index] || patternHeight;
    }
    
    // Fallback to standard heights
    if (isLoading) return LOADING_HEIGHT;
    if (isExpanded) return heightMap[index] || EXPANDED_HEIGHT;
    return heightMap[index] || COLLAPSED_HEIGHT; // Always use dynamic height measurements
  }, [loadingStates, heightMap, expandedIndices]);

  // Reset size cache when expanded state changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedIndices]);

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
    isLoading,
    isScrolling: isScrolling.current,
    isContactsPage,
    selectedContacts,
    isSelectionMode,
    onToggleSelect,
    onStartSelectionMode,
    isBulkDeleting
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
    isLoading,
    isScrolling,
    isContactsPage,
    selectedContacts,
    isSelectionMode,
    onToggleSelect,
    onStartSelectionMode,
    isBulkDeleting
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
      data-virtualized-list
      style={{ outline: 'none' }}
    >
      {Row}
    </List>
  );
};
