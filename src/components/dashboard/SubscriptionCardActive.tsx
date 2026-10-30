import { useEffect, useState } from 'react';
import { copyToClipboard } from '@/utils/clipboard';
import { uiLocale } from '@/utils/uiLocale';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import TrafficProgressBar from './TrafficProgressBar';
import Sparkline from './Sparkline';
import ConnectDeviceTile from './ConnectDeviceTile';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { useTheme } from '../../hooks/useTheme';
import { useTrafficZone } from '../../hooks/useTrafficZone';
import { formatTraffic } from '../../utils/formatTraffic';
import { getGlassColors } from '../../utils/glassTheme';
import {
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  CogIcon,
  MonitorIcon,
  RefreshIcon,
} from '@/components/icons';
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
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const isAtDeviceLimit =
    subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;
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
        background: subscription.is_trial
          ? `radial-gradient(110% 55% at 50% 0%, rgba(var(--color-accent-500), 0.2), transparent 62%), linear-gradient(180deg, rgba(var(--color-accent-500), 0.06), transparent 50%), ${g.cardBg}`
          : g.cardBg,
        border: subscription.is_trial
          ? '1px solid rgba(var(--color-accent-400), 0.3)'
          : `1px solid ${g.cardBorder}`,
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
        {/* ─── Тариф и остаток ─── */}
        {/* На десктопе — три равные колонки-«факта» с вертикальными разделителями. */}
        <div className="mb-6 flex items-end justify-between gap-5 lg:grid lg:grid-cols-3 lg:items-stretch lg:gap-0">
          <Link
            to={`/subscriptions/${subscription.id}`}
            className="min-w-0 flex-1 transition-opacity hover:opacity-90 lg:pr-8"
          >
            <div className="xsg-eyebrow mb-2 flex items-center gap-2">{t('dashboard.tariff')}</div>
            <div className="line-clamp-2 min-w-0 break-words text-2xl font-extrabold leading-tight tracking-tight text-dark-50 sm:text-[30px]">
              {subscription.is_trial
                ? t('subscription.trialStatus')
                : subscription.tariff_name || t('subscription.currentPlan')}
            </div>
            <div className="mt-1.5 text-[13px] text-dark-400">
              {t('dashboard.validUntil', { date: formattedDate })}
            </div>
          </Link>

          <div className="shrink-0 text-right lg:border-l lg:border-accent-500/15 lg:px-8 lg:text-left">
            <div className="xsg-eyebrow mb-2 flex items-center justify-end gap-1.5 lg:justify-start">
              <CalendarIcon className="h-3.5 w-3.5" />
              {t('dashboard.remaining')}
            </div>
            <div className="flex items-baseline justify-end gap-1.5 lg:justify-start">
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

          {/* Устройства — только десктоп (на телефоне это плитка подключения ниже) */}
          <div className="hidden border-l border-accent-500/15 pl-8 lg:block">
            <div className="xsg-eyebrow mb-2 flex items-center gap-1.5">
              <MonitorIcon className="h-3.5 w-3.5" />
              {t('subscription.myDevices')}
            </div>
            <div className="text-[30px] font-bold leading-none tracking-tight tabular-nums text-dark-50">
              {subscription.device_limit === 0
                ? connectedDevices
                : `${connectedDevices} / ${subscription.device_limit}`}
            </div>
          </div>
        </div>

        {/* Безлимит: блок трафика не показываем вовсе */}
        {!isUnlimited && (
          <>
            <div aria-hidden="true" className="mb-6 h-px bg-accent-500/15" />

            {/* ─── Расход трафика ─── */}
            <div className="mb-3 flex items-center gap-2">
              <h2 className="min-w-0 truncate text-base font-bold tracking-tight text-dark-50">
                {t('dashboard.trafficUsageTitle')}
              </h2>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-accent-500/40 bg-accent-500/10 px-2.5 py-1 text-[11px] font-bold text-accent-300">
                {t('subscription.trafficScope.badge', 'только 📡 серверы')}
              </span>
              <button
                type="button"
                onClick={() => refreshTrafficMutation.mutate()}
                disabled={refreshTrafficMutation.isPending || trafficRefreshCooldown > 0}
                className="ml-auto flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-[var(--xsg-line)] bg-dark-800/60 px-1 text-dark-300 transition-colors hover:border-[var(--xsg-line-strong)] hover:text-dark-50 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
              >
                {trafficRefreshCooldown > 0 && !refreshTrafficMutation.isPending ? (
                  <span className="text-[11px] font-semibold tabular-nums">
                    {trafficRefreshCooldown}
                  </span>
                ) : (
                  <RefreshIcon
                    className={`h-3.5 w-3.5 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`}
                  />
                )}
              </button>
            </div>

            <div className="mb-3 flex items-end justify-between gap-3 tabular-nums">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
                <span className="text-lg font-bold leading-none text-dark-50">
                  {formatTraffic(usedGb)}
                </span>
                <span className="text-[13px] text-dark-400">
                  / {formatTraffic(subscription.traffic_limit_gb)}
                </span>
                {/* Плашку показываем только когда есть о чём сказать: повышенный
                расход. В спокойной зоне («Норма») она — шум. */}
                {zone.colorKey !== 'accent' && (
                  <span
                    className="ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
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
                    {t(zone.labelKey)}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[28px] font-extrabold leading-none tracking-tight text-dark-50">
                {animatedPercent.toFixed(0)}
                <span className="ml-0.5 text-sm font-medium text-dark-400">%</span>
              </span>
            </div>

            <div className="mb-6">
              <TrafficProgressBar
                usedGb={usedGb}
                limitGb={subscription.traffic_limit_gb}
                percent={usedPercent}
                isUnlimited={isUnlimited}
              />
            </div>
          </>
        )}

        {/* ─── Подключить устройство ─── */}
        {isDesktop ? (
          subscription.subscription_url && (
            <>
              <div aria-hidden="true" className="mb-6 h-px bg-accent-500/15" />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isAtDeviceLimit}
                  data-onboarding="connect-devices"
                  onClick={() => navigate(`/connection?sub=${subscription.id}`)}
                  className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl bg-accent-500 px-6 text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MonitorIcon className="h-[18px] w-[18px]" />
                  {t('dashboard.connectDevice')}
                </button>
                <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-[var(--xsg-line)] bg-dark-900 px-4 font-mono text-[13px] text-dark-400">
                  <span className="truncate">{subscription.subscription_url}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void copyToClipboard(subscription.subscription_url ?? '');
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  aria-label={t('common.copy', 'Копировать')}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--xsg-line)] bg-dark-800 text-dark-300 transition-colors hover:border-[var(--xsg-line-strong)] hover:text-dark-50"
                >
                  {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </button>
                <Link
                  to={`/subscriptions/${subscription.id}`}
                  className="shrink-0 pl-2 text-sm font-semibold text-accent-300 transition-colors hover:text-accent-200"
                >
                  {t('dashboard.manageShort', 'Управление')} &rsaquo;
                </Link>
              </div>
            </>
          )
        ) : (
          <>
            <div aria-hidden="true" className="mb-6 h-px bg-accent-500/15" />
            <ConnectDeviceTile
              subscription={subscription}
              connectedDevices={connectedDevices}
              usedPercent={usedPercent}
            />
            <Link
              to={`/subscriptions/${subscription.id}`}
              className="flex w-full items-center gap-4 rounded-2xl border border-dark-500/50 bg-dark-700/60 p-4 text-left transition-colors duration-200 hover:border-dark-400/70 hover:bg-dark-700/80"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-dark-600/70 text-dark-100">
                <CogIcon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold tracking-tight text-dark-50">
                  {t('dashboard.viewSubscription')}
                </div>
                <div className="mt-0.5 text-xs text-dark-400">{t('dashboard.manageSubtitle')}</div>
              </div>
              <span className="flex-shrink-0 text-lg text-dark-400" aria-hidden="true">
                &rsaquo;
              </span>
            </Link>
          </>
        )}

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
