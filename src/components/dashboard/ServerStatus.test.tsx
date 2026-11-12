// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ServerStatus, { fetchStatus } from './ServerStatus';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const sample = {
  ok: true,
  status: 'ok',
  load: { now: 21, series: [20, 21] },
  servers: [
    {
      name: 'Белые списки',
      online: true,
      load: [20, 21],
      mobile: {
        ok: 1,
        total: 1,
        at: 1794492639,
        districts: [
          { region: 'cfo', operator: 'mts', status: 'up' },
          { region: 'sfo', operator: 'mts', status: 'no_modem' },
        ],
      },
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ServerStatus integration', () => {
  it('requests only the same-origin proxy without an API key or session credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(sample)));
    vi.stubGlobal('fetch', fetcher);
    await fetchStatus();
    expect(fetcher).toHaveBeenCalledWith('/status-api/public', {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: undefined,
    });
  });

  it.each([401, 429, 503])(
    'rejects HTTP %s instead of treating it as a healthy response',
    async (code) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{"ok":false}', { status: code })),
      );
      await expect(fetchStatus()).rejects.toThrow(`status ${code}`);
    },
  );

  it('rejects a successful HTTP response with an invalid payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":false}')));
    await expect(fetchStatus()).rejects.toThrow('Invalid status response');
  });

  it('shows district/operator coverage but removes stale green status after a failed refresh', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(sample))));
    vi.stubGlobal('fetch', fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <ServerStatus />
      </QueryClientProvider>,
    );
    await screen.findByText('Проверки успешны: 1/1');
    expect(screen.getByText('Без замера: 1')).toBeTruthy();
    expect(screen.getByText('2 округа: ЦФО · СФО')).toBeTruthy();
    expect(screen.getByRole('cell', { name: /СФО, МТС: Нет модема/ })).toBeTruthy();
    fetcher.mockImplementation(() =>
      Promise.resolve(new Response('{"ok":false}', { status: 503 })),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['server-status'] });
    });
    await waitFor(() => expect(screen.queryByText('Все работают')).toBeNull());
    expect(screen.getByText(/Не удалось обновить мониторинг/)).toBeTruthy();
    client.clear();
  });
});
