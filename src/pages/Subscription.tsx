import { uiLocale } from '@/utils/uiLocale';
import { TrialAllowancePanel } from '@/components/subscription/TrialAllowancePanel';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { WebBackButton } from '../components/WebBackButton';
import ConnectDeviceTile from '../components/dashboard/ConnectDeviceTile';
import TrafficRefreshButton from '../components/dashboard/TrafficRefreshButton';
import TrafficProgressBar from '../components/dashboard/TrafficProgressBar';
import { useTrafficZone } from '../hooks/useTrafficZone';
import { formatTraffic, formatTrafficPercent } from '../utils/formatTraffic';
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
  ChatIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  TrashIcon,
  WarningIcon,
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
    <div className="flex min-w-0 flex-col items-end gap-2 text-right">
      <div className="text-xs text-dark-300">{t('dashboard.remaining')}</div>
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
  const [copied, setCopied] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Device/traffic topup state
  const [showDeviceTopup, setShowDeviceTopup] = useState(false);
  const [devicesToAdd, setDevicesToAdd] = useState(1);
  const [showDeviceReduction, setShowDeviceReduction] = useState(false);
  const [targetDeviceLimit, setTargetDeviceLimit] = useState<number>(1);
  const [showTrafficTopup, setShowTrafficTopup] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
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

  const statusBadge = (sub: NonNullable<typeof subscription>) => {
    const warning = sub.is_limited || (sub.is_active && sub.days_left <= 3);
    const color = warning
      ? 'text-warning-400'
      : sub.is_active
        ? 'text-success-400'
        : 'text-critical-500';
    const label = sub.is_limited
      ? t('subscription.trafficLimited')
      : sub.status === 'disabled'
        ? t('subscription.pause.suspended')
        : sub.is_active
          ? sub.days_left <= 3
            ? t('dashboard.ui.endingSoon', 'Скоро закончится')
            : t('dashboard.ui.active', 'Активна')
          : sub.is_expired
            ? t('subscription.expired')
            : t('dashboard.ui.statusUnknown', 'Статус уточняется');
    return (
      <span className={`inline-flex max-w-[55%] items-center gap-1.5 text-xs font-medium ${color}`}>
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
        {label}
      </span>
    );
  };

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
      )
    : null;

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WebBackButton to={isMultiTariff ? '/subscriptions' : '/'} />
          <h1 className="min-w-0 break-words text-xl font-semibold text-dark-100 [overflow-wrap:anywhere] sm:text-2xl">
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
                    className="relative order-1 overflow-hidden rounded-3xl p-4 sm:p-6"
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
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 text-xs font-medium text-dark-300">
                          {t('dashboard.tariff')}
                        </div>
                        <h2 className="break-words text-xl font-bold leading-tight tracking-tight text-dark-50 [overflow-wrap:anywhere] sm:text-2xl">
                          {planTitle(subscription, t)}
                        </h2>
                      </div>
                      <CountdownTimer
                        endDate={subscription.end_date}
                        isActive={subscription.is_active || subscription.is_limited}
                        glassColors={g}
                      />
                    </div>
                    <div className="mb-3 text-xs leading-relaxed text-dark-300">
                      {t('dashboard.validUntil', {
                        date: new Date(subscription.end_date).toLocaleDateString(uiLocale()),
                      })}
                    </div>

                    <div aria-hidden="true" className="mb-3 h-px bg-accent-500/15" />

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
                        className="mb-6 rounded-[20px] border border-accent-400/25 p-4"
                        style={{
                          background:
                            'radial-gradient(120% 80% at 50% 0%, rgba(var(--color-accent-500), 0.2), transparent 65%), linear-gradient(180deg, rgba(var(--color-accent-500), 0.06), transparent 60%)',
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
                        <TrialAllowancePanel
                          trafficLimitGb={subscription.traffic_limit_gb}
                          compact
                        />
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

                    {(subscription.is_active || subscription.is_limited) &&
                      subscription.subscription_url && (
                        <div className="mb-3">
                          <ConnectDeviceTile
                            subscription={subscription}
                            connectedDevices={devicesData?.total ?? 0}
                            connectionPath={
                              subscriptionId ? `/connection?sub=${subscriptionId}` : '/connection'
                            }
                            onManage={() => {
                              setDevicesOpen(true);
                              requestAnimationFrame(() =>
                                document
                                  .getElementById('subscription-devices')
                                  ?.scrollIntoView({ behavior: 'auto', block: 'start' }),
                              );
                            }}
                          />
                        </div>
                      )}
                    <div className="mt-3 space-y-2 lg:hidden">
                      <PurchaseCTAButton
                        quiet={subscription.is_active && subscription.days_left > 3}
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
                    {!isDesktop && (
                      <div className="xsg-autopay mt-3 border-t border-accent-500/15">
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
                          <span className="block w-full space-y-2">
                            <span className="block text-xs leading-relaxed text-dark-300">
                              {t('dashboard.ui.trafficScope', 'На серверах обхода белых списков')}
                            </span>
                            <TrafficProgressBar
                              usedGb={usedGb}
                              limitGb={subscription.traffic_limit_gb}
                              percent={usedPercent}
                              isUnlimited={false}
                              compact
                            />
                            <span className="block text-xs text-dark-300">
                              {Number.isFinite(usedGb)
                                ? t('dashboard.ui.trafficRemaining', {
                                    defaultValue: 'Осталось {{amount}}',
                                    amount: formatTraffic(
                                      Math.max(0, subscription.traffic_limit_gb - usedGb),
                                    ),
                                  })
                                : t('dashboard.ui.noTraffic', 'Статистика пока недоступна')}
                            </span>
                          </span>
                        }
                      >
                        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
                          {/* ─── Traffic Progress ─── */}
                          {!isUnlimited && (
                            <div className="mb-5">
                              <div className="mb-2 flex items-center justify-between gap-x-4 gap-y-2">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  {subscription.traffic_limit_gb > 0 && (
                                    <span className="whitespace-nowrap rounded-full border border-accent-500/40 bg-accent-500/10 px-2.5 py-1 text-[11px] font-bold text-accent-300">
                                      {t(
                                        'dashboard.ui.trafficScope',
                                        'На серверах обхода белых списков',
                                      )}
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
                                <TrafficRefreshButton
                                  cooldown={trafficRefreshCooldown}
                                  pending={refreshTrafficMutation.isPending}
                                  onRefresh={() => refreshTrafficMutation.mutate()}
                                />
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
                                    {formatTrafficPercent(usedPercent)}
                                  </span>
                                )}
                              </div>
                              <TrafficProgressBar
                                usedGb={usedGb}
                                limitGb={subscription.traffic_limit_gb}
                                percent={usedPercent}
                                isUnlimited={isUnlimited}
                                compact
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

                          {refreshTrafficMutation.isError && (
                            <p role="status" className="mt-2 text-xs text-warning-400">
                              {t(
                                'dashboard.ui.refreshError',
                                'Не удалось обновить. Показан последний замер.',
                              )}
                            </p>
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
                id="subscription-devices"
                className="xsg-devices relative scroll-mt-24 overflow-hidden rounded-[20px]"
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
                  open={devicesOpen}
                  onOpenChange={setDevicesOpen}
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
            <PurchaseCTAButton
              subscription={subscription}
              isMultiTariff={isMultiTariff}
              inline
              quiet={!!subscription?.is_active && subscription.days_left > 3}
            />
            <ChangeTariffButton quiet subscription={subscription} isMultiTariff={isMultiTariff} />
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

          {subscription && canReissueLink(subscription) && (
            <div className="order-7 rounded-2xl border border-[var(--xsg-line)] bg-dark-800">
              <CollapsibleSection
                title={t('subscription.manage.additional', 'Дополнительные действия')}
              >
                <div className="px-4 pb-4">
                  <ReissueLinkButton
                    subscription={subscription}
                    subscriptionId={subscriptionId}
                    inline
                    quiet
                  />
                </div>
              </CollapsibleSection>
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
        </div>
      </div>
    </div>
  );
}
