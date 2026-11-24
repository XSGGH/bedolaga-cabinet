// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TrafficRefreshButton, { formatRefreshCooldown } from './TrafficRefreshButton';
import { formatTrafficPercent } from '../../utils/formatTraffic';
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; count?: number }) =>
      options?.defaultValue?.replace('{{count}}', String(options.count)) ?? key,
  }),
}));
afterEach(cleanup);
it.each([
  [30, '0:30'],
  [61, '1:01'],
  [0, '0:00'],
  [-2, '0:00'],
  [NaN, '0:00'],
])('formats cooldown %s as %s', (seconds, expected) =>
  expect(formatRefreshCooldown(seconds)).toBe(expected),
);
it('waits for a manual click after cooldown ends and blocks requests while pending', () => {
  const refresh = vi.fn();
  const { rerender } = render(
    <TrafficRefreshButton cooldown={30} pending={false} onRefresh={refresh} />,
  );
  expect(screen.getByText('0:30')).toBeTruthy();
  fireEvent.click(screen.getByRole('button'));
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('button').getAttribute('aria-label')).toContain('30 сек.');
  rerender(<TrafficRefreshButton cooldown={0} pending={false} onRefresh={refresh} />);
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button'));
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender(<TrafficRefreshButton cooldown={0} pending onRefresh={refresh} />);
  fireEvent.click(screen.getByRole('button'));
  expect(refresh).toHaveBeenCalledTimes(1);
});
it.each([
  [0, '0%'],
  [(1.1 / 300) * 100, '0,4%'],
  [0.01, '<0,1%'],
  [100, '100%'],
  [103.3, '103,3%'],
  [NaN, '—'],
])('formats shared traffic percentage %s', (value, expected) =>
  expect(formatTrafficPercent(value, 'ru-RU')).toBe(expected),
);
