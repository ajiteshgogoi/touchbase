import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollProps {
  enabled: boolean;
  onLoadMore: () => void;
  hasNextPage?: boolean;
  threshold?: number;
}

export function useInfiniteScroll({
  enabled,
  onLoadMore,
  hasNextPage = false
}: UseInfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting && hasNextPage && !isLoading) {
        setIsLoading(true);
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Debounce the load more call
        timeoutRef.current = setTimeout(() => {
          onLoadMore();
          setIsLoading(false);
        }, 100);
      }
    },
    [hasNextPage, onLoadMore, isLoading]
  );

  useEffect(() => {
    if (!enabled) return;

    const options = {
      root: null,
      rootMargin: '200px', // Load earlier, before reaching the end
      threshold: 0.1 // Trigger with just 10% visibility
    };

    observerRef.current = new IntersectionObserver(handleObserver, options);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleObserver]);

  useEffect(() => {
    const currentTarget = targetRef.current;
    const currentObserver = observerRef.current;

    if (currentTarget && currentObserver && hasNextPage) {
      currentObserver.observe(currentTarget);
    }

    return () => {
      if (currentTarget && currentObserver) {
        currentObserver.unobserve(currentTarget);
      }
    };
  }, [targetRef, observerRef, hasNextPage]);

  return targetRef;
}