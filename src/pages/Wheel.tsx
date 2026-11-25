import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wheelApi, type WheelPrize, type SpinResult } from '../api/wheel';
import FortuneWheel from '../components/wheel/FortuneWheel';
import RecentWinsStrip from '../components/wheel/RecentWinsStrip';
import WheelHistory from '../components/wheel/WheelHistory';
import { rewardTitle, spinCost } from '../components/wheel/wheelPresentation';
import { jackpotIds, prizeLabel, prizeTypeColor } from '../components/wheel/wheelFaceModel';
import { usePlatform, useHaptic } from '@/platform';
import { useNotify } from '@/platform/hooks/useNotify';
import { Button } from '@/components/primitives/Button/Button';
import { PiCheck, PiCopy } from 'react-icons/pi';
import { copyToClipboard } from '@/utils/clipboard';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * Rotation (mod 360) that brings sector `prizeIndex` under the top pointer.
 * Mirrors the backend _calculate_rotation logic in wheel_service.py.
 */
function rotationForIndex(prizes: WheelPrize[], prizeIndex: number): number {
  if (prizes.length === 0) return 0;
  const sectorAngle = 360 / prizes.length;
  const baseAngle = prizeIndex * sectorAngle + sectorAngle / 2;
  const offset = (Math.random() - 0.5) * sectorAngle * 0.6; // ±30% within the sector
  return 360 - baseAngle + offset;
}

/**
 * Rotation that lands the wheel on the ACTUAL won prize's sector.
 *
 * Matches by prize_id (exact). It must NEVER land on a random sector: a random
 * angle was the root cause of "the wheel shows месяц/50₽ but the result is
 * Ничего" on the browser Stars path — when the prize couldn't be located the old
 * code span to Math.random()*360, which often pointed at a winning slot. When the
 * prize can't be resolved, the server result is shown without a fabricated angle.
 */
function calculateRotationForPrize(prizes: WheelPrize[], result: SpinResult): number | null {
  let prizeIndex = result.prize_id != null ? prizes.findIndex((p) => p.id === result.prize_id) : -1;

  // Defensive fallbacks for older payloads without prize_id: name+emoji, then name.
  if (prizeIndex === -1 && result.prize_display_name) {
    prizeIndex = prizes.findIndex(
      (p) => p.display_name === result.prize_display_name && p.emoji === result.emoji,
    );
    if (prizeIndex === -1) {
      prizeIndex = prizes.findIndex((p) => p.display_name === result.prize_display_name);
    }
  }

  if (prizeIndex === -1) return null; // No matching sector: show the server result without inventing an angle.
  const prize = prizes[prizeIndex];
  if (
    prize.prize_type !== result.prize_type ||
    rewardTitle(prize) !==
      rewardTitle({ display_name: result.prize_display_name, prize_type: result.prize_type ?? '' })
  )
    return null;

  return rotationForIndex(prizes, prizeIndex);
}

export default function Wheel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openInvoice, capabilities } = usePlatform();
  const haptic = useHaptic();
  const notify = useNotify();

  const [isSpinning, setIsSpinning] = useState(false);
  const [targetRotation, setTargetRotation] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [promoCopied, setPromoCopied] = useState(false);
  const [paymentType, setPaymentType] = useState<'telegram_stars' | 'subscription_days'>(
    'telegram_stars',
  );
  const [isPayingStars, setIsPayingStars] = useState(false);
  const [showStarsConfirm, setShowStarsConfirm] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [pendingExternalPayment, setPendingExternalPayment] = useState(false);
  const [checkingExternalResult, setCheckingExternalResult] = useState(false);
  const spinInFlight = useRef(false);
  const starsBaseline = useRef(0);
  const starsInvoiceAmount = useRef<number | null>(null);
  const prizesForSpin = useRef<WheelPrize[] | null>(null);
  const [displayedPrizes, setDisplayedPrizes] = useState<WheelPrize[] | null>(null);

  const {
    data: config,
    isLoading,
    error,
    isFetching: refreshingConfig,
    refetch: refreshConfig,
  } = useQuery({
    queryKey: ['wheel-config'],
    queryFn: wheelApi.getConfig,
  });

  // Preserve a user's choice while it is valid; refresh eligibility from the server.
  useEffect(() => {
    if (!config) return;
    const stars = config.spin_cost_stars_enabled && config.spin_cost_stars;
    const days = config.spin_cost_days_enabled && config.spin_cost_days;
    if (paymentType === 'telegram_stars' && !stars && days) setPaymentType('subscription_days');
    else if (paymentType === 'subscription_days' && !days && stars)
      setPaymentType('telegram_stars');
    const eligible = config.eligible_subscriptions;
    if (eligible && !eligible.some((sub) => sub.id === selectedSubscriptionId))
      setSelectedSubscriptionId(eligible.length === 1 ? eligible[0].id : null);
  }, [config, paymentType, selectedSubscriptionId]);

  // Function to poll for new spin result after Stars payment
  const pollForSpinResult = useCallback(
    async (signal: AbortSignal, maxAttempts = 15, delayMs = 800) => {
      // Wait a bit before first poll to give the bot time to process the payment
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (signal.aborted) return null;

      const lastSpinIdBefore = starsBaseline.current;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal.aborted) return null;

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (signal.aborted) return null;

        try {
          const historyAfter = await wheelApi.getHistory(1, 1);

          // Check if we have a new spin (either new item or higher ID)
          if (historyAfter.items.length > 0) {
            const latestSpin = historyAfter.items[0];
            // If we had no spins before, or this spin has a higher ID
            if (
              (lastSpinIdBefore === 0 || latestSpin.id > lastSpinIdBefore) &&
              latestSpin.payment_type === 'telegram_stars' &&
              (starsInvoiceAmount.current === null ||
                latestSpin.payment_amount === starsInvoiceAmount.current)
            ) {
              // Found a new spin! Return it as SpinResult
              return {
                success: true,
                // WheelPrize id — lets the wheel land on the exact won sector.
                // (Was latestSpin.id, the SPIN id, which never matched a sector and
                // forced the random-angle fallback → the fake-win bug.)
                prize_id: latestSpin.prize_id,
                prize_type: latestSpin.prize_type,
                prize_value: latestSpin.prize_value,
                prize_display_name: latestSpin.prize_display_name,
                emoji: latestSpin.emoji,
                color: latestSpin.color,
                rotation_degrees: 0, // Not needed for result display
                message:
                  latestSpin.prize_type === 'nothing'
                    ? t('wheel.noPrize')
                    : `${t('wheel.youWon')} ${latestSpin.prize_display_name}!`,
                promocode: null, // Promocode is sent to bot chat
                error: null,
              } as SpinResult;
            }
          }
        } catch {
          // Continue polling on error
        }
      }

      // Timeout - couldn't find new spin
      return null;
    },
    [t],
  );

  // Ref to store pending Stars payment result
  const pendingStarsResultRef = useRef<SpinResult | null>(null);
  const isStarsSpinRef = useRef(false);
  const pollingAbortRef = useRef<AbortController | null>(null);
  const preOpenedWindowRef = useRef<Window | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingAbortRef.current) {
        pollingAbortRef.current.abort();
      }
    };
  }, []);

  const showUnconfirmedResult = (message: string, pending = true) => {
    spinInFlight.current = pending;
    setPendingExternalPayment(pending);
    isStarsSpinRef.current = false;
    pendingStarsResultRef.current = null;
    setIsPayingStars(false);
    setIsSpinning(false);
    setTargetRotation(null);
    setSpinResult({
      success: true,
      prize_id: null,
      prize_type: null,
      prize_value: 0,
      prize_display_name: '',
      emoji: '',
      color: '#8B5CF6',
      rotation_degrees: 0,
      message,
      promocode: null,
      error: null,
    });
    queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
    queryClient.invalidateQueries({ queryKey: ['wheel-history'] });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
    queryClient.invalidateQueries({ queryKey: ['wheel-recent-wins'] });
  };

  const starsInvoiceMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const before = await wheelApi.getHistory(1, 1);
      starsBaseline.current = before.items[0]?.id ?? 0;
      return wheelApi.createStarsInvoice();
    },
    onSuccess: async (data) => {
      starsInvoiceAmount.current = data.stars_amount;
      // Use platform's openInvoice if available
      if (capabilities.hasInvoice) {
        const status = await openInvoice(data.invoice_url);

        if (status === 'paid') {
          // Mark this as a Stars spin so handleSpinComplete knows to use the pending result
          isStarsSpinRef.current = true;
          pendingStarsResultRef.current = null;

          // Cancel any existing polling
          if (pollingAbortRef.current) {
            pollingAbortRef.current.abort();
          }
          pollingAbortRef.current = new AbortController();

          // Keep isPayingStars=true to show loading state while polling for result.
          // We poll FIRST to get the actual prize, then calculate the correct
          // rotation angle so the wheel visually lands on the right sector.
          const abortSignal = pollingAbortRef.current.signal;
          pollForSpinResult(abortSignal)
            .then((result) => {
              if (abortSignal.aborted) return;

              queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
              queryClient.invalidateQueries({ queryKey: ['wheel-history'] });

              setIsPayingStars(false);

              if (result) {
                pendingStarsResultRef.current = result;
                // Land on the ACTUAL won sector (matched by prize_id).
                const rotation = calculateRotationForPrize(
                  prizesForSpin.current ?? config?.prizes ?? [],
                  result,
                );
                if (rotation === null) {
                  showUnconfirmedResult(result.message, false);
                  setSpinResult(result);
                  return;
                }
                setTargetRotation(rotation);
              } else {
                showUnconfirmedResult(t('wheel.starsPaymentSuccessCheckHistory'));
                return;
              }

              setIsSpinning(true);
            })
            .catch(() => {
              if (abortSignal.aborted) return;

              setIsPayingStars(false);

              showUnconfirmedResult(t('wheel.starsPaymentSuccessCheckHistory'));
            });
        } else if (status !== 'cancelled') {
          spinInFlight.current = false;
          setIsPayingStars(false);
          setSpinResult({
            success: false,
            prize_id: null,
            prize_type: null,
            prize_value: 0,
            prize_display_name: '',
            emoji: '😔',
            color: '#EF4444',
            rotation_degrees: 0,
            message: t('wheel.starsPaymentFailed'),
            promocode: null,
            error: 'payment_failed',
          });
        } else {
          spinInFlight.current = false;
          setIsPayingStars(false);
        }
      } else {
        // Fallback: redirect pre-opened window to invoice URL
        spinInFlight.current = false;
        setIsPayingStars(false);
        setPendingExternalPayment(true);
        if (preOpenedWindowRef.current) {
          preOpenedWindowRef.current.location.href = data.invoice_url;
          preOpenedWindowRef.current = null;
        }
        setSpinResult({
          success: true,
          prize_id: null,
          prize_type: null,
          prize_value: 0,
          prize_display_name: '',
          emoji: '⭐',
          color: '#8B5CF6',
          rotation_degrees: 0,
          message: t('wheel.starsPaymentRedirected'),
          promocode: null,
          error: null,
        });
      }
    },
    onError: () => {
      spinInFlight.current = false;
      setIsPayingStars(false);
      if (preOpenedWindowRef.current) {
        preOpenedWindowRef.current.close();
        preOpenedWindowRef.current = null;
      }
      setSpinResult({
        success: false,
        prize_id: null,
        prize_type: null,
        prize_value: 0,
        prize_display_name: '',
        emoji: '😔',
        color: '#EF4444',
        rotation_degrees: 0,
        message: t('wheel.errors.networkError'),
        promocode: null,
        error: 'network_error',
      });
    },
  });

  const handleDirectStarsPay = () => {
    if (spinInFlight.current || spinDisabled) return;
    spinInFlight.current = true;
    prizesForSpin.current = config?.prizes.map((prize) => ({ ...prize })) ?? null;
    setDisplayedPrizes(prizesForSpin.current);
    setSpinResult(null);
    setTargetRotation(null);
    setShowStarsConfirm(false);
    setIsPayingStars(true);
    // In browser: pre-open window synchronously (direct user gesture) to avoid popup blocker
    if (!capabilities.hasInvoice) {
      // Web-only: synchronously pre-open a tab during the user gesture to dodge the
      // popup blocker before the async invoice URL resolves. Not reached in Telegram
      // (hasInvoice is true there, so the native invoice flow is used instead).
      // biome-ignore lint: canonical popup-blocker workaround, see comment above
      preOpenedWindowRef.current = window.open('about:blank', '_blank') || null;
      if (!preOpenedWindowRef.current) {
        spinInFlight.current = false;
        setIsPayingStars(false);
        setSpinResult({
          success: false,
          prize_id: null,
          prize_type: null,
          prize_value: 0,
          prize_display_name: '',
          emoji: '',
          color: '',
          rotation_degrees: 0,
          promocode: null,
          error: 'popup_blocked',
          message: 'Не удалось открыть оплату. Разрешите всплывающие окна для сайта и повторите.',
        });
        return;
      }
    }
    starsInvoiceMutation.mutate();
  };

  const spinMutation = useMutation({
    retry: false,
    mutationFn: () => wheelApi.spin(paymentType, selectedSubscriptionId ?? undefined),
    onSuccess: (result) => {
      if (result.success) {
        const prizes = prizesForSpin.current ?? config?.prizes ?? [];
        const matchedRotation = calculateRotationForPrize(prizes, result);
        if (matchedRotation === null) {
          showUnconfirmedResult(result.message, false);
          setSpinResult(result);
          return;
        }
        const raw = result.rotation_degrees;
        const rawIndex = Math.floor(
          ((360 - (((raw % 360) + 360) % 360)) % 360) / (360 / prizes.length),
        );
        const actualIndex = prizes.findIndex((prize) => prize.id === result.prize_id);
        setTargetRotation(Number.isFinite(raw) && rawIndex === actualIndex ? raw : matchedRotation);
        setSpinResult(result);
      } else {
        spinInFlight.current = false;
        setIsSpinning(false);
        setSpinResult(result);
        queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
      }
    },
    onError: () => {
      spinInFlight.current = false;
      setIsSpinning(false);
      queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
      queryClient.invalidateQueries({ queryKey: ['wheel-history'] });
      setSpinResult({
        success: false,
        message: 'Не удалось получить результат. Проверьте историю перед повторным вращением.',
        error: 'network_error',
        prize_id: null,
        prize_type: null,
        prize_value: 0,
        prize_display_name: '',
        emoji: '',
        color: '',
        rotation_degrees: 0,
        promocode: null,
      });
    },
  });

  const checkExternalResult = async () => {
    if (checkingExternalResult) return;
    setCheckingExternalResult(true);
    try {
      const recent = await wheelApi.getHistory(1, 1);
      const item = recent.items[0];
      if (
        item &&
        item.id > starsBaseline.current &&
        item.payment_type === 'telegram_stars' &&
        (starsInvoiceAmount.current === null || item.payment_amount === starsInvoiceAmount.current)
      ) {
        const result: SpinResult = {
          success: true,
          prize_id: item.prize_id,
          prize_type: item.prize_type,
          prize_value: item.prize_value,
          prize_display_name: item.prize_display_name,
          emoji: item.emoji,
          color: item.color,
          rotation_degrees: 0,
          message:
            item.prize_type === 'promocode'
              ? 'Вы выиграли промокод. Проверьте сообщение бота.'
              : 'Результат подтверждён в истории вращений.',
          promocode: null,
          error: null,
        };
        const rotation = calculateRotationForPrize(
          prizesForSpin.current ?? config?.prizes ?? [],
          result,
        );
        setPendingExternalPayment(false);
        if (rotation === null) {
          showUnconfirmedResult(result.message, false);
          setSpinResult(result);
        } else {
          spinInFlight.current = true;
          isStarsSpinRef.current = true;
          pendingStarsResultRef.current = result;
          setTargetRotation(rotation);
          setIsSpinning(true);
        }
      } else
        showUnconfirmedResult(
          'Нового результата пока нет. Проверьте оплату в Telegram и обновите результат.',
        );
    } catch {
      showUnconfirmedResult('Не удалось проверить результат. Попробуйте обновить его позже.');
    } finally {
      setCheckingExternalResult(false);
    }
  };

  const handleSpin = () => {
    if (spinInFlight.current || spinDisabled) return;
    spinInFlight.current = true;
    prizesForSpin.current = config?.prizes.map((prize) => ({ ...prize })) ?? null;
    setDisplayedPrizes(prizesForSpin.current);
    setTargetRotation(null);
    setSpinResult(null);
    setIsSpinning(true);
    spinMutation.mutate();
  };

  const handleUnifiedSpin = () => {
    if (spinInFlight.current || spinDisabled) return;
    if (paymentType === 'telegram_stars') {
      if (!config?.spin_cost_stars_enabled || !config?.spin_cost_stars) {
        notify.warning(t('wheel.starsNotAvailable'));
        return;
      }
      setShowStarsConfirm(true);
    } else {
      handleSpin();
    }
  };

  const handleSpinComplete = useCallback(() => {
    spinInFlight.current = false;
    setIsSpinning(false);

    // Check if this was a Stars payment spin
    if (isStarsSpinRef.current) {
      isStarsSpinRef.current = false;

      // Use the pending result from polling, or show a fallback
      if (pendingStarsResultRef.current) {
        setSpinResult(pendingStarsResultRef.current);
        if (pendingStarsResultRef.current.prize_type === 'nothing') {
          haptic.notification('warning');
        } else if (pendingStarsResultRef.current.prize_type) {
          haptic.notification('success');
        }
        pendingStarsResultRef.current = null;
      } else {
        // Polling still in progress or failed - show fallback
        setSpinResult({
          success: true,
          prize_id: null,
          prize_type: null,
          prize_value: 0,
          prize_display_name: '',
          emoji: '🎰',
          color: '#8B5CF6',
          rotation_degrees: 0,
          message: t('wheel.starsPaymentSuccessCheckHistory'),
          promocode: null,
          error: null,
        });
      }
    } else if (spinResult) {
      // Regular spin - haptic based on result
      if (spinResult.success && spinResult.prize_type !== 'nothing') {
        haptic.notification('success');
      } else {
        haptic.notification('warning');
      }
    }

    queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
    queryClient.invalidateQueries({ queryKey: ['wheel-history'] });
    queryClient.invalidateQueries({ queryKey: ['wheel-recent-wins'] });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
  }, [queryClient, t, haptic, spinResult]);

  const closeResultModal = () => {
    setSpinResult(null);
    setTargetRotation(null);
    prizesForSpin.current = null;
    setDisplayedPrizes(null);
  };

  if (isLoading) {
    return (
      <PageSkeleton titleWidth="w-40" className="space-y-6 pb-8">
        <Skeleton className="h-4 w-56" />
        <Skeleton variant="card" className="h-80" />
      </PageSkeleton>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-500/10">
          <span className="text-4xl">😔</span>
        </div>
        <p className="text-lg text-dark-400">{t('wheel.errors.loadFailed')}</p>
        <button
          type="button"
          onClick={() => void refreshConfig()}
          className="min-h-11 text-accent-300"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!config.is_enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-dark-800">
          <span className="text-5xl">🎡</span>
        </div>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-dark-100">{t('wheel.title')}</h1>
          <p className="text-dark-400">{t('wheel.disabled')}</p>
        </div>
      </div>
    );
  }

  const starsEnabled = config.spin_cost_stars_enabled && config.spin_cost_stars;
  const daysEnabled = config.spin_cost_days_enabled && config.spin_cost_days;
  const bothMethodsAvailable = !!(starsEnabled && daysEnabled);

  // Stars via Telegram invoice don't require ruble balance, so only check daily limit
  const dailyLimitReached = config.daily_limit > 0 && config.user_spins_today >= config.daily_limit;
  const noSubscription = !config.has_subscription;
  const needsSubscriptionPick =
    paymentType === 'subscription_days' &&
    config.eligible_subscriptions &&
    config.eligible_subscriptions.length > 1 &&
    !selectedSubscriptionId;

  const spinDisabled =
    isSpinning ||
    isPayingStars ||
    dailyLimitReached ||
    noSubscription ||
    pendingExternalPayment ||
    needsSubscriptionPick ||
    refreshingConfig ||
    Boolean(error) ||
    config.prizes.length === 0 ||
    (paymentType === 'telegram_stars' ? !starsEnabled : !config.can_spin || !config.can_pay_days);

  const remainingSpins = Math.max(0, config.daily_limit - config.user_spins_today);
  const jackpots = jackpotIds(config.prizes);
  const mainPrizes = config.prizes.filter((prize) => jackpots.has(prize.id));
  const prizeGroups = config.prizes
    .filter((prize) => prize.prize_type !== 'nothing')
    .reduce<{ type: string; items: WheelPrize[] }[]>((groups, prize) => {
      const group = groups.find((g) => g.type === prize.prize_type);
      if (group) group.items.push(prize);
      else groups.push({ type: prize.prize_type, items: [prize] });
      return groups;
    }, []);

  const panel = 'rounded-[22px] border border-line bg-surface p-4 sm:p-5';
  const panelTitle = 'text-sm font-semibold text-dark-300';

  return (
    <div className="animate-fade-in space-y-4 pb-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-dark-50 sm:text-3xl">
        {t('wheel.title')}
      </h1>

      <div className="xsg-wheel-layout grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-8">
        {/* Колесо */}
        <div className="mx-auto w-full max-w-[380px] px-1 sm:max-w-[480px] lg:sticky lg:top-6 lg:max-w-[560px] lg:px-0">
          <FortuneWheel
            prizes={displayedPrizes ?? config.prizes}
            isSpinning={isSpinning}
            targetRotation={targetRotation}
            onSpinComplete={handleSpinComplete}
          />
        </div>

        {/* Управление и призы */}
        <div className="xsg-wheel-controls space-y-4">
          <div className={cn(panel, 'xsg-wheel-control-panel')}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-dark-200">Доступно вращений</h2>
              <strong className="text-lg font-bold tabular-nums text-dark-50">
                {config.daily_limit > 0
                  ? `${remainingSpins} из ${config.daily_limit}`
                  : 'Без дневного лимита'}
              </strong>
            </div>
            <div className="space-y-2.5">
              {/* Cost is visible before either payment path. */}
              <div className="space-y-2">
                {bothMethodsAvailable && (
                  <div className="grid grid-cols-2 gap-2" aria-label="Способ оплаты вращения">
                    <button
                      type="button"
                      aria-pressed={paymentType === 'telegram_stars'}
                      disabled={isSpinning || isPayingStars || pendingExternalPayment}
                      onClick={() => {
                        setPaymentType('telegram_stars');
                        setShowStarsConfirm(false);
                      }}
                      className={`min-h-11 rounded-xl border px-2 py-2 text-sm ${paymentType === 'telegram_stars' ? 'border-accent-400 bg-accent-500/10 text-accent-300' : 'border-dark-700 text-dark-300'}`}
                    >
                      {config.spin_cost_stars} ⭐
                    </button>
                    <button
                      type="button"
                      aria-pressed={paymentType === 'subscription_days'}
                      disabled={isSpinning || isPayingStars || pendingExternalPayment}
                      onClick={() => {
                        setPaymentType('subscription_days');
                        setShowStarsConfirm(false);
                      }}
                      className={`min-h-11 rounded-xl border px-2 py-2 text-sm ${paymentType === 'subscription_days' ? 'border-accent-400 bg-accent-500/10 text-accent-300' : 'border-dark-700 text-dark-300'}`}
                    >
                      {t('wheel.days', { count: config.spin_cost_days ?? 0 })}
                    </button>
                  </div>
                )}
                {!(starsEnabled || daysEnabled) ? (
                  <p className="text-sm text-dark-300">
                    Способы оплаты вращений временно недоступны.
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-dark-300">
                    Стоимость вращения:{' '}
                    <span className="font-medium text-dark-100">
                      {paymentType === 'subscription_days'
                        ? spinCost(paymentType, config.spin_cost_days ?? 0)
                        : spinCost(paymentType, config.spin_cost_stars ?? 0)}
                    </span>
                  </p>
                )}
              </div>

              {/* Subscription selector for days payment in multi-tariff */}
              {paymentType === 'subscription_days' &&
                config.eligible_subscriptions &&
                config.eligible_subscriptions.length > 1 && (
                  <div className="rounded-xl border border-dark-700/30 bg-dark-800/30 p-3">
                    <p className="mb-2 text-center text-xs text-dark-400">
                      {t('wheel.selectSubscription', 'Выберите подписку')}
                    </p>
                    <div className="space-y-1.5">
                      {config.eligible_subscriptions.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSubscriptionId(sub.id)}
                          disabled={isSpinning || isPayingStars || pendingExternalPayment}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                            selectedSubscriptionId === sub.id
                              ? 'bg-accent-500/15 text-accent-400'
                              : 'text-dark-400 hover:text-dark-200'
                          }`}
                        >
                          <span className="min-w-0 truncate font-medium">
                            {sub.tariff_name || t('subscription.defaultName', 'Подписка')}
                          </span>
                          <span className="shrink-0 text-xs opacity-60">
                            {sub.days_left} {t('common.units.days', 'дней')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Stars confirmation panel */}
              {showStarsConfirm && !isSpinning && !isPayingStars ? (
                <div className="space-y-3 rounded-xl border border-accent-500/30 bg-accent-500/5 p-4">
                  <p className="text-center text-sm text-dark-300">
                    {t('wheel.confirmStarsPayment')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowStarsConfirm(false)}
                      className="rounded-lg border border-dark-700 bg-dark-800 px-4 py-2.5 text-sm font-medium text-dark-300 transition-colors hover:bg-dark-700"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleDirectStarsPay}
                      className="rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-600"
                    >
                      {t('wheel.payStars', { count: config.spin_cost_stars ?? 0 })}
                    </button>
                  </div>
                </div>
              ) : dailyLimitReached && !isSpinning && !isPayingStars && !pendingExternalPayment ? (
                <p role="status" className="py-2 text-center text-sm font-medium text-dark-300">
                  Сегодня вращения закончились
                </p>
              ) : (
                /* Single Spin Button */
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  aria-label={
                    isSpinning
                      ? 'Идёт вращение'
                      : isPayingStars
                        ? 'Ожидаем оплату и результат'
                        : pendingExternalPayment
                          ? 'Ожидаем результат оплаты'
                          : dailyLimitReached
                            ? 'Сегодня вращения закончились'
                            : t('wheel.spin')
                  }
                  aria-busy={isSpinning || isPayingStars}
                  className="shadow-none disabled:opacity-50"
                  onClick={handleUnifiedSpin}
                  disabled={spinDisabled}
                  loading={isSpinning || isPayingStars}
                >
                  {pendingExternalPayment
                    ? 'Ожидаем результат оплаты'
                    : dailyLimitReached
                      ? 'Сегодня вращения закончились'
                      : t('wheel.spin')}
                </Button>
              )}

              {(isSpinning || isPayingStars) && (
                <p role="status" className="text-center text-sm text-dark-300">
                  {isPayingStars
                    ? 'Ожидаем оплату и результат…'
                    : targetRotation === null
                      ? 'Получаем результат…'
                      : 'Колесо вращается…'}
                </p>
              )}
              {!isSpinning &&
                !isPayingStars &&
                (noSubscription ||
                  dailyLimitReached ||
                  needsSubscriptionPick ||
                  (paymentType === 'subscription_days' &&
                    (!config.can_pay_days || !config.can_spin)) ||
                  config.prizes.length === 0) && (
                  <div className="text-sm leading-relaxed text-dark-300">
                    <p>
                      {noSubscription
                        ? t('wheel.errors.noSubscription')
                        : dailyLimitReached
                          ? 'Лимит обновляется ежедневно.'
                          : config.prizes.length === 0
                            ? 'Пока нет доступных призов.'
                            : needsSubscriptionPick
                              ? 'Выберите подписку для списания дней.'
                              : config.can_spin_reason === 'insufficient_balance'
                                ? t('wheel.errors.insufficientBalance')
                                : 'Недостаточно доступных дней подписки для вращения.'}
                    </p>
                    <button
                      type="button"
                      disabled={refreshingConfig}
                      onClick={() => void refreshConfig()}
                      className="min-h-11 text-xs font-medium text-accent-300 disabled:opacity-50"
                    >
                      Проверить доступность
                    </button>
                  </div>
                )}

              {error && (
                <p role="alert" className="text-sm text-dark-300">
                  Не удалось обновить доступность.{' '}
                  <button
                    type="button"
                    onClick={() => void refreshConfig()}
                    className="min-h-11 text-accent-300"
                  >
                    Повторить
                  </button>
                </p>
              )}
              {/* Inline Result Card */}
              {spinResult && !isSpinning && (
                <div
                  className={`animate-fade-in rounded-linear border p-4 ${
                    spinResult.success
                      ? 'border-accent-500/30 bg-accent-500/10'
                      : 'border-error-500/30 bg-error-500/10'
                  }`}
                >
                  <div role="status" className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-linear bg-dark-700/50 text-2xl">
                      {spinResult.success
                        ? spinResult.prize_type
                          ? spinResult.emoji || '🎉'
                          : '◷'
                        : '😔'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-semibold text-dark-100 [overflow-wrap:anywhere]">
                        {spinResult.success && !spinResult.prize_type
                          ? 'Результат пока не подтверждён'
                          : spinResult.success && spinResult.prize_display_name
                            ? rewardTitle({
                                display_name: spinResult.prize_display_name,
                                prize_type: spinResult.prize_type ?? '',
                              })
                            : spinResult.success
                              ? spinResult.prize_type === 'nothing'
                                ? t('wheel.noLuck')
                                : t('wheel.congratulations')
                              : t('wheel.oops')}
                      </div>
                      {!(
                        spinResult.promocode && spinResult.message?.includes(spinResult.promocode)
                      ) && <div className="text-sm text-dark-400">{spinResult.message}</div>}
                    </div>
                    <button
                      onClick={closeResultModal}
                      disabled={pendingExternalPayment}
                      aria-label="Закрыть результат"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-dark-400 disabled:opacity-30 transition-colors hover:bg-white/5 hover:text-dark-200"
                    >
                      <CloseIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {pendingExternalPayment && (
                    <button
                      type="button"
                      disabled={checkingExternalResult}
                      onClick={() => void checkExternalResult()}
                      className="mt-2 min-h-11 text-sm font-medium text-accent-300 disabled:opacity-50"
                    >
                      {checkingExternalResult
                        ? 'Проверяем результат…'
                        : 'Обновить результат оплаты'}
                    </button>
                  )}

                  {/* Promocode if won — тап копирует код */}
                  {spinResult.promocode && (
                    <button
                      type="button"
                      onClick={() => {
                        const code = spinResult.promocode;
                        if (!code) return;
                        copyToClipboard(code)
                          .then(() => {
                            setPromoCopied(true);
                            window.setTimeout(() => setPromoCopied(false), 2000);
                          })
                          .catch(() => {});
                      }}
                      className="mt-3 w-full rounded-linear border border-accent-500/30 bg-accent-500/10 p-3 text-center transition-colors active:bg-accent-500/20"
                    >
                      <p className="mb-1 text-xs text-accent-400">{t('wheel.yourPromoCode')}</p>
                      <p className="font-mono text-lg font-bold tracking-wider text-white">
                        {spinResult.promocode}
                      </p>
                      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-300">
                        {promoCopied ? (
                          <>
                            <PiCheck className="h-3.5 w-3.5" />
                            {t('wheel.promoCopied')}
                          </>
                        ) : (
                          <>
                            <PiCopy className="h-3.5 w-3.5" />
                            {t('wheel.tapToCopy')}
                          </>
                        )}
                      </p>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {mainPrizes.length > 0 && (
            <div className={cn(panel, 'xsg-wheel-jackpots')}>
              <div className={cn(panelTitle, 'mb-3')}>{t('wheel.mainPrizes')}</div>
              <div
                className="grid gap-2.5"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(mainPrizes.length, 3)}, minmax(0, 1fr))`,
                }}
              >
                {mainPrizes.slice(0, 3).map((prize) => {
                  const label = prizeLabel(prize);
                  return (
                    <div
                      key={prize.id}
                      className="rounded-2xl border border-accent-500/25 bg-accent-950 px-2 py-4 text-center"
                    >
                      <div className="text-[28px] font-bold leading-none tracking-tight text-accent-200 sm:text-[30px]">
                        {label.main}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-dark-300">
                        {label.unit ? label.unit.toLowerCase() : prize.display_name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <RecentWinsStrip />

          <div className={cn(panel, 'xsg-wheel-rewards space-y-4')}>
            <div className={panelTitle}>{t('wheel.allPrizes')}</div>
            {prizeGroups.map((group) => {
              const color = group.type === 'subscription_days'
                ? 'var(--status-success)'
                : group.type === 'balance_bonus'
                  ? 'var(--accent-text)'
                  : prizeTypeColor(group.type);
              return (
                <div key={group.type}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <b className="text-sm text-dark-100">
                      {t(`wheel.groups.${group.type}`, group.type)}
                    </b>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((prize) => (
                      <span
                        key={prize.id}
                        className="max-w-full break-words rounded-lg px-3 py-2 text-[13px] font-medium [overflow-wrap:anywhere]"
                        style={{
                          color,
                          backgroundColor: 'var(--bg-elevated)',
                        }}
                      >
                        {rewardTitle(prize)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="text-xs leading-relaxed text-dark-300">
              {config.prizes.some((prize) => prize.prize_type === 'nothing') &&
                'Вращение может закончиться без выигрыша. '}
              Размеры секторов не обозначают вероятность выигрыша.
            </p>
          </div>

        </div>
      </div>
      <WheelHistory />
    </div>
  );
}
