import { useQuery } from '@tanstack/react-query';
import { getThread } from '../api/threads';

export function useThread(id: string | undefined) {
  return useQuery({
    queryKey: ['thread', id],
    queryFn: () => getThread(id as string),
    enabled: !!id,
  });
}
