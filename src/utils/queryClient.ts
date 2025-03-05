import { QueryClient } from '@tanstack/react-query';

let queryClient: QueryClient;

export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

export const getQueryClient = () => {
  if (!queryClient) {
    throw new Error('QueryClient not initialized');
  }
  return queryClient;
};