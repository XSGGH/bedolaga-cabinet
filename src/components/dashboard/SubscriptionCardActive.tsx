import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseMutationResult } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, CogIcon, PlusIcon } from '@/components/icons';
import { addonActionClass } from '@/components/subscription/AddonPurchaseButton';
import {
  subscriptionActionClass,
  secondaryActionClass,
} from '@/components/subscription/actionStyles';
import { copyToClipboard } from '@/utils/clipboard';
import SubscriptionPlanHeader from '@/components/subscription/SubscriptionPlanHeader';
import LimitStatusNotice from '@/components/subscription/LimitStatusNotice';
import { formatTraffic, formatTrafficPercent } from '../../utils/formatTraffic';
import type { Subscription } from '../../types';
import TrafficProgressBar from './TrafficProgressBar';
import ConnectDeviceTile from './ConnectDeviceTile';
import { useAddonAvailability } from '@/hooks/useAddonAvailability';
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
  connectedDevices: number | undefined;
}

export default function SubscriptionCardActive({
  subscription,
  trafficData,
  refreshTrafficMutation,
  trafficRefreshCooldown,
  connectedDevices,
}: SubscriptionCardActiveProps) {
  const { t } = useTranslation();
  const { canAddDevices, canAddTraffic } = useAddonAvailability(subscription, subscription.id);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
  const usedPercent = trafficData?.traffic_used_percent ?? subscription.traffic_used_percent;
  const isUnlimited = trafficData?.is_unlimited ?? subscription.traffic_limit_gb === 0;
  const trafficKnown = Number.isFinite(usedGb) && Number.isFinite(usedPercent);
  const remaining = Math.max(0, subscription.traffic_limit_gb - usedGb);
  // The API allowance already includes active top-ups; don't add purchases a second time.
  const remainingRatio =
    trafficKnown && !isUnlimited && subscription.traffic_limit_gb > 0
      ? remaining / subscription.traffic_limit_gb
      : null;
  const trafficLow = remainingRatio !== null && remainingRatio <= 0.1;

  return (
    <section
      aria-label={t('dashboard.ui.subscription', 'Ваша подписка')}
      className="xsg-overview xsg-subscription-hero overflow-hidden rounded-3xl border border-[var(--xsg-line)] bg-dark-800"
      data-onboarding="welcome"
    >
      <div className="xsg-overview-grid space-y-3 p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-8 lg:gap-y-4 lg:space-y-0">
        <div className="xsg-overview-plan lg:col-span-2">
          <SubscriptionPlanHeader subscription={subscription} />
        </div>

        <div className="xsg-overview-actions space-y-1.5">
          <ConnectDeviceTile
            subscription={subscription}
            connectedDevices={connectedDevices}
            canIncreaseLimit={canAddDevices}
          />
          <Link to={`/subscriptions/${subscription.id}`} className="xsg-overview-device-link hidden">{t('subscriptionCommand.deviceList')} <span aria-hidden="true">›</span></Link>
          <Link
            to={`/subscriptions/${subscription.id}`}
            className={`xsg-overview-manage ${subscriptionActionClass} ${secondaryActionClass}`}
          >
            <CogIcon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            {t('dashboard.viewSubscription')}
          </Link>
        </div>

        {!isUnlimited && (
          <div className="xsg-overview-traffic border-t border-[var(--xsg-line)] pt-3 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-sm font-semibold text-dark-100">
                {t('dashboard.trafficUsageTitle')}
              </h2>
              <TrafficRefreshButton
                cooldown={trafficRefreshCooldown}
                pending={refreshTrafficMutation.isPending}
                onRefresh={() => refreshTrafficMutation.mutate()}
              />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dark-300">
              {t('dashboard.ui.specialServers', 'Специальные серверы (📡)')}
            </p>
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
            {trafficLow && (
              <LimitStatusNotice className="mt-2" exhausted={remaining === 0}>
                {t(
                  remaining === 0
                    ? 'subscriptionCommand.trafficEnded'
                    : 'subscriptionCommand.trafficLow',
                )}
              </LimitStatusNotice>
            )}
            {canAddTraffic && trafficLow && (
              <Link
                to={`/subscriptions/${subscription.id}?addon=traffic`}
                className={`${addonActionClass} mt-2 w-full`}
              >
                <PlusIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {t('addonsUi.buyTraffic')}
              </Link>
            )}
            {refreshTrafficMutation.isError && (
              <p role="status" className="mt-2 text-xs text-warning-400">
                {t('dashboard.ui.refreshError', 'Не удалось обновить. Показан последний замер.')}
              </p>
            )}
          </div>
        )}

        {subscription.subscription_url && !subscription.hide_subscription_link && (
          <div className="xsg-overview-link hidden items-center gap-3 border-t border-[var(--xsg-line)] pt-4 lg:col-span-2 lg:flex">
            <span className="xsg-overview-link-label text-xs font-medium text-dark-300">
              {t('subscriptionCommand.connectionLink')}
            </span>
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
