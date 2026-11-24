// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrafficProgressBar from './TrafficProgressBar';
import ConnectDeviceTile from './ConnectDeviceTile';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../utils/formatTraffic', () => ({ formatTraffic: (value: number) => `${value} GB` }));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('../../hooks/useTrafficZone', () => ({
  useTrafficZone: () => ({ mainVar: 'purple', mainVarRaw: '1,2,3' }),
}));
afterEach(cleanup);
describe('traffic precision', () => {
  it.each([
    [0, 0],
    [0.37, 0.0037],
    [-5, 0],
    [130, 1],
    [NaN, 0],
  ])('represents %s percent without a minimum artificial fill', (percent, scale) => {
    const { container } = render(
      <TrafficProgressBar usedGb={0} limitGb={300} percent={percent} isUnlimited={false} compact />,
    );
    const fill = container.querySelector<HTMLElement>('[style*="scaleX"]');
    expect(fill?.style.transform).toBe(`scaleX(${scale})`);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      String(Math.round(scale * 100)),
    );
  });
});
describe('device actions', () => {
  it.each([
    [5, '/connection'],
    [6, '/subscriptions/7'],
  ])('keeps an action available with %s devices', (connected, path) => {
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ConnectDeviceTile
                subscription={{ id: 7, device_limit: 6, subscription_url: 'test' }}
                connectedDevices={connected}
              />
            }
          />
          <Route path="*" element={<p>{path}</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(path)).toBeTruthy();
  });
});
