// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { Subscription } from '@/types';
import { AutopayToggle } from './AutopayToggle';
const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('@/api/subscription', () => ({ subscriptionApi: { updateAutopay: update } }));
vi.mock('@/utils/legacySubscription', () => ({ showsAutopayToggle: () => true }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : (options?.defaultValue ?? key),
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const sub = { autopay_enabled: false, autopay_days_before: 3 } as Subscription;
function show() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AutopayToggle subscription={sub} subscriptionId={7} accentColor="purple" offColor="gray" />
    </QueryClientProvider>,
  );
  return client;
}
it('keeps the confirmed state and shows an error when saving fails', async () => {
  update.mockRejectedValue(new Error('offline'));
  show();
  const toggle = screen.getByRole('switch');
  fireEvent.click(toggle);
  await screen.findByRole('alert');
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(update).toHaveBeenCalledWith(true, undefined, 7);
  expect((toggle as HTMLButtonElement).disabled).toBe(false);
});
it('prevents repeated changes while the request is pending', async () => {
  let finish!: () => void;
  update.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const client = show();
  const toggle = screen.getByRole('switch');
  fireEvent.click(toggle);
  await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(true));
  fireEvent.click(toggle);
  expect(update).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
  client.clear();
});
