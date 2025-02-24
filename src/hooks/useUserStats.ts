import { useQuery } from '@tanstack/react-query';
import { getRecentUsers } from '../lib/supabase/client';

export const useUserStats = () => {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: getRecentUsers,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2, // Retry failed requests up to 2 times
  });
};