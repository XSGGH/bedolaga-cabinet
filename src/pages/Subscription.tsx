import { uiLocale } from '@/utils/uiLocale';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import TrafficProgressBar from '../components/dashboard/TrafficProgressBar';
import { useTrafficZone } from '../hooks/useTrafficZone';
import { formatTraffic } from '../utils/formatTraffic';
import { getGlassColors } from '../utils/glassTheme';
import { copyToClipboard } from '../utils/clipboard';
import { useTheme } from '../hooks/useTheme';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import CollapsibleSection from '../components/subscription/CollapsibleSection';
import { useIsDesktop } from '../hooks/useIsDesktop';
import PurchaseCTAButton from '../components/subscription/PurchaseCTAButton';
import ChangeTariffButton from '../components/subscription/ChangeTariffButton';
import { planTitle, showsAddonOptions } from '../utils/legacySubscription';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  DevicesIcon,
  RefreshIcon,
  TrashIcon,
  WarningIcon,
} from '../components/icons';
import { useHaptic } from '../platform';
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
  part = 'days',
}: {
  endDate: string;
  isActive: boolean;
  glassColors: ReturnType<typeof getGlassColors>;
  /** 'days' — подпись и крупные дни; 'time' — только ЧЧ:ММ:СС. */
  part?: 'days' | 'time';
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

  if (part === 'time') {
    if (isExpired) return null;
    return <span className="tabular-nums">{clock}</span>;
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2 text-right">
      <div className="xsg-eyebrow flex items-center gap-1.5">{t('dashboard.remaining')}</div>
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
          <span className="text-sm font-medium text-dark-400">{t('subscription.daysShort')}</span>
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
  const haptic = useHaptic();
  const [copied, setCopied] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Device/traffic topup state
  const [showDeviceTopup, setShowDeviceTopup] = useState(false);
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [showDeviceReduction, setShowDeviceReduction] = useState(false);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  const [showTrafficTopup, setShowTrafficTopup] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const isDesktop = useIsDesktop();
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

  const { data: subscriptionResponse, isLoading } = useQuery({
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
  const zone = useTrafficZone(usedPercent);
  // Спокойная зона — зелёная плашка, остальные — своего цвета.
  const pillRaw = zone.colorKey === 'accent' ? 'var(--color-success-400)' : zone.mainVarRaw;

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
    setShowDeviceTopup(false);
    setShowDeviceReduction(false);
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

  const copyUrl = () => {
    if (displayedConnectionUrl) {
      void copyToClipboard(displayedConnectionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  const statusBadge = (sub: NonNullable<typeof subscription>) => (
    <span
      className="max-w-[55%] shrink-0 rounded-full px-3.5 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider"
      style={{
        background: sub.is_active
          ? 'rgba(var(--color-accent-500), 0.14)'
          : sub.is_limited
            ? 'rgba(255,184,0,0.12)'
            : 'rgba(255,59,92,0.12)',
        border: sub.is_active
          ? '1px solid rgba(var(--color-accent-400), 0.45)'
          : sub.is_limited
            ? '1px solid rgba(255,184,0,0.25)'
            : '1px solid rgba(255,59,92,0.25)',
        color: sub.is_active
          ? 'rgb(var(--color-accent-300))'
          : sub.is_limited
            ? 'rgb(var(--color-urgent-400))'
            : 'rgb(var(--color-critical-500))',
      }}
    >
      {sub.is_active
        ? sub.is_trial
          ? t('subscription.trialStatus')
          : t('subscription.active')
        : sub.is_limited
          ? t('subscription.trafficLimited')
          : sub.status === 'disabled'
            ? t('subscription.pause.suspended')
            : t('subscription.expired')}
    </span>
  );

  const autopayInner = subscription ? (
    <>
      <AutopayToggle
        subscription={subscription}
        subscriptionId={subscriptionId}
        accentColor={zone.mainHex}
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

  const connectInner = subscription ? (
    <>
      {subscription.subscription_url &&
        (() => {
          const connectedDevices = devicesData?.total ?? 0;
          const isAtDeviceLimit =
            subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;
          return (
            <button
              type="button"
              disabled={isAtDeviceLimit}
              onClick={() => {
                if (isAtDeviceLimit) {
                  haptic.notification('error');
                  return;
                }
                navigate(subscriptionId ? `/connection?sub=${subscriptionId}` : '/connection');
              }}
              className={`flex min-h-16 w-full items-center gap-3.5 rounded-2xl border border-accent-500/40 bg-accent-500/15 px-4 text-left text-dark-50 transition-colors hover:border-accent-400/60 hover:bg-accent-500/25 ${isAtDeviceLimit ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-500/20 text-accent-300">
                <DevicesIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold tracking-tight">
                  {t('dashboard.connectDevice')}
                </div>
                <div className="mt-0.5 text-[12.5px] font-medium text-dark-300">
                  {subscription.device_limit === 0
                    ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
                    : t('dashboard.devicesOfMax', {
                        used: connectedDevices,
                        max: subscription.device_limit,
                      })}
                </div>
                {isAtDeviceLimit && (
                  <div className="mt-0.5 text-[11px] font-bold">
                    {t('dashboard.deviceLimitReached')}
                  </div>
                )}
              </div>
              <ChevronRightIcon className="h-5 w-5 flex-shrink-0" />
            </button>
          );
        })()}
      {displayedConnectionUrl && !shouldHideConnectionLink && (
        <div className="flex gap-2.5">
          <code
            className="flex h-12 min-w-0 flex-1 items-center truncate whitespace-nowrap rounded-[14px] px-4 font-mono text-[13px] text-dark-300"
            style={{ background: g.codeBg, border: `1px solid ${g.codeBorder}` }}
            title={displayedConnectionUrl}
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
      )}
    </>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WebBackButton to={isMultiTariff ? '/subscriptions' : '/'} />
          <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">
            {isMultiTariff && subscription?.tariff_name
              ? subscription.tariff_name
              : t('subscription.title')}
          </h1>
        </div>
        {subscription && statusBadge(subscription)}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          {/* Current Subscription */}
          {subscription ? (
            (() => {
              const usedGb = trafficData?.traffic_used_gb ?? subscription.traffic_used_gb;
              const isUnlimited =
                (trafficData?.is_unlimited ?? false) || subscription.traffic_limit_gb === 0;
              return (
                <>
                  <div
                    className="relative order-1 overflow-hidden rounded-[20px] p-5 sm:p-8"
                    style={{
                      background: g.cardBg,
                      border: subscription.is_trial
                        ? '1px solid rgba(var(--color-accent-400), 0.15)'
                        : isDark
                          ? `1px solid ${g.cardBorder}`
                          : `1px solid ${zone.mainHex}25`,
                      boxShadow: isDark
                        ? g.shadow
                        : `0 2px 16px ${zone.mainHex}12, 0 0 0 1px ${zone.mainHex}08`,
                    }}
                  >
                    {/* Decorative ambient radial + trial shimmer border were
                  removed: they carried no information, leaked zone/accent
                  hue into pure decoration (violates DESIGN.md
                  Tunable-but-Scarce + Status-Hue Lockout rules), and the
                  same chrome was distilled out of SubscriptionCardActive
                  earlier in this branch. Trial state is conveyed by the
                  header badge. */}

                    {/* ─── Header ─── */}
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="xsg-eyebrow mb-2">{t('dashboard.tariff')}</div>
                        <h2 className="break-words text-[28px] font-bold leading-tight tracking-tight text-dark-50 sm:text-[32px]">
                          {planTitle(subscription, t)}
                        </h2>
                      </div>
                      <CountdownTimer
                        endDate={subscription.end_date}
                        isActive={subscription.is_active || subscription.is_limited}
                        glassColors={g}
                      />
                    </div>
                    <div className="mb-5 flex items-center justify-between gap-3 text-[12.5px] text-dark-400">
                      <span>
                        {t('subscription.expiresAt')}{' '}
                        {new Date(subscription.end_date).toLocaleDateString(uiLocale(), {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <CountdownTimer
                        part="time"
                        endDate={subscription.end_date}
                        isActive={subscription.is_active || subscription.is_limited}
                        glassColors={g}
                      />
                    </div>

                    <div
                      aria-hidden="true"
                      className="-mx-5 mb-5 h-px bg-accent-500/15 sm:-mx-8 lg:hidden"
                    />

                    {/* ─── Traffic Limited Banner ─── */}
                    {subscription.is_limited && (
                      <div
                        className="mb-6 rounded-[14px] p-4"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))',
                          border: '1px solid rgba(255,184,0,0.2)',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                            style={{ background: 'rgba(255,184,0,0.12)' }}
                          >
                            <WarningIcon className="h-4 w-4 text-urgent-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: 'rgb(var(--color-urgent-400))' }}
                            >
                              {t('subscription.trafficLimitedTitle')}
                            </p>
                            <p className="mt-1 text-xs text-dark-400">
                              {t('subscription.trafficLimitedDescription')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── Trial Info Banner ─── */}
                    {subscription.is_trial && subscription.is_active && (
                      <div
                        className="mb-6 rounded-[14px] p-4"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(var(--color-accent-400), 0.08), rgba(var(--color-accent-400), 0.03))',
                          border: '1px solid rgba(var(--color-accent-400), 0.12)',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                            style={{ background: 'rgba(var(--color-accent-400), 0.12)' }}
                          >
                            <ClockIcon className="h-4 w-4 text-accent-400" />
                          </div>
                          <div className="flex-1">
                            <div
                              className="text-sm font-semibold"
                              style={{ color: 'rgb(var(--color-accent-400))' }}
                            >
                              {t('subscription.trialInfo.title')}
                            </div>
                            <div className="mt-1 text-[12px] text-dark-400">
                              {t('subscription.trialInfo.description')}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-mono text-[12px] font-semibold"
                                  style={{ color: 'rgb(var(--color-accent-400))' }}
                                >
                                  {subscription.days_left > 0
                                    ? t('subscription.days', { count: subscription.days_left })
                                    : `${subscription.hours_left}${t('subscription.hours')} ${subscription.minutes_left}${t('subscription.minutes')}`}
                                </span>
                                <span className="text-[11px] text-dark-400">
                                  {t('subscription.trialInfo.remaining')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-mono text-[12px] font-semibold"
                                  style={{ color: 'rgb(var(--color-accent-400))' }}
                                >
                                  {subscription.traffic_limit_gb || '∞'} {t('common.units.gb')}
                                </span>
                                <span className="text-[11px] text-dark-400">
                                  {t('subscription.traffic')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-mono text-[12px] font-semibold"
                                  style={{ color: 'rgb(var(--color-accent-400))' }}
                                >
                                  {subscription.device_limit === 0
                                    ? '∞'
                                    : subscription.device_limit}
                                </span>
                                {/* Слово по числу: было «1 Устройства». Безлимит — «∞ устройств». */}
                                <span className="text-[11px] text-dark-400">
                                  {t('subscription.devicesWord', {
                                    count:
                                      subscription.device_limit === 0
                                        ? 5
                                        : subscription.device_limit,
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── Продлить + автопродление: на телефоне внизу карточки тарифа ─── */}
                    <div className="mt-5 space-y-2.5 lg:hidden">
                      <PurchaseCTAButton
                        subscription={subscription}
                        isMultiTariff={isMultiTariff}
                        inline
                      />
                      <ChangeTariffButton
                        subscription={subscription}
                        isMultiTariff={isMultiTariff}
                        inline
                      />
                    </div>
                    {!isDesktop && (
                      <div className="xsg-autopay mt-4 border-t border-accent-500/15">
                        {autopayInner}
                      </div>
                    )}
                  </div>

                  {!isUnlimited && (
                    <div
                      className="xsg-traffic order-2 overflow-hidden rounded-[20px]"
                      style={{
                        background: g.cardBg,
                        border: `1px solid ${g.cardBorder}`,
                        boxShadow: g.shadow,
                      }}
                    >
                      <CollapsibleSection
                        title={t('dashboard.trafficUsageTitle')}
                        summary={
                          <span>
                            <b className="font-bold text-dark-50">{formatTraffic(usedGb)}</b>
                            {` / ${formatTraffic(subscription.traffic_limit_gb)}`}
                          </span>
                        }
                        collapsedPreview={
                          <span
                            aria-hidden="true"
                            className="block h-1.5 w-full overflow-hidden rounded-full bg-accent-500/15"
                          >
                            <span
                              className="block h-full rounded-full bg-accent-500"
                              style={{ width: `${Math.min(100, Math.max(2, usedPercent))}%` }}
                            />
                          </span>
                        }
                      >
                        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
                          {/* ─── Traffic Progress ─── */}
                          {!isUnlimited && (
                            <>
                              <div className="mb-5">
                                <div className="mb-2 flex items-center justify-between gap-x-4 gap-y-2">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    {subscription.traffic_limit_gb > 0 && (
                                      <span className="whitespace-nowrap rounded-full border border-accent-500/40 bg-accent-500/10 px-2.5 py-1 text-[11px] font-bold text-accent-300">
                                        {t('subscription.trafficScope.badge', 'только 📡 серверы')}
                                      </span>
                                    )}
                                    {(isUnlimited || zone.colorKey !== 'accent') && (
                                      <span
                                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                                        style={{
                                          color: `rgb(${pillRaw})`,
                                          background: `rgba(${pillRaw}, 0.12)`,
                                          border: `1px solid rgba(${pillRaw}, 0.35)`,
                                        }}
                                      >
                                        <span
                                          className="h-1.5 w-1.5 rounded-full"
                                          style={{ background: `rgb(${pillRaw})` }}
                                          aria-hidden="true"
                                        />
                                        {isUnlimited ? t('dashboard.unlimited') : t(zone.labelKey)}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => refreshTrafficMutation.mutate()}
                                    disabled={
                                      refreshTrafficMutation.isPending || trafficRefreshCooldown > 0
                                    }
                                    className="-mr-2 flex h-10 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium text-dark-400 transition-colors hover:text-dark-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label={t('common.refresh')}
                                    title={t('common.refresh')}
                                  >
                                    <RefreshIcon
                                      className="h-4 w-4"
                                      spinning={refreshTrafficMutation.isPending}
                                    />
                                    {trafficRefreshCooldown > 0 && (
                                      <span className="tabular-nums text-dark-500">
                                        {trafficRefreshCooldown}s
                                      </span>
                                    )}
                                  </button>
                                </div>
                                <div className="mb-3 flex items-baseline justify-between gap-3 tabular-nums">
                                  <span className="text-[13px] text-dark-400">
                                    <b className="text-[15px] font-bold text-dark-50">
                                      {formatTraffic(usedGb)}
                                    </b>
                                    {!isUnlimited &&
                                      ` / ${formatTraffic(subscription.traffic_limit_gb)}`}
                                  </span>
                                  {!isUnlimited && (
                                    <span className="text-[13px] text-dark-400">
                                      {Math.round(usedPercent)}%
                                    </span>
                                  )}
                                </div>
                                <TrafficProgressBar
                                  usedGb={usedGb}
                                  limitGb={subscription.traffic_limit_gb}
                                  percent={usedPercent}
                                  isUnlimited={isUnlimited}
                                />
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <span className="text-xs text-dark-500">
                                    {subscription.traffic_reset_mode &&
                                    subscription.traffic_reset_mode !== 'NO_RESET'
                                      ? t(
                                          `subscription.trafficReset.${subscription.traffic_reset_mode}`,
                                        )
                                      : ''}
                                  </span>
                                </div>
                                {!isUnlimited && subscription.traffic_limit_gb > 0 && (
                                  <p className="mt-3 text-[13px] leading-relaxed text-dark-300">
                                    {t(
                                      'subscription.trafficScope.note',
                                      'Трафик списывается только на серверах с отметкой 📡. На остальных серверах расход не считается — они безлимитные.',
                                    )}
                                  </p>
                                )}
                              </div>
                            </>
                          )}

                          {/* ─── Purchased Traffic Packages ─── */}
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

                          {/* ─── Buy traffic (action row) ─── */}
                          {showsAddonOptions(subscription) && subscription.traffic_limit_gb > 0 && (
                            <div className="xsg-linkrow mt-3 lg:mt-5">
                              <TrafficTopupSheet
                                open={showTrafficTopup}
                                onOpen={() => setShowTrafficTopup(true)}
                                onClose={() => setShowTrafficTopup(false)}
                                subscription={subscription}
                                subscriptionId={subscriptionId}
                                selectedTrafficPackage={selectedTrafficPackage}
                                onSelectedTrafficPackageChange={setSelectedTrafficPackage}
                                purchaseOptions={purchaseOptions}
                                isDark={isDark}
                              />
                            </div>
                          )}
                        </div>
                      </CollapsibleSection>
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            <div
              className="relative overflow-hidden rounded-[20px] py-12 text-center"
              style={{
                background: g.cardBg,
                border: `1px solid ${g.cardBorder}`,
                boxShadow: g.shadow,
              }}
            >
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: g.hoverBg, color: g.textFaint }}
              >
                <TrashIcon className="h-8 w-8" />
              </div>
              <div className="text-sm text-dark-400">{t('subscription.noSubscription')}</div>
            </div>
          )}

          <div className="order-3 empty:hidden">
            {/* Daily Subscription Pause */}
            {subscription?.is_daily && !subscription.is_trial && (
              <div
                className="relative overflow-hidden rounded-[20px]"
                style={{
                  background: g.cardBg,
                  border: `1px solid ${g.cardBorder}`,
                  boxShadow: g.shadow,
                  padding: '24px 28px',
                }}
              >
                <DailyPausePanel subscription={subscription} subscriptionId={subscriptionId} />
              </div>
            )}
          </div>

          <div className="order-4 empty:hidden">
            {/* My Devices Section */}
            {subscription && (
              <div
                className="xsg-devices relative overflow-hidden rounded-[20px]"
                style={{
                  background: g.cardBg,
                  border: `1px solid ${g.cardBorder}`,
                  boxShadow: g.shadow,
                }}
              >
                {(subscription.subscription_url || displayedConnectionUrl) && (
                  <div className="flex flex-col gap-3 border-b border-accent-500/15 p-4">
                    {connectInner}
                  </div>
                )}
                <CollapsibleSection
                  title={t('subscription.myDevices')}
                  summary={
                    devicesData ? (
                      <span>
                        {devicesData.device_limit === 0
                          ? `${devicesData.total ?? devicesData.devices?.length ?? 0} · ∞`
                          : `${devicesData.total ?? devicesData.devices?.length ?? 0} / ${devicesData.device_limit}`}
                      </span>
                    ) : null
                  }
                >
                  <div className="px-5 pt-5 sm:px-7 sm:pt-6">
                    <DevicesPanel
                      subscription={subscription}
                      subscriptionId={subscriptionId}
                      hideTitle
                    />
                  </div>
                  {showsAddonOptions(subscription) && (
                    <div
                      className={`xsg-devactions mt-1 p-4 ${
                        showDeviceTopup || showDeviceReduction
                          ? 'space-y-3'
                          : 'grid grid-cols-2 gap-3'
                      }`}
                    >
                      <DeviceTopupSheet
                        open={showDeviceTopup}
                        onOpen={() => setShowDeviceTopup(true)}
                        onClose={() => setShowDeviceTopup(false)}
                        subscription={subscription}
                        subscriptionId={subscriptionId}
                        devicesToAdd={devicesToAdd}
                        onDevicesToAddChange={setDevicesToAdd}
                        purchaseOptions={purchaseOptions}
                        isDark={isDark}
                      />
                      <DeviceReductionSheet
                        open={showDeviceReduction}
                        onOpen={() => setShowDeviceReduction(true)}
                        onClose={() => setShowDeviceReduction(false)}
                        subscriptionPresent={!!subscription}
                        subscriptionId={subscriptionId}
                        targetDeviceLimit={targetDeviceLimit}
                        onTargetDeviceLimitChange={setTargetDeviceLimit}
                        isDark={isDark}
                      />
                    </div>
                  )}
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
          <div className="order-5 hidden space-y-3 empty:hidden lg:block">
            {/* Purchase / Renewal CTA (на телефоне — внутри карточки тарифа) */}
            <PurchaseCTAButton subscription={subscription} isMultiTariff={isMultiTariff} />
            <ChangeTariffButton subscription={subscription} isMultiTariff={isMultiTariff} />
          </div>

          {/* Autopay + recurring (способы автоплатежа свёрнуты) — на телефоне внутри карточки тарифа */}
          {isDesktop && subscription && (
            <div
              className="xsg-autopay order-6 relative overflow-hidden rounded-[20px] empty:hidden"
              style={{
                background: g.cardBg,
                border: `1px solid ${g.cardBorder}`,
                padding: '0 20px',
              }}
            >
              {autopayInner}
            </div>
          )}

          <div className="order-7 empty:hidden">
            {/* Delete expired subscription */}
            {isMultiTariff &&
              subscription &&
              !subscription.is_active &&
              !subscription.is_trial &&
              !subscription.is_limited && (
                <div className="space-y-3">
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
                </div>
              )}
          </div>

          <div className="order-8 empty:hidden">
            {/* Reissue Subscription — standalone block, not dependent on device_limit */}
            {subscription && canReissueLink(subscription) && (
              <div>
                <ReissueLinkButton subscription={subscription} subscriptionId={subscriptionId} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
