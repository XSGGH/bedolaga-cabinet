// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { Subscription } from '@/types';
import { DeviceTopupSheet } from './DeviceTopupSheet';
import { DeviceReductionSheet } from './DeviceReductionSheet';
import { TrafficTopupSheet } from './TrafficTopupSheet';
const { price, reduction, packages } = vi.hoisted(() => ({
  price: vi.fn(),
  reduction: vi.fn(),
  packages: vi.fn(),
}));
vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getDevicePrice: price,
    getDeviceReductionInfo: reduction,
    getTrafficPackages: packages,
  },
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatAmount: (n: number) => String(n), currencySymbol: '₽' }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : (options?.defaultValue ?? key),
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const subscription = {
  id: 7,
  device_limit: 6,
  traffic_limit_gb: 300,
  traffic_used_gb: 1,
  is_active: true,
} as Subscription;
function show(kind: string, available: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } },
  });
  const info = available
    ? {
        available: true,
        current_device_limit: 6,
        min_device_limit: 1,
        connected_devices_count: 2,
        max_device_limit: 10,
      }
    : { available: false, reason: 'Недоступно на вашем тарифе' };
  const traffic = available ? [{ gb: 10, price_kopeks: 100, is_unlimited: false }] : [];
  client.setQueryData(['device-price', 1, 7], info);
  client.setQueryData(['device-reduction-info', 7], info);
  client.setQueryData(['traffic-packages', 7], traffic);
  const common = {
    open: available,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    subscriptionId: 7,
    isDark: true,
  };
  const element =
    kind === 'places' ? (
      <DeviceTopupSheet
        {...common}
        subscription={subscription}
        devicesToAdd={1}
        onDevicesToAddChange={vi.fn()}
        purchaseOptions={undefined}
      />
    ) : kind === 'reduce' ? (
      <DeviceReductionSheet
        {...common}
        subscriptionPresent
        targetDeviceLimit={5}
        onTargetDeviceLimitChange={vi.fn()}
      />
    ) : (
      <TrafficTopupSheet
        {...common}
        subscription={subscription}
        selectedTrafficPackage={null}
        onSelectedTrafficPackageChange={vi.fn()}
        purchaseOptions={undefined}
      />
    );
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
it.each(['places', 'reduce', 'traffic'])(
  'shows a compact known-unavailable state for %s without opening a form',
  (kind) => {
    show(kind, false);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(price).not.toHaveBeenCalled();
    expect(reduction).not.toHaveBeenCalled();
    expect(packages).not.toHaveBeenCalled();
    expect(screen.queryByText('subscription.additionalOptions.trafficWarning')).toBeNull();
  },
);
it.each(['places', 'reduce', 'traffic'])('preserves the available %s form', (kind) => {
  show(kind, true);
  expect(screen.getByRole('heading')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
