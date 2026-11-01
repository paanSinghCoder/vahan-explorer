import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ApiError, Meta, ReportFilters, ReportResult, StateDetail } from '../shared/types';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) throw new Error((body as ApiError).error ?? `Request failed (${res.status})`);
  return body as T;
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => getJson<Meta>('/api/meta'),
    staleTime: Infinity,
  });
}

export function useStateDetail(state: string | undefined) {
  return useQuery({
    queryKey: ['state', state],
    queryFn: () => getJson<StateDetail>(`/api/state/${state}`),
    enabled: !!state && state !== '-1',
    staleTime: Infinity,
  });
}

export function useReport(filters: ReportFilters | null) {
  return useQuery({
    queryKey: ['report', filters],
    queryFn: () =>
      getJson<ReportResult>('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      }),
    enabled: !!filters,
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
