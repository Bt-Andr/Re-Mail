import { useInfiniteQuery } from '@tanstack/react-query';
import { listThreads, type ThreadListParams } from '../api/threads';

const PAGE_SIZE = 30;

export function useThreads(params: Omit<ThreadListParams, 'take' | 'skip'>) {
  const query = useInfiniteQuery({
    queryKey: ['threads', params.folder, params.status ?? 'all', params.canal ?? 'all', params.q ?? '', params.account ?? 'all'],
    queryFn: ({ pageParam }) => listThreads({ ...params, take: PAGE_SIZE, skip: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined),
    refetchInterval: 30_000,
  });

  return {
    ...query,
    threads: query.data?.pages.flat() ?? [],
  };
}
