// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TrafficRefreshButton from './TrafficRefreshButton';
import { formatTrafficPercent } from '../../utils/formatTraffic';
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; count?: number }) =>
      options?.defaultValue?.replace('{{count}}', String(options.count)) ?? key,
  }),
}));
afterEach(cleanup);
it('waits for a manual click after cooldown ends and blocks requests while pending', () => {
  const refresh = vi.fn();
  const { rerender } = render(
    <TrafficRefreshButton cooldown={30} pending={false} onRefresh={refresh} />,
  );
  const button = screen.getByRole('button');
  expect(button.querySelector('svg')).toBeTruthy();
  expect(button.textContent).toBe('');
  expect(button.title).toContain('30 сек.');
  fireEvent.click(screen.getByRole('button'));
  expect(refresh).not.toHaveBeenCalled();
  expect(button.getAttribute('aria-label')).toBe('subscriptionCommand.refreshTraffic');
  rerender(<TrafficRefreshButton cooldown={0} pending={false} onRefresh={refresh} />);
  expect(button.querySelector('svg')).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button'));
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender(<TrafficRefreshButton cooldown={0} pending onRefresh={refresh} />);
  expect(button.querySelector('svg')).toBeTruthy();
  expect(button.getAttribute('aria-busy')).toBe('true');
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
