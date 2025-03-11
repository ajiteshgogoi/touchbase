import { useCallback, useEffect, useRef } from 'react';

interface UseInfiniteScrollProps {
  enabled: boolean;
  onLoadMore: () => void;
  hasNextPage?: boolean;
  threshold?: number;
}

export function useInfiniteScroll({
  enabled,
  onLoadMore,
  hasNextPage = false,
  threshold = 0.8
}: UseInfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting && hasNextPage) {
        onLoadMore();
      }
    },
    [hasNextPage, onLoadMore]
  );

  useEffect(() => {
    if (!enabled) return;

    const options = {
      root: null, // viewport
      rootMargin: '0px',
      threshold
    };

    observerRef.current = new IntersectionObserver(handleObserver, options);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enabled, threshold, handleObserver]);

  useEffect(() => {
    const currentTarget = targetRef.current;
    const currentObserver = observerRef.current;

    if (currentTarget && currentObserver) {
      currentObserver.observe(currentTarget);
    }

    return () => {
      if (currentTarget && currentObserver) {
        currentObserver.unobserve(currentTarget);
      }
    };
  }, [targetRef, observerRef]);

  return targetRef;
}