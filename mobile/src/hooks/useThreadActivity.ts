import { useQuery } from '@tanstack/react-query';
import { getThreadActivity } from '../api/threads';

export function useThreadActivity(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['thread-activity', id],
    queryFn: () => getThreadActivity(id as string),
    enabled: !!id && enabled,
  });
}
