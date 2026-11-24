import { describe, expect, it } from 'vitest';
import { combinePromoDiscount } from '@/hooks/usePromoDiscount';
import type { Tariff, TariffPeriod } from '@/types';
import {
  entryPeriod,
  periodSaving,
  renewalDate,
  tariffCopy,
  tariffPriceIdentity,
} from './tariffPresentation';

const period = (days: number, price: number, extra = 0): TariffPeriod =>
  ({ days, price_kopeks: price, extra_devices_count: extra }) as TariffPeriod;
const apply = (price: number, original?: number | null) => combinePromoDiscount(price, original, 0);
describe('actual tariff prices', () => {
  it('pairs the lowest purchase amount with its actual period, independent of order', () => {
    const p = [period(180, 97000), period(90, 51000), period(30, 18000)];
    expect(entryPeriod({ periods: p }, apply)?.days).toBe(30);
    expect(entryPeriod({ periods: [period(30, 9000), period(90, 0)] }, apply)?.days).toBe(90);
  });
  it('calculates savings from user prices and applies promo only once', () => {
    const p = [period(30, 18000), period(180, 97000)];
    expect(periodSaving(p[1], p, apply)).toBe(11000);
    const promo = (price: number, original?: number | null) =>
      combinePromoDiscount(price, original, 50);
    expect(periodSaving(p[1], p, promo)).toBe(5500);
  });
  it('does not invent savings without a comparable monthly bundle', () => {
    for (const p of [
      [period(180, 97000)],
      [period(30, 0), period(180, 100)],
      [period(30, 100), period(180, 700)],
      [period(30, 100), period(180, 500, 2)],
      [period(30, 100), period(45, 120)],
    ]) {
      expect(periodSaving(p[p.length - 1], p, apply)).toBeNull();
    }
  });
  it('detects a free-to-paid or device-limit change before confirmation', () => {
    const t = { periods: [period(30, 0)], device_limit: 3 } as Tariff;
    expect(tariffPriceIdentity(t)).not.toBe(
      tariffPriceIdentity({ ...t, periods: [period(30, 100)] }),
    );
    expect(tariffPriceIdentity(t)).not.toBe(tariffPriceIdentity({ ...t, device_limit: 2 }));
  });
  it('previews extension only for the same active non-trial tariff', () => {
    const sub = {
      tariff_id: 2,
      end_date: '2026-12-01T10:00:00Z',
      is_trial: false,
    } as import('@/types').Subscription;
    const now = Date.parse('2026-11-24T00:00:00Z');
    expect(renewalDate(sub, 2, 30, now)?.toISOString()).toBe('2026-12-31T10:00:00.000Z');
    expect(renewalDate(sub, 3, 30, now)).toBeNull();
    expect(renewalDate({ ...sub, is_trial: true }, 2, 30, now)).toBeNull();
    expect(renewalDate({ ...sub, end_date: 'invalid' }, 2, 30, now)).toBeNull();
  });
});
describe('operator copy', () => {
  const description =
    'Расширенный тариф на 3 устройства с Wi-Fi и LTE локациями.\nРекламы на YouTube не будет\nУмная маршрутизация (отключать VPN не нужно)';
  it('keeps staff humor and terms intact', () => {
    const copy = tariffCopy({ name: 'XSG SQUAD', description });
    expect(copy.tagline).toContain('Wi-Fi и LTE');
    expect(copy.features[0].text).toBe('Рекламы на YouTube не будет');
  });
  it('does not infer auto WiFi/LTE from smart routing for public plans', () => {
    const copy = tariffCopy({ name: 'Гипердрайв', description });
    expect(copy.tagline).not.toContain('LTE локациями');
    expect(copy.features.map((f) => f.text)).toEqual([
      'YouTube без рекламы: результат зависит от сервера и приложения',
      'Умная маршрутизация',
    ]);
  });
});
