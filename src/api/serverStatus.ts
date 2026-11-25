import type {
  PublicStatus,
  StatusEvents,
  StatusSummary,
} from '@/components/dashboard/serverStatusModel';

async function readStatus(
  path: 'public' | 'summary' | 'events',
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetch(`/status-api/${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    signal,
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function fetchStatus(signal?: AbortSignal): Promise<PublicStatus> {
  const data = (await readStatus('public', signal)) as PublicStatus;
  if (
    !data?.ok ||
    !Array.isArray(data.servers) ||
    !Array.isArray(data.load?.series) ||
    data.servers.some((server) => !server || typeof server.name !== 'string')
  ) {
    throw new Error('Invalid status response');
  }
  return data;
}
export async function fetchStatusSummary(signal?: AbortSignal): Promise<StatusSummary> {
  const data = (await readStatus('summary', signal)) as StatusSummary;
  if (
    !data ||
    !Array.isArray(data.servers) ||
    data.servers.some((s) => !s || typeof s.name !== 'string')
  )
    throw new Error('Invalid summary response');
  return data;
}
export async function fetchStatusEvents(signal?: AbortSignal): Promise<StatusEvents> {
  const data = (await readStatus('events', signal)) as StatusEvents;
  if (!data || !Array.isArray(data.feed) || !Array.isArray(data.history))
    throw new Error('Invalid events response');
  return data;
}
