// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ru from '@/locales/ru.json';
import type { SpinResult, WheelConfig } from '@/api/wheel';

const state = vi.hoisted(() => ({
  native: false,
  config: vi.fn(),
  history: vi.fn(),
  recent: vi.fn(),
  spin: vi.fn(),
  invoice: vi.fn(),
  openInvoice: vi.fn(),
  impact: vi.fn(),
  notification: vi.fn(),
}));
vi.mock('@/api/wheel', () => ({
  wheelApi: {
    getConfig: state.config,
    getHistory: state.history,
    getRecentWins: state.recent,
    spin: state.spin,
    createStarsInvoice: state.invoice,
  },
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({
    capabilities: { hasInvoice: state.native },
    openInvoice: state.openInvoice,
    haptic: { impact: state.impact },
  }),
  useHaptic: () => ({ notification: state.notification, impact: state.impact }),
}));
vi.mock('@/platform/hooks/useNotify', () => ({ useNotify: () => ({ warning: vi.fn() }) }));
vi.mock('@/components/wheel/FortuneWheel', () => ({
  default: ({
    isSpinning,
    targetRotation,
    onSpinComplete,
  }: {
    isSpinning: boolean;
    targetRotation: number | null;
    onSpinComplete: () => void;
  }) => (
    <button
      data-testid="animation"
      data-target={targetRotation ?? 'none'}
      disabled={!isSpinning || targetRotation === null}
      onClick={onSpinComplete}
    >
      Завершить анимацию
    </button>
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | Record<string, unknown>) => {
      const opts = typeof options === 'object' ? options : {};
      let path = key;
      if (typeof opts.count === 'number')
        path += `_${new Intl.PluralRules('ru').select(opts.count)}`;
      const get = (p: string) =>
        p.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ru);
      const value =
        get(path) ?? get(key) ?? (typeof options === 'string' ? options : opts.defaultValue) ?? key;
      return String(value).replace(/{{(\w+)}}/g, (_, name) => String(opts[name] ?? ''));
    },
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
import Wheel from './Wheel';

const prizes = [
  {
    id: 1,
    prize_type: 'subscription_days',
    display_name: '4 дня подписки',
    emoji: '📅',
    color: '#22cc88',
  },
  { id: 2, prize_type: 'nothing', display_name: 'Не повезло', emoji: '—', color: '#444444' },
];
let config: WheelConfig;
const won = {
  success: true,
  prize_id: 1,
  prize_type: 'subscription_days',
  prize_value: 4,
  prize_display_name: '4 дня подписки',
  emoji: '📅',
  color: '#22cc88',
  rotation_degrees: 270,
  message: 'Начислено 4 дня',
  promocode: null,
  error: null,
} as SpinResult;
const historyItem = {
  id: 10,
  prize_id: 1,
  prize_type: 'subscription_days',
  prize_display_name: '4 дня подписки',
  prize_value: 4,
  payment_type: 'subscription_days',
  payment_amount: 1,
  emoji: '📅',
  color: '#22cc88',
  created_at: '2026-11-24T08:00:00Z',
};
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  state.native = false;
  config = {
    is_enabled: true,
    name: 'Колесо удачи',
    spin_cost_days_enabled: true,
    spin_cost_days: 1,
    spin_cost_stars_enabled: false,
    spin_cost_stars: null,
    prizes,
    daily_limit: 1,
    user_spins_today: 0,
    can_spin: true,
    can_pay_days: true,
    has_subscription: true,
    eligible_subscriptions: [{ id: 7, tariff_name: 'Тариф', days_left: 100 }],
  } as WheelConfig;
  state.config.mockImplementation(async () => config);
  state.recent.mockResolvedValue([]);
  state.history.mockResolvedValue({ items: [], total: 0, pages: 1, page: 1, per_page: 10 });
  state.spin.mockResolvedValue(won);
  state.invoice.mockResolvedValue({
    invoice_url: 'https://example.test/invoice',
    stars_amount: 10,
  });
  state.openInvoice.mockResolvedValue('paid');
  vi.stubGlobal('open', () => ({ location: { href: '' }, close: () => {} }));
});
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <Wheel />
    </QueryClientProvider>,
  );
  await screen.findByText('Стоимость вращения:');
  return client;
}

it('states the cost before the click and does not load closed history', async () => {
  await show();
  expect(screen.getByText('1 день подписки')).toBeTruthy();
  expect(state.history).not.toHaveBeenCalled();
  expect(state.spin).not.toHaveBeenCalled();
});
it('sends only one request for a double click and waits for actual animation completion', async () => {
  let resolve!: (value: SpinResult) => void;
  state.spin.mockReturnValue(
    new Promise<SpinResult>((done) => {
      resolve = done;
    }),
  );
  const client = await show();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const spin = screen.getByRole('button', { name: 'КРУТИТЬ!' });
  act(() => {
    spin.click();
    spin.click();
  });
  await waitFor(() => expect(state.spin).toHaveBeenCalledTimes(1));
  expect(state.spin).toHaveBeenCalledWith('subscription_days', 7);
  expect(screen.getAllByText('+4 дня подписки')).toHaveLength(1);
  await act(async () => resolve(won));
  expect(screen.getAllByText('+4 дня подписки')).toHaveLength(1);
  fireEvent.click(screen.getByTestId('animation'));
  expect(screen.getAllByText('+4 дня подписки')).toHaveLength(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['balance'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['subscription'] });
});
it('does not spin with insufficient days even if another payment method is affordable', async () => {
  config.can_pay_days = false;
  config.can_spin = true;
  await show();
  expect((screen.getByRole('button', { name: 'КРУТИТЬ!' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(state.spin).not.toHaveBeenCalled();
});
it('shows the daily limit once and does not guess a reset time', async () => {
  config.user_spins_today = 1;
  config.can_spin = false;
  await show();
  expect(screen.getAllByText('Сегодня вращения закончились')).toHaveLength(1);
  expect(screen.getByText('0 из 1')).toBeTruthy();
  expect(state.spin).not.toHaveBeenCalled();
});
it('refreshes after a network failure and never retries a charge automatically', async () => {
  state.spin.mockRejectedValue(new Error('offline'));
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'КРУТИТЬ!' }));
  await screen.findByText(
    'Не удалось получить результат. Проверьте историю перед повторным вращением.',
  );
  expect(state.spin).toHaveBeenCalledTimes(1);
});
it('separates stored reward and cost, preserves promo snapshots and paginates read-only', async () => {
  state.history.mockImplementation(async (page: number) => ({
    items: Array.from({ length: 4 }, (_, i) => ({
      ...historyItem,
      id: i + 10,
      prize_type: i === 0 ? 'promocode' : 'subscription_days',
      prize_display_name: i === 0 ? 'Промокод: 20 ₽ + 5 дней' : '4 дня подписки',
    })),
    total: 14,
    pages: 2,
    page,
    per_page: 10,
  }));
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'История вращений' }));
  await screen.findByText('Промокод: 20 ₽ + 5 дней');
  expect(screen.getAllByText('Стоимость вращения: 1 день подписки')).toHaveLength(3);
  expect(screen.getByText('Награда — промокод')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Показать ещё 1' }));
  expect(screen.getAllByText('Стоимость вращения: 1 день подписки')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await waitFor(() => expect(state.history).toHaveBeenCalledWith(2, 10));
  expect(state.spin).not.toHaveBeenCalled();
});
it('keeps a browser invoice pending and never labels opening it as a win', async () => {
  config.spin_cost_stars_enabled = true;
  config.spin_cost_stars = 10;
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'КРУТИТЬ!' }));
  const pay = screen.getByRole('button', { name: 'Оплатить 10 ⭐' });
  act(() => {
    pay.click();
    pay.click();
  });
  await screen.findByText('Результат пока не подтверждён');
  expect(state.invoice).toHaveBeenCalledTimes(1);
  expect(state.history.mock.invocationCallOrder[0]).toBeLessThan(
    state.invoice.mock.invocationCallOrder[0],
  );
  expect(screen.queryByText('Поздравляем!')).toBeNull();
  state.history.mockResolvedValue({
    items: [{ ...historyItem, payment_type: 'telegram_stars', payment_amount: 10 }],
    total: 1,
    pages: 1,
    page: 1,
    per_page: 1,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Обновить результат оплаты' }));
  await waitFor(() =>
    expect(screen.getByTestId('animation').getAttribute('data-target')).not.toBe('none'),
  );
  fireEvent.click(screen.getByTestId('animation'));
  expect(screen.getAllByText('+4 дня подписки')).toHaveLength(2);
  expect(state.invoice).toHaveBeenCalledTimes(1);
});
it('uses a pre-payment baseline so an immediately paid Stars reward is not missed', async () => {
  state.native = true;
  config.spin_cost_stars_enabled = true;
  config.spin_cost_stars = 10;
  state.history.mockResolvedValueOnce({ items: [], total: 0 }).mockResolvedValue({
    items: [{ ...historyItem, payment_type: 'telegram_stars', payment_amount: 10 }],
    total: 1,
  });
  await show();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'КРУТИТЬ!' }));
  fireEvent.click(screen.getByRole('button', { name: 'Оплатить 10 ⭐' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2600);
  });
  expect(screen.getByTestId('animation').getAttribute('data-target')).not.toBe('none');
  fireEvent.click(screen.getByTestId('animation'));
  expect(screen.getAllByText('+4 дня подписки')).toHaveLength(2);
  expect(state.invoice).toHaveBeenCalledTimes(1);
});

it('does not animate or congratulate when a paid Stars result is still unknown', async () => {
  state.native = true;
  config.spin_cost_stars_enabled = true;
  config.spin_cost_stars = 10;
  await show();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'КРУТИТЬ!' }));
  fireEvent.click(screen.getByRole('button', { name: 'Оплатить 10 ⭐' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16000);
  });
  expect(screen.getByText('Результат пока не подтверждён')).toBeTruthy();
  expect(screen.getByTestId('animation').getAttribute('data-target')).toBe('none');
  expect(state.notification).not.toHaveBeenCalledWith('success');
  expect(state.invoice).toHaveBeenCalledTimes(1);
});
it('cancelling the native invoice does not spin and releases the control', async () => {
  state.native = true;
  config.spin_cost_stars_enabled = true;
  config.spin_cost_stars = 10;
  state.openInvoice.mockResolvedValue('cancelled');
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'КРУТИТЬ!' }));
  fireEvent.click(screen.getByRole('button', { name: 'Оплатить 10 ⭐' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'КРУТИТЬ!' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  expect(state.spin).not.toHaveBeenCalled();
  expect(screen.queryByText('Поздравляем!')).toBeNull();
});
it('an unavailable history remains a read-only recoverable error', async () => {
  state.history
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [], total: 0, pages: 1 });
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'История вращений' }));
  await screen.findByText('Не удалось загрузить историю.');
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await screen.findByText('История вращений пуста.');
  expect(state.spin).not.toHaveBeenCalled();
});
it('uses the awarded prize when a stale server angle points at another sector', async () => {
  state.spin.mockResolvedValue({ ...won, rotation_degrees: 90 });
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'КРУТИТЬ!' }));
  await waitFor(() =>
    expect(screen.getByTestId('animation').getAttribute('data-target')).not.toBe('none'),
  );
  const angle = Number(screen.getByTestId('animation').getAttribute('data-target'));
  expect(Math.floor(((360 - (angle % 360)) % 360) / 180)).toBe(0);
});
