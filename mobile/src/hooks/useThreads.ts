import { useQuery } from '@tanstack/react-query';
import { listThreads, type ThreadListParams } from '../api/threads';

export function useThreads(params: ThreadListParams) {
  return useQuery({
    queryKey: ['threads', params.folder, params.status ?? 'all', params.canal ?? 'all'],
    queryFn: () => listThreads(params),
    refetchInterval: 30_000,
  });
}
