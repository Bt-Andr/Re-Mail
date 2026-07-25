import { useQuery } from '@tanstack/react-query';
import { getSenders } from '../api/mail';

export function useSenders() {
  const query = useQuery({ queryKey: ['senders'], queryFn: getSenders });
  return { senders: query.data ?? [], loading: query.isLoading, refetch: query.refetch };
}
