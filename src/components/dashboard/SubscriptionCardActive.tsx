import { uiLocale } from '@/utils/uiLocale';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import TrafficProgressBar from './TrafficProgressBar';
import Sparkline from './Sparkline';
import ConnectDeviceTile from './ConnectDeviceTile';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { useTheme } from '../../hooks/useTheme';
import { useTrafficZone } from '../../hooks/useTrafficZone';
import { formatTraffic } from '../../utils/formatTraffic';
import { getGlassColors } from '../../utils/glassTheme';
import { CalendarIcon, RefreshIcon, SparklesIcon } from '@/components/icons';
import type { Subscription } from '../../types';

interface SubscriptionCardActiveProps {
  subscription: Subscription;
  trafficData: {
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null;
  refreshTrafficMutation: UseMutationResult<unknown, unknown, void, unknown>;
  trafficRefreshCooldown: number;
  connectedDevices: number;
}

export default function SubscriptionCardActive({
  subscription,
  trafficData,
  refreshTrafficMutation,
  trafficRefreshCooldown,
  connectedDevices,
}: SubscriptionCardActiveProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const usedPercent = trafficData?.traffic_used_percent ?? subscription.traffic_used_percent;
  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const isUnlimited = trafficData?.is_unlimited ?? subscription.traffic_limit_gb === 0;
  const zone = useTrafficZone(usedPercent);
  // Спокойная зона — зелёная плашка, как в макете; остальные зоны своего цвета.
  const pillColor = zone.colorKey === 'accent' ? 'var(--color-success-400)' : zone.mainVarRaw;
  const animatedPercent = useAnimatedNumber(usedPercent);

  const formattedDate = new Date(subscription.end_date).toLocaleDateString(uiLocale());
  const daysLeft = subscription.days_left;

  // Sparkline placeholder data (hidden until API provides daily usage)
  const dailyUsage: number[] = [];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: g.cardBg,
        border: `1px solid ${g.cardBorder}`,
        borderRadius: 'var(--bento-radius-lg)',
        boxShadow: g.shadow,
      }}
    >
      {/* Акцентная линия сверху — единственный «декор» карточки */}
      <div
        aria-hidden="true"
        className="h-[3px]"
        style={{
          background:
            'linear-gradient(90deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-700)) 60%, transparent)',
        }}
      />

      <div className="p-6 sm:p-8">
        {/* ─── Тариф и остаток — самое важное, поэтому первым и крупно ─── */}
        {/* `min-w-0` нужен обеим колонкам: без него длинное имя тарифа
            («🟡 Компания - 10 устройств») выпихивает «Осталось» за край. */}
        <div className="mb-7 flex items-end justify-between gap-5">
          <Link
            to={`/subscriptions/${subscription.id}`}
            className="min-w-0 flex-1 transition-opacity hover:opacity-90"
          >
            <div className="xsg-eyebrow mb-2 flex items-center gap-2">
              {t('dashboard.tariff')}
              {subscription.is_trial && (
                <span className="inline-flex items-center gap-1 rounded-md border border-accent-400/30 bg-accent-400/10 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-accent-400">
                  <SparklesIcon className="h-2.5 w-2.5" />
                  {t('subscription.trialStatus')}
                </span>
              )}
            </div>
            <div className="line-clamp-2 min-w-0 break-words text-2xl font-bold leading-tight tracking-tight text-dark-50 sm:text-[32px]">
              {subscription.tariff_name || t('subscription.currentPlan')}
            </div>
            <div className="mt-1.5 text-[13px] text-dark-400">
              {t('dashboard.validUntil', { date: formattedDate })}
            </div>
          </Link>

          <div className="shrink-0 text-right">
            <div className="xsg-eyebrow mb-2 flex items-center justify-end gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {t('dashboard.remaining')}
            </div>
            <div className="flex items-baseline justify-end gap-1.5">
              <span
                className="text-[32px] font-bold leading-none tracking-tight tabular-nums"
                style={{
                  color: daysLeft <= 3 ? 'rgb(var(--color-warning-400))' : g.text,
                }}
              >
                {daysLeft}
              </span>
              <span className="text-sm font-medium text-dark-400">
                {t('subscription.daysShort')}
              </span>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="mb-6 h-px bg-accent-500/15" />

        {/* ─── Расход трафика ─── */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="text-base font-bold tracking-tight text-dark-50">
              {t('dashboard.trafficUsageTitle')}
            </h2>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{
                color: `rgb(${pillColor})`,
                background: `rgba(${pillColor}, 0.12)`,
                border: `1px solid rgba(${pillColor}, 0.35)`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: `rgb(${pillColor})` }}
                aria-hidden="true"
              />
              {isUnlimited ? t('dashboard.unlimited') : t(zone.labelKey)}
            </span>
          </div>

          <div className="flex items-baseline gap-3 tabular-nums">
            {isUnlimited ? (
              <>
                <span className="text-xs text-dark-400">
                  {formatTraffic(usedGb)} {t('dashboard.usedSuffix')}
                </span>
                <span
                  className="text-2xl font-extrabold leading-none"
                  style={{ color: zone.mainVar }}
                >
                  &#8734;
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-dark-400">
                  {formatTraffic(usedGb)} / {formatTraffic(subscription.traffic_limit_gb)}
                </span>
                <span className="text-[26px] font-extrabold leading-none tracking-tight text-dark-50">
                  {animatedPercent.toFixed(0)}
                  <span className="ml-px text-sm font-medium text-dark-400">%</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mb-6">
          <TrafficProgressBar
            usedGb={usedGb}
            limitGb={subscription.traffic_limit_gb}
            percent={usedPercent}
            isUnlimited={isUnlimited}
          />
        </div>

        {/* ─── Подключить устройство ─── */}
        <ConnectDeviceTile
          subscription={subscription}
          connectedDevices={connectedDevices}
          usedPercent={usedPercent}
        />

        {/* ─── Обновить / управление ─── */}
        <div className="mt-1 flex items-center justify-between px-0.5">
          <button
            onClick={() => refreshTrafficMutation.mutate()}
            disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('common.refresh')}
          >
            <RefreshIcon
              className={`h-3.5 w-3.5 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`}
            />
            {t('common.refresh')}
            {trafficRefreshCooldown > 0 && (
              <span className="tabular-nums text-dark-500">{trafficRefreshCooldown}s</span>
            )}
          </button>
          <Link
            to={`/subscriptions/${subscription.id}`}
            className="text-xs font-semibold text-accent-300 transition-colors hover:text-accent-200"
          >
            {t('dashboard.viewSubscription')} &rarr;
          </Link>
        </div>

        {/* ─── Sparkline ─── */}
        {dailyUsage.length >= 2 && (
          <div
            className="mt-5 rounded-[14px] p-3.5 pb-3"
            style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-dark-400">
                {t('dashboard.usageLast14Days')}
              </span>
              <span className="font-mono text-[11px] text-dark-400">
                {t('dashboard.maxUsage', { amount: formatTraffic(Math.max(...dailyUsage)) })}
              </span>
            </div>
            <Sparkline data={dailyUsage} width={440} height={44} color={zone.mainVar} />
          </div>
        )}
      </div>
    </div>
  );
}
