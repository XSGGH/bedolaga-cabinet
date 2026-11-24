import type { ApplyPromoDiscount } from '@/hooks/usePromoDiscount';
import type { Subscription, Tariff, TariffPeriod } from '@/types';
import { buildTrafficModel, parseTariffDescription } from './tariffCardModel';

/** Presentation only: do not modify operator data or the access policy. */
export function tariffCopy(tariff: Pick<Tariff, 'name' | 'description'>) {
  const parsed = parseTariffDescription(tariff.description);
  if (/^XSG\s+SQUAD$/i.test(tariff.name.trim())) return parsed;
  return {
    ...parsed,
    tagline: parsed.tagline?.replace(
      /Расширенный тариф на \d+ устройств[ао]? с Wi-Fi и LTE локациями\.?/i,
      'Безлимит на обычных серверах и дополнительные возможности для мобильного интернета.',
    ),
    features: parsed.features
      // The structured traffic row explains this without repeating a blanket promise.
      .filter(
        (f) =>
          !/^(?:Не будет работать|Работает) на мобильных сетях с включ[её]нными белыми списками/i.test(
            f.text,
          ),
      )
      .map((f) => ({
        ...f,
        text: f.text
          .replace(
            /Рекламы на YouTube не будет\.?/i,
            'YouTube без рекламы: результат зависит от сервера и приложения',
          )
          .replace(/Умная маршрутизация \(отключать VPN не нужно\)/i, 'Умная маршрутизация'),
      })),
  };
}

export function entryPeriod(tariff: Pick<Tariff, 'periods'>, apply: ApplyPromoDiscount) {
  return tariff.periods
    .filter((p) => p.days > 0 && Number.isFinite(p.price_kopeks) && p.price_kopeks >= 0)
    .reduce<TariffPeriod | null>((best, p) => {
      if (!best) return p;
      const price = apply(p.price_kopeks, p.original_price_kopeks).price;
      const previous = apply(best.price_kopeks, best.original_price_kopeks).price;
      return price < previous || (price === previous && p.days < best.days) ? p : best;
    }, null);
}

/** Compare only equivalent bundles at the user's actual monthly price. */
export function periodSaving(
  period: TariffPeriod,
  periods: TariffPeriod[],
  apply: ApplyPromoDiscount,
): number | null {
  const monthly = periods.find((p) => p.days === 30);
  if (
    !monthly ||
    period.days <= 30 ||
    period.days % 30 !== 0 ||
    (monthly.extra_devices_count ?? 0) !== (period.extra_devices_count ?? 0)
  )
    return null;
  const baseline = apply(monthly.price_kopeks, monthly.original_price_kopeks).price;
  const price = apply(period.price_kopeks, period.original_price_kopeks).price;
  if (![baseline, price].every(Number.isFinite) || baseline <= 0 || price < 0) return null;
  const saving = Math.round(baseline * (period.days / 30) - price);
  return saving > 0 ? saving : null;
}

/** Compact checkout reminder, derived from the existing server/traffic model. */
export function trafficReminder(tariff: Tariff): string[] {
  const traffic = buildTrafficModel(tariff);
  const metered = traffic.limitedOnlyMetered;
  const period = tariff.traffic_reset_mode === 'MONTH' ? ' в месяц' : '';
  return [
    traffic.unlimitedScope
      ? traffic.unlimitedScope === 'regular' ||
        !traffic.unlimitedServers.some((s) => s.includes('📡'))
        ? 'Безлимит на обычных серверах'
        : 'Безлимит на доступных серверах'
      : '',
    traffic.hasLimit
      ? `${tariff.traffic_limit_label}${period} ${metered ? 'на специальных серверах' : 'на доступных серверах'}`
      : '',
  ].filter(Boolean);
}

export function tariffPriceIdentity(tariff: Tariff) {
  return JSON.stringify([
    tariff.is_available,
    tariff.device_limit,
    tariff.extra_devices_count,
    tariff.traffic_limit_gb,
    tariff.periods.map((p) => [
      p.days,
      p.price_kopeks,
      p.original_price_kopeks,
      p.extra_devices_count,
    ]),
    tariff.is_daily,
    tariff.daily_price_kopeks,
    tariff.original_daily_price_kopeks,
    tariff.custom_days_enabled,
    tariff.price_per_day_kopeks,
    tariff.original_price_per_day_kopeks,
    tariff.min_days,
    tariff.max_days,
    tariff.custom_traffic_enabled,
    tariff.traffic_price_per_gb_kopeks,
    tariff.min_traffic_gb,
    tariff.max_traffic_gb,
  ]);
}

/** Same-tariff active renewal adds days to the existing end (extend_subscription). */
export function renewalDate(
  subscription: Subscription | null | undefined,
  tariffId: number,
  days: number,
  now = Date.now(),
): Date | null {
  if (
    !subscription ||
    subscription.tariff_id !== tariffId ||
    subscription.is_trial ||
    !Number.isFinite(days) ||
    days <= 0
  )
    return null;
  const end = new Date(subscription.end_date).getTime();
  if (!Number.isFinite(end) || end <= now) return null;
  return new Date(end + days * 86_400_000);
}
