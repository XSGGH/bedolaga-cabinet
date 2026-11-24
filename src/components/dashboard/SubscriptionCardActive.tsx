import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, CogIcon } from '@/components/icons';
import { copyToClipboard } from '@/utils/clipboard';
import { uiLocale } from '@/utils/uiLocale';
import { formatTraffic, formatTrafficPercent } from '../../utils/formatTraffic';
import type { Subscription } from '../../types';
import TrafficProgressBar from './TrafficProgressBar';
import ConnectDeviceTile from './ConnectDeviceTile';
import TrafficRefreshButton from './TrafficRefreshButton';

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
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const usedPercent = trafficData?.traffic_used_percent ?? subscription.traffic_used_percent;
  const isUnlimited = trafficData?.is_unlimited ?? subscription.traffic_limit_gb === 0;
  const daysLeft = subscription.days_left;
  const endingSoon = daysLeft <= 3;
  const status = !subscription.is_active
    ? t('dashboard.ui.statusUnknown', 'Статус уточняется')
    : endingSoon
      ? t('dashboard.ui.endingSoon', 'Скоро закончится')
      : t('dashboard.ui.active', 'Активна');
  const statusColor = !subscription.is_active
    ? 'text-dark-300'
    : endingSoon
      ? 'text-warning-400'
      : 'text-success-400';
  const date = new Date(subscription.end_date).toLocaleDateString(uiLocale());
  const trafficKnown = Number.isFinite(usedGb) && Number.isFinite(usedPercent);
  const remaining = Math.max(0, subscription.traffic_limit_gb - usedGb);

  return (
    <section
      aria-label={t('dashboard.ui.subscription', 'Ваша подписка')}
      className="overflow-hidden rounded-3xl border border-[var(--xsg-line-strong)] bg-dark-800"
    >
      <div className="space-y-3 p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-8 lg:gap-y-4 lg:space-y-0">
        <div className="flex items-center justify-between gap-3 text-xs lg:col-span-2">
          <span className="font-medium text-dark-300">{t('dashboard.tariff')}</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${statusColor}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {status}
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-4 lg:content-start">
          <div className="min-w-0">
            <Link
              to={`/subscriptions/${subscription.id}`}
              className="block break-words text-xl font-bold leading-tight tracking-tight text-dark-50 [overflow-wrap:anywhere] hover:text-accent-300 sm:text-2xl"
            >
              {subscription.is_trial
                ? t('subscription.trialStatus')
                : subscription.tariff_name || t('subscription.currentPlan')}
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-dark-300">
              {t('dashboard.validUntil', { date })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-dark-300">{t('dashboard.remaining')}</p>
            <p
              className={`mt-1 font-semibold tabular-nums ${endingSoon ? 'text-warning-400' : 'text-dark-50'}`}
            >
              {daysLeft > 0 ? (
                <>
                  <span className="text-[28px] leading-none">{daysLeft}</span>
                  <span className="ml-1 text-xs">{t('subscription.daysShort')}</span>
                </>
              ) : (
                <span className="text-sm">
                  {subscription.time_left_display || t('dashboard.ui.lessThanDay', 'Меньше суток')}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <ConnectDeviceTile subscription={subscription} connectedDevices={connectedDevices} />
          <Link
            to={`/subscriptions/${subscription.id}`}
            className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-dark-700/20 px-3 text-sm font-medium text-dark-100 transition-colors hover:bg-dark-700/40 active:bg-dark-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            <span className="flex items-center gap-2">
              <CogIcon className="h-4 w-4 shrink-0 text-dark-400" />
              {t('dashboard.viewSubscription')}
            </span>
            <span aria-hidden="true" className="text-dark-400">
              ›
            </span>
          </Link>
        </div>

        {!isUnlimited && (
          <div className="border-t border-[var(--xsg-line)] pt-3 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-dark-100">
                  {t('dashboard.trafficUsageTitle')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-dark-300">
                  {t('dashboard.ui.trafficScope', 'На серверах обхода белых списков')}
                </p>
              </div>
              <TrafficRefreshButton
                cooldown={trafficRefreshCooldown}
                pending={refreshTrafficMutation.isPending}
                onRefresh={() => refreshTrafficMutation.mutate()}
              />
            </div>
            <div className="mb-2 mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs tabular-nums text-dark-300">
              <p>
                <span className="text-base font-semibold text-dark-50">
                  {trafficKnown ? formatTraffic(usedGb) : '—'}
                </span>{' '}
                / {formatTraffic(subscription.traffic_limit_gb)}
              </p>
              {trafficKnown && <span>{formatTrafficPercent(usedPercent)}</span>}
            </div>
            <TrafficProgressBar
              usedGb={usedGb}
              limitGb={subscription.traffic_limit_gb}
              percent={usedPercent}
              isUnlimited={false}
              compact
            />
            <p className="mt-2 text-xs leading-relaxed text-dark-300">
              {trafficKnown
                ? t('dashboard.ui.trafficRemaining', {
                    defaultValue: 'Осталось {{amount}}',
                    amount: formatTraffic(remaining),
                  })
                : t('dashboard.ui.noTraffic', 'Статистика пока недоступна')}
            </p>
            {refreshTrafficMutation.isError && (
              <p role="status" className="mt-2 text-xs text-warning-400">
                {t('dashboard.ui.refreshError', 'Не удалось обновить. Показан последний замер.')}
              </p>
            )}
          </div>
        )}

        {subscription.subscription_url && !subscription.hide_subscription_link && (
          <div className="hidden items-center gap-3 border-t border-[var(--xsg-line)] pt-4 lg:col-span-2 lg:flex">
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs text-dark-400"
              title={subscription.subscription_url}
            >
              {subscription.subscription_url}
            </span>
            <button
              type="button"
              aria-label={t('common.copy', 'Копировать')}
              onClick={async () => {
                try {
                  await copyToClipboard(subscription.subscription_url ?? '');
                  setCopied(true);
                  setCopyError(false);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopyError(true);
                }
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-dark-300 hover:bg-dark-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            </button>
            {copyError && (
              <span role="status" className="text-xs text-warning-400">
                {t('common.error')}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
