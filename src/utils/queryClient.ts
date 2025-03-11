import { QueryClient } from '@tanstack/react-query';

const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3, // Increased from 1 to 3 retries
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    },
  },
};

let queryClient: QueryClient;

export const createQueryClient = () => {
  return new QueryClient(queryClientConfig);
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