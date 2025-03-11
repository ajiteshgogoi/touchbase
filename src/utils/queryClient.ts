import { QueryClient } from '@tanstack/react-query';

const CACHE_TIME = 1000 * 60 * 60 * 24; // 24 hours

const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
      gcTime: CACHE_TIME,
      cacheTime: CACHE_TIME,
    },
  },
};

let queryClient: QueryClient;

export const createQueryClient = () => {
  const client = new QueryClient({
    ...queryClientConfig,
    defaultOptions: {
      queries: {
        ...queryClientConfig.defaultOptions.queries,
        structuralSharing: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  return client;
};

export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

export const getQueryClient = () => {
  if (!queryClient) {
    throw new Error('QueryClient not initialized');
  }
  return queryClient;
};