// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it.each([
    [false, 'Обнаружены проблемы', 'Недоступен'],
    [null, 'Не удалось обновить статус серверов', 'Нет данных'],
  ])(
    'does not claim all servers are healthy when availability is %s',
    async (online, headline, state) => {
      const payload = {
        ...sample,
        servers: [...sample.servers, { name: 'Германия', online, load: [] }],
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
      render(
        <QueryClientProvider client={client}>
          <ServerStatus />
        </QueryClientProvider>,
      );
      expect(await screen.findByText(headline)).toBeTruthy();
      expect(screen.getByText(state)).toBeTruthy();
      expect(screen.queryByText('Все серверы работают штатно')).toBeNull();
      client.clear();
    },
  );
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

  it('opens coverage on demand, restores focus and removes stale green status after a failed refresh', async () => {
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
    const coverage = await screen.findByRole('button', { name: /Мобильные сети: 1 из 1/ });
    expect(screen.getByRole('button', { name: /2 округа · 1 оператор/ })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(coverage);
    const dialog = screen.getByRole('dialog', { name: 'Мобильные сети' });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText(/Без результата: 1/)).toBeTruthy();
    expect(screen.getByRole('cell', { name: /СФО, МТС: Нет результата/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(coverage));
    fetcher.mockImplementation(() =>
      Promise.resolve(new Response('{"ok":false}', { status: 503 })),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['server-status'] });
    });
    await waitFor(() => expect(screen.queryByText('Все серверы работают штатно')).toBeNull());
    expect(screen.getByText(/Не удалось обновить мониторинг/)).toBeTruthy();
    client.clear();
  });
});
