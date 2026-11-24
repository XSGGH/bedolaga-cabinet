import { uiLocale } from '@/utils/uiLocale';
import { TrialAllowancePanel } from '@/components/subscription/TrialAllowancePanel';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAddonAvailability } from '@/hooks/useAddonAvailability';
import SubscriptionPlanHeader from '@/components/subscription/SubscriptionPlanHeader';
import LimitStatusNotice from '@/components/subscription/LimitStatusNotice';
import AddonPurchaseButton, {
  addonActionClass,
} from '@/components/subscription/AddonPurchaseButton';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import ConnectDeviceTile from '../components/dashboard/ConnectDeviceTile';
import TrafficRefreshButton from '../components/dashboard/TrafficRefreshButton';
import TrafficProgressBar from '../components/dashboard/TrafficProgressBar';
import { formatTraffic, formatTrafficPercent } from '../utils/formatTraffic';
import { getGlassColors } from '../utils/glassTheme';
import { copyToClipboard } from '../utils/clipboard';
import { useTheme } from '../hooks/useTheme';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import CollapsibleSection from '../components/subscription/CollapsibleSection';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import ChangeTariffButton from '../components/subscription/ChangeTariffButton';
import { showsAddonOptions } from '../utils/legacySubscription';
import {
  ChatIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  TrashIcon,
  DevicesIcon,
  InfoIcon,
} from '../components/icons';
import { resolveConnectionUrlForUi } from '../utils/connectionLink';
import { AutopayToggle } from '../components/subscription/manage/AutopayToggle';
import { DailyPausePanel } from '../components/subscription/manage/DailyPausePanel';
import {
  canReissueLink,
  ReissueLinkButton,
} from '../components/subscription/manage/ReissueLinkButton';
import { DevicesPanel } from '../components/subscription/manage/DevicesPanel';
import { RecurringPanels } from '../components/subscription/manage/RecurringPanels';
import { DeviceTopupSheet } from '../components/subscription/sheets/DeviceTopupSheet';
import { DeviceReductionSheet } from '../components/subscription/sheets/DeviceReductionSheet';
import { TrafficTopupSheet } from '../components/subscription/sheets/TrafficTopupSheet';
import { DeleteSubscriptionSheet } from '../components/subscription/sheets/DeleteSubscriptionSheet';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { safeLocal } from '../utils/safeStorage';

/** Isolated countdown so 1s interval doesn't re-render the whole page */
const CountdownTimer = memo(function CountdownTimer({
  endDate,
  isActive,
  glassColors: g,
}: {
  endDate: string;
  isActive: boolean;
  glassColors: ReturnType<typeof getGlassColors>;
}) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const endTime = new Date(endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setCountdown({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const isExpired = !isActive;
  const isUrgent = countdown.days <= 3;

  const tone = isExpired
    ? 'rgb(var(--color-critical-500))'
    : isUrgent
      ? 'rgb(var(--color-urgent-400))'
      : g.text;

  const clock = `${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;

  return (
    <div className="flex min-w-0 items-baseline justify-end text-right">
      {isExpired ? (
        <div className="text-2xl font-bold tracking-tight" style={{ color: tone }}>
          {t('subscription.expired')}
        </div>
      ) : countdown.days > 0 ? (
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span
            className="text-[28px] font-bold leading-none tracking-tight"
            style={{ color: tone }}
          >
            {countdown.days}
          </span>
          <span className="text-xs font-medium text-dark-400">
            {t('subscriptionCommand.daysUnit', { count: countdown.days })}
          </span>
        </span>
      ) : (
        <span
          className="text-[28px] font-bold leading-none tracking-tight tabular-nums"
          style={{ color: tone }}
        >
          {clock}
        </span>
      )}
    </div>
  );
});

export default function Subscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { subscriptionId: subIdParam } = useParams<{ subscriptionId?: string }>();
  const subscriptionId = subIdParam ? parseInt(subIdParam, 10) : undefined;
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Device/traffic topup state
  const [deviceAction, setDeviceAction] = useState<'add' | 'reduce' | null>(null);
  const showDeviceTopup = deviceAction === 'add';
  const showDeviceReduction = deviceAction === 'reduce';
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  const [showTrafficTopup, setShowTrafficTopup] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [addonParams, setAddonParams] = useSearchParams();
  const [selectedTrafficPackage, setSelectedTrafficPackage] = useState<number | null>(null);

  // Traffic refresh state
  const [trafficRefreshCooldown, setTrafficRefreshCooldown] = useState(0);

  // Revoke (reissue) cooldown state
  const [trafficData, setTrafficData] = useState<{
    traffic_used_gb: number;
    traffic_used_percent: number;
    is_unlimited: boolean;
  } | null>(null);

  // Detect multi-tariff mode from cached subscriptions-list
  const { data: multiSubData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    staleTime: 60_000,
  });
  const isMultiTariff = multiSubData?.multi_tariff_enabled ?? false;

  const {
    data: subscriptionResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionApi.getSubscription(subscriptionId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: connectionLink, isLoading: isConnectionLinkLoading } = useQuery({
    queryKey: ['connection-link', subscriptionId],
    queryFn: () => subscriptionApi.getConnectionLink(subscriptionId),
    retry: false,
    staleTime: 0,
  });

  // Extract subscription from response (null if no subscription)
  const subscription = subscriptionResponse?.subscription ?? null;
  const { canAddDevices, canAddTraffic, canReduceDevices, minimumDeviceLimit } =
    useAddonAvailability(subscription, subscriptionId);
  const openAddon = useCallback(
    (kind: 'devices' | 'traffic') => {
      if (kind === 'devices' && canAddDevices) {
        setShowTrafficTopup(false);
        setDeviceAction('add');
      } else if (kind === 'traffic' && canAddTraffic) {
        setDeviceAction(null);
        setShowTrafficTopup(true);
      }
    },
    [canAddDevices, canAddTraffic],
  );
  useEffect(() => {
    const requested = addonParams.get('addon');
    if ((requested === 'devices' && canAddDevices) || (requested === 'traffic' && canAddTraffic)) {
      openAddon(requested);
      const next = new URLSearchParams(addonParams);
      next.delete('addon');
      setAddonParams(next, { replace: true, preventScrollReset: true });
    }
  }, [addonParams, canAddDevices, canAddTraffic, openAddon, setAddonParams]);
  const displayedConnectionUrl = useMemo(
    () =>
      resolveConnectionUrlForUi({
        mode: connectionLink?.connect_mode,
        happSchemeLink: connectionLink?.happ_scheme_link,
        displayLink: connectionLink?.display_link,
        subscriptionUrl: connectionLink?.subscription_url,
        happCryptLink: connectionLink?.happ_cryptolink,
        happCryptoLink: connectionLink?.happ_crypto_link,
        happLink: connectionLink?.happ_link,
        fallbackUrl: isConnectionLinkLoading ? null : (subscription?.subscription_url ?? null),
      }),
    [
      connectionLink?.connect_mode,
      connectionLink?.display_link,
      connectionLink?.happ_cryptolink,
      connectionLink?.happ_crypto_link,
      connectionLink?.happ_link,
      connectionLink?.happ_scheme_link,
      connectionLink?.subscription_url,
      isConnectionLinkLoading,
      subscription?.subscription_url,
    ],
  );
  const shouldHideConnectionLink =
    subscription?.hide_subscription_link || connectionLink?.hide_link;

  // Traffic zone (theme-aware) — called unconditionally at top level
  const usedPercent = trafficData?.traffic_used_percent ?? subscription?.traffic_used_percent ?? 0;

  // Purchase options (needed for balance_kopeks in device/traffic/server management)
  const purchaseOptionsQuery = useQuery({
    queryKey: ['purchase-options', subscriptionId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const purchaseOptions = purchaseOptionsQuery.data;

  // Devices query
  // Счётчик подключённых устройств в шапке. Сам список живёт в <DevicesPanel>
  // и ходит по тому же ключу, так что второго запроса не возникает.
  const { data: devicesData } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
    enabled: !!subscription,
  });

  // Pause subscription mutation
  // Auto-close all modals/forms when success notification appears
  const handleCloseAllModals = useCallback(() => {
    setDeviceAction(null);
    setShowTrafficTopup(false);
  }, []);
  useCloseOnSuccessNotification(handleCloseAllModals);

  // (device price + purchase moved into <DeviceTopupSheet>)
  // (device reduction info + mutation moved into <DeviceReductionSheet>)

  // (traffic packages + purchase moved into <TrafficTopupSheet>)
  // (countries query + update mutation moved into <ServerManagementSheet>)

  // Traffic refresh mutation
  const refreshTrafficMutation = useMutation({
    mutationFn: () => subscriptionApi.refreshTraffic(subscriptionId),
    onSuccess: (data) => {
      setTrafficData({
        traffic_used_gb: data.traffic_used_gb,
        traffic_used_percent: data.traffic_used_percent,
        is_unlimited: data.is_unlimited,
      });
      safeLocal.setItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`, Date.now().toString());
      if (data.rate_limited && data.retry_after_seconds) {
        setTrafficRefreshCooldown(data.retry_after_seconds);
      } else {
        setTrafficRefreshCooldown(30);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
    onError: (error: {
      response?: { status?: number; headers?: { get?: (key: string) => string } };
    }) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers?.get?.('Retry-After');
        setTrafficRefreshCooldown(retryAfter ? parseInt(retryAfter, 10) : 30);
      }
    },
  });

  // Track if we've already triggered auto-refresh this session
  const hasAutoRefreshed = useRef(false);

  // Cooldown timer for traffic refresh
  useEffect(() => {
    if (trafficRefreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setTrafficRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [trafficRefreshCooldown]);

  // Auto-refresh traffic on mount (with 30s caching)
  useEffect(() => {
    if (!subscription) return;
    if (hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const lastRefresh = safeLocal.getItem(`traffic_refresh_ts_${subscriptionId ?? 'default'}`);
    const now = Date.now();
    const cacheMs = 30 * 1000;

    if (lastRefresh && now - parseInt(lastRefresh, 10) < cacheMs) {
      const elapsed = now - parseInt(lastRefresh, 10);
      const remaining = Math.ceil((cacheMs - elapsed) / 1000);
      if (remaining > 0) {
        setTrafficRefreshCooldown(remaining);
      }
      return;
    }

    refreshTrafficMutation.mutate();
  }, [subscription, refreshTrafficMutation, subscriptionId]);

  const copyUrl = async () => {
    if (!displayedConnectionUrl) return;
    try {
      await copyToClipboard(displayedConnectionUrl);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  // In multi-tariff mode without a specific subscription ID, redirect to list
  if (isMultiTariff && !subscriptionId && !isLoading) {
    return <Navigate to="/subscriptions" replace />;
  }

  if (isLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-48">
        <Skeleton variant="card" className="h-64" />
        <Skeleton variant="card" count={2} className="h-20" />
      </PageSkeleton>
    );
  }

  if (isError && !subscription)
    return (
      <div
        role="status"
        className="rounded-2xl border border-[var(--xsg-line)] bg-dark-800 p-4 text-sm text-dark-200"
      >
        {t('dashboard.ui.subscriptionError', 'Не удалось загрузить подписку.')}
        <button
          type="button"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] })
          }
          className="mt-2 block min-h-11 text-accent-300"
        >
          {t('dashboard.ui.retry', 'Попробовать снова')}
        </button>
      </div>
    );
  if (!subscription && subscriptionId) {
    return (
      <div className="mx-auto max-w-lg p-4 text-center">
        <div className="mb-4 text-4xl">😕</div>
        <h2 className="mb-2 text-xl font-bold text-dark-50">
          {t('subscription.notFound', 'Подписка не найдена')}
        </h2>
        <p className="mb-4 text-sm text-dark-50/60">
          {t('subscription.notFoundDesc', 'Возможно, подписка была удалена или не существует')}
        </p>
        <button
          onClick={() => navigate('/subscriptions')}
          className="rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-medium text-on-accent"
        >
          {t('subscription.backToList', 'Мои подписки')}
        </button>
      </div>
    );
  }

  const autopayInner = subscription ? (
    <>
      <AutopayToggle
        subscription={subscription}
        subscriptionId={subscriptionId}
        accentColor="rgb(var(--color-accent-500))"
        offColor={g.textGhost}
      />

      <div className="xsg-rec">
        <button
          type="button"
          onClick={() => setShowRecurring((v) => !v)}
          aria-expanded={showRecurring}
          className="xsg-rec-btn flex min-h-[54px] w-full items-center justify-between gap-3 text-left text-[13.5px] font-semibold text-accent-300"
        >
          <span>{t('subscription.recurring.methods', 'Способы автоплатежа')}</span>
          <ChevronDownIcon
            className={`h-4 w-4 text-dark-400 transition-transform duration-200 ${showRecurring ? 'rotate-180' : ''}`}
          />
        </button>
        <div className={`xsg-rec-body ${showRecurring ? '' : 'hidden'}`}>
          <RecurringPanels subscription={subscription} subscriptionId={subscriptionId} />
        </div>
      </div>
    </>
  ) : null;

  const connectInner = subscription
    ? displayedConnectionUrl &&
      !shouldHideConnectionLink && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-dark-300">
            {t('subscription.actionsUi.connectionLink', 'Ссылка для подключения')}
          </p>
          <div className="flex gap-2.5">
            <code
              className="flex h-12 min-w-0 flex-1 items-center truncate whitespace-nowrap rounded-[14px] px-4 font-mono text-[13px] text-dark-300"
              style={{ background: g.codeBg, border: `1px solid ${g.codeBorder}` }}
            >
              <span className="truncate">{displayedConnectionUrl}</span>
            </code>
            <button
              onClick={copyUrl}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] border border-accent-500/40 bg-dark-700 text-accent-300 transition-colors hover:border-accent-400"
              aria-label={t('subscription.copyLink')}
              title={t('subscription.copyLink')}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          {copied && (
            <p role="status" className="text-xs text-success-400">
              {t('subscription.actionsUi.copied', 'Скопировано')}
            </p>
          )}
          {copyError && (
            <p role="status" className="text-xs text-warning-400">
              {t(
                'subscription.actionsUi.copyError',
                'Не удалось скопировать ссылку. Попробуйте ещё раз.',
              )}
            </p>
          )}
        </div>
      )
    : null;

  const usedGb = trafficData?.traffic_used_gb ?? subscription?.traffic_used_gb ?? 0;
  const isUnlimited = (trafficData?.is_unlimited ?? false) || subscription?.traffic_limit_gb === 0;
  const trafficKnown = Number.isFinite(usedGb) && Number.isFinite(usedPercent);
  const trafficLimit = subscription?.traffic_limit_gb ?? 0;
  const trafficRemaining = Math.max(0, trafficLimit - usedGb);
  const trafficLow =
    trafficKnown && !isUnlimited && trafficLimit > 0 && trafficRemaining / trafficLimit <= 0.1;
  const connectedDevices = devicesData?.total ?? devicesData?.devices?.length ?? 0;
  const deviceLimit = devicesData?.device_limit ?? subscription?.device_limit ?? 0;

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="flex items-center gap-3">
        <WebBackButton to={isMultiTariff ? '/subscriptions' : '/'} />
        <h1 className="text-xl font-semibold text-dark-100 sm:text-2xl">
          {t('subscription.title')}
        </h1>
      </div>
      {subscription ? (
        <>
          <div className="min-w-0 space-y-4 pb-4">
            <div className="min-w-0 space-y-4">
              <section className="xsg-subscription-hero space-y-4 overflow-hidden rounded-3xl border border-line bg-surface p-4 sm:p-6">
                <SubscriptionPlanHeader
                  subscription={subscription}
                  remaining={
                    <CountdownTimer
                      endDate={subscription.end_date}
                      isActive={subscription.is_active || subscription.is_limited}
                      glassColors={g}
                    />
                  }
                />
                {/* ─── Trial Info Banner ─── */}
                {subscription.is_trial && subscription.is_active && (
                  <div
                    className="mb-6 rounded-[20px] border border-accent-400/25 p-4"
                    style={{
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent-300">
                        <ClockIcon className="h-3 w-3" />
                        {t('subscription.trialInfo.title')}
                      </span>
                    </div>
                    <p className="mb-3.5 mt-2 text-[13px] leading-snug text-dark-400">
                      {t('subscription.trialInfo.description')}
                    </p>
                    <TrialAllowancePanel trafficLimitGb={subscription.traffic_limit_gb} compact />
                    {subscription.traffic_limit_gb > 0 && (
                      <p className="mt-3 text-center text-[11px] leading-snug text-dark-400">
                        {t('subscription.trialInfo.trafficNote', {
                          gb: subscription.traffic_limit_gb,
                        })}
                      </p>
                    )}
                  </div>
                )}

                {/* ─── Поддержка для пробного периода: помогаем решить проблему, пока клиент не ушёл ─── */}
                {subscription.is_trial && subscription.is_active && (
                  <div
                    className="-mt-3 mb-6 flex items-center gap-3 rounded-[18px] border border-accent-500/20 p-3.5"
                    style={{ background: 'rgba(var(--color-accent-500), 0.06)' }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/15 text-accent-300">
                      <ChatIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-dark-50">
                        {t('subscription.trialSupport.title')}
                      </div>
                      <div className="mt-0.5 text-xs leading-snug text-dark-400">
                        {t('subscription.trialSupport.description')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/support')}
                      className="shrink-0 rounded-xl border border-accent-400/35 bg-accent-500/20 px-3.5 py-2 text-xs font-bold text-accent-200 transition-colors hover:bg-accent-500/30"
                    >
                      {t('subscription.trialSupport.button')}
                    </button>
                  </div>
                )}

                <div className="space-y-2 border-t border-divider pt-4">
                  <PurchaseCTAButton
                    subscription={subscription}
                    isMultiTariff={isMultiTariff}
                    inline
                  />
                  <ChangeTariffButton
                    quiet
                    subscription={subscription}
                    isMultiTariff={isMultiTariff}
                    inline
                  />
                </div>
                <div className="xsg-autopay border-t border-divider">{autopayInner}</div>
                {subscription.is_daily && !subscription.is_trial && (
                  <DailyPausePanel subscription={subscription} subscriptionId={subscriptionId} />
                )}
                {isMultiTariff &&
                  !subscription.is_active &&
                  !subscription.is_trial &&
                  !subscription.is_limited && (
                    <DeleteSubscriptionSheet
                      subscriptionId={subscription.id}
                      open={showDeleteSheet}
                      onOpen={() => setShowDeleteSheet(true)}
                      onClose={() => setShowDeleteSheet(false)}
                      textSecondary={g.textSecondary}
                      onDeleted={() => {
                        queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
                        navigate('/subscriptions', { replace: true });
                      }}
                    />
                  )}
              </section>

              <section
                id="subscription-devices"
                className="min-w-0 scroll-mt-24 rounded-2xl border border-line bg-surface p-4 sm:p-6"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-dark-100">
                    {t('subscriptionCommand.devices')}
                  </h2>
                  <span className="text-sm tabular-nums text-dark-300">
                    {devicesData
                      ? deviceLimit === 0
                        ? connectedDevices + ' / ∞'
                        : connectedDevices + ' / ' + deviceLimit
                      : '—'}
                  </span>
                </div>
                {(subscription.is_active || subscription.is_limited) && (
                  <ConnectDeviceTile
                    subscription={subscription}
                    connectedDevices={connectedDevices}
                    connectionPath={
                      subscriptionId ? '/connection?sub=' + subscriptionId : '/connection'
                    }
                    showSummary={false}
                    onManage={() => setDevicesOpen(true)}
                  />
                )}
                {devicesData && deviceLimit > 0 && connectedDevices >= deviceLimit && (
                  <LimitStatusNotice className="mt-2">
                    {t('addonsUi.devicesFull')}
                  </LimitStatusNotice>
                )}
                {showsAddonOptions(subscription) && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={t('subscriptionCommand.reduceDevices')}
                        aria-describedby={!canReduceDevices ? 'device-reduction-reason' : undefined}
                        disabled={!canReduceDevices}
                        title={
                          canReduceDevices
                            ? t('subscriptionCommand.reduceDevices')
                            : minimumDeviceLimit !== undefined && deviceLimit <= minimumDeviceLimit
                              ? t('subscriptionCommand.minimumDevices', {
                                  count: minimumDeviceLimit,
                                })
                              : t('subscriptionCommand.reductionUnavailable')
                        }
                        onClick={() => {
                          setShowTrafficTopup(false);
                          setDeviceAction('reduce');
                        }}
                        className={`${addonActionClass} h-11 w-11 shrink-0 px-0 text-xl`}
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                      {canAddDevices && (
                        <AddonPurchaseButton
                          className="flex-1"
                          onClick={() => openAddon('devices')}
                        >
                          {t('addonsUi.increaseDevices')}
                        </AddonPurchaseButton>
                      )}
                    </div>
                    {!canReduceDevices && (
                      <p id="device-reduction-reason" className="sr-only">
                        {minimumDeviceLimit !== undefined && deviceLimit <= minimumDeviceLimit
                          ? t('subscriptionCommand.minimumDevices', { count: minimumDeviceLimit })
                          : t('subscriptionCommand.reductionUnavailable')}
                      </p>
                    )}
                  </div>
                )}
                <CollapsibleSection
                  title={t('subscriptionCommand.deviceList')}
                  variant="inset"
                  icon={
                    <DevicesIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-dark-300" />
                  }
                  open={devicesOpen}
                  onOpenChange={setDevicesOpen}
                  className="mt-2"
                >
                  <DevicesPanel
                    subscription={subscription}
                    subscriptionId={subscriptionId}
                    hideTitle
                  />
                </CollapsibleSection>
              </section>

              {!isUnlimited && (
                <section className="xsg-traffic min-w-0 space-y-3 rounded-2xl border border-line-strong bg-surface p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-dark-100">
                      {t('dashboard.trafficUsageTitle')}
                    </h2>
                    <TrafficRefreshButton
                      cooldown={trafficRefreshCooldown}
                      pending={refreshTrafficMutation.isPending}
                      onRefresh={() => refreshTrafficMutation.mutate()}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums text-dark-300">
                    <p>
                      <strong className="font-semibold text-dark-50">
                        {trafficKnown ? formatTraffic(usedGb) : '—'}
                      </strong>{' '}
                      / {formatTraffic(subscription.traffic_limit_gb)}
                    </p>
                    {trafficKnown && (
                      <span className="text-xs">{formatTrafficPercent(usedPercent)}</span>
                    )}
                  </div>
                  <TrafficProgressBar
                    usedGb={usedGb}
                    limitGb={subscription.traffic_limit_gb}
                    percent={usedPercent}
                    isUnlimited={false}
                    compact
                  />
                  <p className="text-[13px] text-dark-300">
                    {trafficKnown
                      ? t('dashboard.ui.trafficRemaining', {
                          defaultValue: 'Осталось {{amount}}',
                          amount: formatTraffic(
                            Math.max(0, subscription.traffic_limit_gb - usedGb),
                          ),
                        })
                      : t('dashboard.ui.noTraffic', 'Статистика пока недоступна')}
                  </p>
                  <p className="text-xs leading-relaxed text-dark-400">
                    {t('subscriptionCommand.specialTraffic')}
                    {subscription.traffic_reset_mode &&
                      subscription.traffic_reset_mode !== 'NO_RESET' && (
                        <> · {t('subscription.trafficReset.' + subscription.traffic_reset_mode)}</>
                      )}
                  </p>
                  {(trafficLow || (subscription.is_limited && !isUnlimited)) && (
                    <LimitStatusNotice
                      exhausted={trafficRemaining === 0 || subscription.is_limited}
                    >
                      {t(
                        trafficRemaining === 0 || subscription.is_limited
                          ? 'subscriptionCommand.trafficEnded'
                          : 'subscriptionCommand.trafficLow',
                      )}
                    </LimitStatusNotice>
                  )}
                  {canAddTraffic && (
                    <AddonPurchaseButton onClick={() => openAddon('traffic')} className="w-full">
                      {t('addonsUi.buyTraffic')}
                    </AddonPurchaseButton>
                  )}
                  {refreshTrafficMutation.isError && (
                    <p role="status" className="text-xs text-warning-300">
                      {t(
                        'dashboard.ui.refreshError',
                        'Не удалось обновить. Показан последний замер.',
                      )}
                    </p>
                  )}
                  <CollapsibleSection
                    title={t('subscriptionCommand.trafficDetails')}
                    variant="inset"
                    icon={
                      <InfoIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-dark-300" />
                    }
                  >
                    <div className="space-y-3 text-[13px] leading-relaxed text-dark-300">
                      <p>{t('subscriptionCommand.trafficScopeNote')}</p>
                      {subscription.traffic_purchases &&
                        subscription.traffic_purchases.length > 0 && (
                          <div className="mb-5 space-y-2">
                            {subscription.traffic_purchases.map((purchase) => (
                              <div
                                key={purchase.id}
                                className="rounded-[12px] px-3.5 py-3"
                                style={{
                                  background: g.innerBg,
                                  border: `1px solid ${g.innerBorder}`,
                                }}
                              >
                                <div className="flex items-center justify-between gap-3 text-[12.5px] tabular-nums">
                                  <span className="text-dark-400">
                                    {t('subscription.purchasedTraffic')}{' '}
                                    <b className="font-bold text-dark-50">
                                      {purchase.traffic_gb} {t('common.units.gb')}
                                    </b>
                                  </span>
                                  <span
                                    style={{
                                      color:
                                        purchase.days_remaining === 0
                                          ? 'rgb(var(--color-warning-400))'
                                          : g.textMuted,
                                    }}
                                  >
                                    {purchase.days_remaining === 0
                                      ? t('subscription.expired')
                                      : new Date(purchase.expires_at).toLocaleDateString(
                                          uiLocale(),
                                          {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                          },
                                        )}
                                  </span>
                                </div>
                                <div
                                  className="relative mt-2.5 h-1.5 overflow-hidden rounded-full"
                                  style={{ background: g.trackBg }}
                                >
                                  <div
                                    className="absolute inset-0 origin-left rounded-full bg-accent-500 transition-transform duration-500"
                                    style={{
                                      transform: `scaleX(${purchase.progress_percent / 100})`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </CollapsibleSection>
                </section>
              )}

              {connectInner && (
                <section className="min-w-0 space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
                  <h2 className="text-base font-semibold text-dark-100">
                    {t('subscriptionCommand.connection')}
                  </h2>
                  {connectInner}
                </section>
              )}
            </div>
            {canReissueLink(subscription) && (
              <ReissueLinkButton
                subscription={subscription}
                subscriptionId={subscriptionId}
                inline
                quiet
              />
            )}
          </div>

          {showsAddonOptions(subscription) && (
            <>
              <DeviceTopupSheet
                modal
                open={showDeviceTopup}
                onOpen={() => openAddon('devices')}
                onClose={() => setDeviceAction((current) => (current === 'add' ? null : current))}
                subscription={subscription}
                subscriptionId={subscriptionId}
                devicesToAdd={devicesToAdd}
                onDevicesToAddChange={setDevicesToAdd}
                purchaseOptions={purchaseOptions}
                isDark={isDark}
              />
              <DeviceReductionSheet
                modal
                open={showDeviceReduction}
                onOpen={() => setDeviceAction('reduce')}
                onClose={() =>
                  setDeviceAction((current) => (current === 'reduce' ? null : current))
                }
                subscriptionPresent
                subscriptionId={subscriptionId}
                targetDeviceLimit={targetDeviceLimit}
                onTargetDeviceLimitChange={setTargetDeviceLimit}
                isDark={isDark}
              />
              {subscription.traffic_limit_gb > 0 && (
                <TrafficTopupSheet
                  modal
                  open={showTrafficTopup}
                  onOpen={() => openAddon('traffic')}
                  onClose={() => setShowTrafficTopup(false)}
                  subscription={subscription}
                  subscriptionId={subscriptionId}
                  selectedTrafficPackage={selectedTrafficPackage}
                  onSelectedTrafficPackageChange={setSelectedTrafficPackage}
                  purchaseOptions={purchaseOptions}
                  isDark={isDark}
                />
              )}
            </>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-dark-400">
          <TrashIcon className="mx-auto mb-3 h-8 w-8" />
          {t('subscription.noSubscription')}
        </div>
      )}
    </div>
  );
}
