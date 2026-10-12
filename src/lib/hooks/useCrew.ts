import { useQuery } from '@tanstack/react-query';

import { fetchCrew } from '@/lib/api/crew';

const ONE_HOUR_MS = 60 * 60 * 1000;

export const CREW_QUERY_KEY = ['iss', 'crew'] as const;

export function useCrew() {
  return useQuery({
    queryKey: CREW_QUERY_KEY,
    queryFn: ({ signal }) => fetchCrew(signal),
    staleTime: ONE_HOUR_MS,
    retry: 1,
  });
}
