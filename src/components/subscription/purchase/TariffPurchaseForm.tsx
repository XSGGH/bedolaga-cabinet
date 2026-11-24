import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../../api/subscription';
import { getErrorMessage, getInsufficientBalanceError } from '../../../utils/subscriptionHelpers';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import { usePlatform } from '../../../platform';
import { openPaymentUrl } from '../../../utils/openPaymentUrl';
import { getMonthlyPriceKopeks } from '../../../utils/pricing';
import { pickBestValue } from '../../../utils/bestValue';
import InsufficientBalancePrompt from '../../InsufficientBalancePrompt';
import type { Tariff } from '../../../types';
import { PeriodOption } from './PeriodOption';
import {
  periodSaving,
  renewalDate,
  tariffPriceIdentity,
  trafficReminder,
} from './tariffPresentation';
import { promoApi } from '@/api/promo';
import type { Subscription } from '@/types';

// ──────────────────────────────────────────────────────────────────
// TariffPurchaseForm
//
// The full per-tariff purchase form: period picker (or daily-tariff
// activate), custom-days toggle + slider, custom-traffic toggle +
// slider, summary, and the confirm CTA. Self-owns:
//   - the purchaseTariff mutation
//   - the auto-scroll-into-view ref + effect on mount
//   - selectedTariffPeriod / customDays / customTrafficGb /
//     useCustomDays / useCustomTraffic (form-internal state, reset
//     by re-mount when the parent passes a new `tariff` via key=)
//
// The parent (SubscriptionPurchase) supplies the chosen tariff,
// the current balance (for inline insufficient-balance prompts),
// the subscription id (for the renew-this-subscription flow), and
// onBack to clear its own selection state.
// ──────────────────────────────────────────────────────────────────

export interface TariffPurchaseFormProps {
  tariff: Tariff;
  subscriptionId: number | undefined;
  balanceKopeks: number | undefined;
  /** СБП-оформление (Platega recurrent) доступно — показать вторую CTA. */
  sbpPurchaseEnabled?: boolean;
  /** Оформление привязкой Lava доступно — показать вторую CTA. */
  lavaPurchaseEnabled?: boolean;
  /** Оформление привязкой Cashera доступно — показать вторую CTA. */
  casheraPurchaseEnabled?: boolean;
  onBack: () => void;
  currentSubscription?: Subscription | null;
}

export function TariffPurchaseForm({
  tariff,
  subscriptionId,
  balanceKopeks,
  sbpPurchaseEnabled = false,
  lavaPurchaseEnabled = false,
  casheraPurchaseEnabled = false,
  onBack,
  currentSubscription,
}: TariffPurchaseFormProps) {
  const { t } = useTranslation();
  const reminders = trafficReminder(tariff);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount, activeDiscount } = usePromoDiscount();
  // Та же котировка, что на карточке тарифа: серверная цена + промокод один раз.
  const dailyQuote = dailyPriceQuote(tariff, applyPromoDiscount);
  const { openLink, platform } = usePlatform();
  const ref = useRef<HTMLDivElement>(null);

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100)}\u00A0${currencySymbol}`;

  // Form-internal state — seeded from the tariff prop. Resets via
  // `key={tariff.id}` on the parent's render.
  // Отмеченный оператором период выбран сразу: рамка «Выгодно» и итог внизу
  // должны говорить об одном и том же периоде.
  const [periodDays, setPeriodDays] = useState<number | null>(
    (pickBestValue(tariff.periods) || tariff.periods[0])?.days ?? null,
  );
  const selectedTariffPeriod =
    tariff.periods.find((p) => p.days === periodDays) ||
    pickBestValue(tariff.periods) ||
    tariff.periods[0] ||
    null;
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [priceNotice, setPriceNotice] = useState('');
  const priceNoticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (priceNotice)
      priceNoticeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [priceNotice]);
  const confirming = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [customDays, setCustomDays] = useState<number>(30);
  const [customTrafficGb, setCustomTrafficGb] = useState<number>(50);
  const [useCustomDays, setUseCustomDays] = useState(false);
  const [useCustomTraffic, setUseCustomTraffic] = useState(false);
  const extendedUntil = renewalDate(
    currentSubscription,
    tariff.id,
    useCustomDays ? customDays : (selectedTariffPeriod?.days ?? 0),
  );

  const purchaseMutation = useMutation({
    mutationFn: () => {
      const isDailyTariff =
        tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0);
      const days = isDailyTariff
        ? 1
        : useCustomDays
          ? customDays
          : selectedTariffPeriod?.days || 30;
      const trafficGb =
        useCustomTraffic && tariff.custom_traffic_enabled ? customTrafficGb : undefined;
      // Forward the subscription_id when the user landed here via the
      // "Renew this subscription" flow (?subscriptionId=N). The backend
      // uses it to resolve the exact target row by ID, avoiding the
      // race with concurrent panel webhooks that would otherwise hit
      // the partial UNIQUE on uq_subscriptions_user_tariff_active.
      return subscriptionApi.purchaseTariff(
        tariff.id,
        days,
        trafficGb,
        subscriptionId ?? undefined,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      navigate('/subscriptions', { replace: true });
    },
  });

  // Refresh read-only quotes before charging; changed conditions require another explicit click.
  const confirmPurchase = async () => {
    if (confirming.current || purchaseMutation.isPending) return;
    confirming.current = true;
    setCheckingPrice(true);
    setPriceNotice('');
    try {
      const [options, discount] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['purchase-options', subscriptionId],
          queryFn: () => subscriptionApi.getPurchaseOptions(subscriptionId),
          staleTime: 0,
        }),
        queryClient.fetchQuery({
          queryKey: ['active-discount'],
          queryFn: promoApi.getActiveDiscount,
          staleTime: 0,
        }),
      ]);
      if (!mounted.current) return;
      const fresh =
        options.sales_mode === 'tariffs'
          ? options.tariffs.find((p) => p.id === tariff.id)
          : undefined;
      if (!fresh || fresh.is_available === false) {
        setPriceNotice('Этот тариф больше недоступен. Вернитесь к выбору тарифов.');
        return;
      }
      const percent = (value: typeof discount | undefined) =>
        value?.is_active ? (value.discount_percent ?? 0) : 0;
      if (
        tariffPriceIdentity(fresh) !== tariffPriceIdentity(tariff) ||
        percent(discount) !== percent(activeDiscount)
      ) {
        setPriceNotice(
          'Цена или условия обновились. Проверьте итог и подтвердите покупку ещё раз.',
        );
        return;
      }
      purchaseMutation.mutate();
    } catch {
      setPriceNotice('Не удалось обновить стоимость. Попробуйте ещё раз.');
    } finally {
      confirming.current = false;
      setCheckingPrice(false);
    }
  };

  // СБП-оформление: первое списание = подтверждение привязки в банке; период
  // на форме не участвует — списания идут по каденс-правилу тарифа.
  const sbpPurchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseWithSbpRecurring(tariff.id),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['sbp-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const sbpPurchaseButton = sbpPurchaseEnabled && (
    <>
      <button
        onClick={() => sbpPurchaseMutation.mutate()}
        disabled={sbpPurchaseMutation.isPending || purchaseMutation.isPending}
        className="mt-2 w-full rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/20 disabled:opacity-50"
      >
        {sbpPurchaseMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('common.loading')}
          </span>
        ) : (
          t('subscription.sbpRecurring.purchaseButton')
        )}
      </button>
      <div className="mt-1.5 text-center text-[11px] text-dark-500">
        {t('subscription.sbpRecurring.purchaseHint')}
      </div>
      {sbpPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-error-400">
          {getErrorMessage(sbpPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  const lavaPurchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseWithLavaRecurring(tariff.id),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['lava-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const lavaPurchaseButton = lavaPurchaseEnabled && (
    <>
      <button
        onClick={() => lavaPurchaseMutation.mutate()}
        disabled={lavaPurchaseMutation.isPending || purchaseMutation.isPending}
        className="mt-2 w-full rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/20 disabled:opacity-50"
      >
        {lavaPurchaseMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('common.loading')}
          </span>
        ) : (
          t('subscription.lavaRecurring.purchaseButton')
        )}
      </button>
      <div className="mt-1.5 text-center text-[11px] text-dark-500">
        {t('subscription.lavaRecurring.purchaseHint')}
      </div>
      {lavaPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-error-400">
          {getErrorMessage(lavaPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  const casheraPurchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseWithCasheraRecurring(tariff.id),
    onSuccess: (data) => {
      if (data.redirect_url) {
        openPaymentUrl(data.redirect_url, platform, openLink);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['cashera-recurring', data.subscription_id] });
      navigate('/subscriptions', { replace: true });
    },
  });

  const casheraPurchaseButton = casheraPurchaseEnabled && (
    <>
      <button
        onClick={() => casheraPurchaseMutation.mutate()}
        disabled={casheraPurchaseMutation.isPending || purchaseMutation.isPending}
        className="mt-2 w-full rounded-xl border border-accent-500/40 bg-accent-500/10 py-3 text-sm font-medium text-accent-400 transition-colors hover:bg-accent-500/20 disabled:opacity-50"
      >
        {casheraPurchaseMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('common.loading')}
          </span>
        ) : (
          t('subscription.casheraRecurring.purchaseButton')
        )}
      </button>
      <div className="mt-1.5 text-center text-[11px] text-dark-500">
        {t('subscription.casheraRecurring.purchaseHint')}
      </div>
      {casheraPurchaseMutation.isError && (
        <div className="mt-2 text-center text-sm text-error-400">
          {getErrorMessage(casheraPurchaseMutation.error)}
        </div>
      )}
    </>
  );

  // Smooth scroll the form into view when first mounted.
  useEffect(() => {
    if (ref.current) {
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div ref={ref} className="space-y-6">
      <div className="rounded-2xl border border-[var(--xsg-line)] bg-dark-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-lg font-bold text-dark-50 [overflow-wrap:anywhere]">
            {tariff.name}
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 text-xs font-medium text-accent-300"
          >
            К выбору тарифов
          </button>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-dark-300">
          {reminders.map((text) => (
            <li key={text}>{text}</li>
          ))}
          <li>
            {tariff.device_limit === 0
              ? 'Устройства без ограничений'
              : t('subscription.devices', { count: tariff.device_limit })}
            {tariff.extra_devices_count > 0 && (
              <span> · дополнительных: {tariff.extra_devices_count}</span>
            )}
          </li>
        </ul>
        {currentSubscription?.tariff_id === tariff.id && (
          <p className="mt-3 text-xs leading-relaxed text-dark-300">
            Продление текущего тарифа.{' '}
            {currentSubscription.end_date && (
              <>
                Текущий срок — до{' '}
                {new Intl.DateTimeFormat('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(currentSubscription.end_date))}
                .
              </>
            )}{' '}
            {currentSubscription.device_limit > tariff.device_limit &&
              'Проверьте лимит устройств перед оформлением.'}
          </p>
        )}
      </div>
      {priceNotice && (
        <p
          ref={priceNoticeRef}
          role="status"
          className="rounded-xl border border-accent-400/30 p-3 text-sm leading-relaxed text-dark-200"
        >
          {priceNotice}
        </p>
      )}

      <fieldset
        disabled={checkingPrice || purchaseMutation.isPending}
        className="min-w-0 space-y-4"
      >
        {/* Daily Tariff Purchase */}
        {tariff.is_daily || (tariff.daily_price_kopeks && tariff.daily_price_kopeks > 0) ? (
          <div className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-5">
            <div className="mb-4 text-center">
              <div className="mb-2 text-sm text-dark-400">
                {t('subscription.dailyPurchase.costPerDay')}
              </div>
              <div className="text-3xl font-bold text-accent-400">
                {formatPrice(dailyQuote?.price ?? 0)}
              </div>
              {dailyQuote?.original && dailyQuote.original > dailyQuote.price && (
                <div className="mt-1 flex items-center justify-center gap-2 text-sm">
                  <span className="text-dark-500 line-through">
                    {formatPrice(dailyQuote.original)}
                  </span>
                  {dailyQuote.percent != null && dailyQuote.percent > 0 && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        dailyQuote.isPromoGroup
                          ? 'bg-success-500/20 text-success-400'
                          : 'bg-warning-500/20 text-warning-400'
                      }`}
                    >
                      -{dailyQuote.percent}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm text-dark-400">
              <div className="flex items-start gap-2">
                <span className="text-accent-400">•</span>
                <span>{t('subscription.dailyPurchase.chargedDaily')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent-400">•</span>
                <span>{t('subscription.dailyPurchase.canPause')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-accent-400">•</span>
                <span>{t('subscription.dailyPurchase.pausedOnLowBalance')}</span>
              </div>
            </div>

            {(() => {
              const dailyPrice = dailyQuote?.price ?? 0;
              const hasEnoughBalance = balanceKopeks !== undefined && dailyPrice <= balanceKopeks;

              return (
                <div className="mt-6">
                  {balanceKopeks !== undefined && !hasEnoughBalance && (
                    <InsufficientBalancePrompt
                      missingAmountKopeks={dailyPrice - balanceKopeks}
                      compact
                      className="mb-4"
                    />
                  )}

                  <button
                    onClick={() => void confirmPurchase()}
                    disabled={
                      purchaseMutation.isPending || checkingPrice || tariff.is_available === false
                    }
                    className="btn-primary w-full py-3"
                  >
                    {purchaseMutation.isPending || checkingPrice ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t('common.loading')}
                      </span>
                    ) : (
                      t('subscription.dailyPurchase.activate', {
                        price: formatPrice(dailyPrice),
                      })
                    )}
                  </button>

                  {sbpPurchaseButton}
                  {lavaPurchaseButton}
                  {casheraPurchaseButton}

                  {purchaseMutation.isError &&
                    !getInsufficientBalanceError(purchaseMutation.error) && (
                      <div className="mt-3 text-center text-sm text-error-400">
                        {getErrorMessage(purchaseMutation.error)}
                      </div>
                    )}
                  {purchaseMutation.isError &&
                    getInsufficientBalanceError(purchaseMutation.error) && (
                      <div className="mt-3">
                        <InsufficientBalancePrompt
                          missingAmountKopeks={
                            getInsufficientBalanceError(purchaseMutation.error)?.missingAmount ||
                            dailyPrice - (balanceKopeks || 0)
                          }
                          compact
                        />
                      </div>
                    )}
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Period Selection for non-daily tariffs */}
            <div>
              <div className="mb-3 text-sm text-dark-400">{t('subscription.selectPeriod')}</div>

              {tariff.periods.length > 0 && !useCustomDays && (
                <div className="mb-4 space-y-2" aria-label={t('subscription.selectPeriod')}>
                  {tariff.periods.map((period) => {
                    const quote = applyPromoDiscount(
                      period.price_kopeks,
                      period.original_price_kopeks,
                    );
                    const monthly = getMonthlyPriceKopeks(quote.price, period.days);
                    const saving = periodSaving(period, tariff.periods, applyPromoDiscount);
                    return (
                      <PeriodOption
                        key={period.days}
                        label={period.label}
                        price={formatPrice(quote.price)}
                        original={
                          quote.original != null && quote.original > quote.price
                            ? formatPrice(quote.original)
                            : null
                        }
                        monthly={monthly !== null ? formatPrice(monthly) : null}
                        saving={saving !== null ? formatPrice(saving) : null}
                        discount={quote.percent}
                        highlighted={period.is_highlighted}
                        selected={selectedTariffPeriod?.days === period.days}
                        disabled={checkingPrice || purchaseMutation.isPending}
                        onClick={() => {
                          setPeriodDays(period.days);
                          setUseCustomDays(false);
                          setPriceNotice('');
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* No periods available fallback */}
              {tariff.periods.length === 0 &&
                !useCustomDays &&
                !(tariff.custom_days_enabled && (tariff.price_per_day_kopeks ?? 0) > 0) && (
                  <div className="rounded-xl border border-warning-500/30 bg-warning-500/10 p-4 text-center">
                    <div className="mb-2 text-sm font-medium text-warning-400">
                      {t('subscription.noPeriodsAvailable')}
                    </div>
                    <div className="text-xs text-dark-400">
                      {t('subscription.noPeriodsAvailableHint')}
                    </div>
                    <button onClick={onBack} className="btn-secondary mt-3 px-4 py-2 text-sm">
                      {t('subscription.chooseDifferentTariff')}
                    </button>
                  </div>
                )}

              {/* Custom days option */}
              {tariff.custom_days_enabled && (tariff.price_per_day_kopeks ?? 0) > 0 && (
                <div className="rounded-xl border border-dark-700/50 bg-dark-800/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-dark-200">
                      {t('subscription.customDays.title')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseCustomDays(!useCustomDays)}
                      role="switch"
                      aria-checked={useCustomDays}
                      aria-label={t('subscription.customDays.title')}
                      className={`relative h-6 w-10 rounded-full transition-colors ${
                        useCustomDays ? 'bg-accent-500' : 'bg-dark-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          useCustomDays ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {useCustomDays && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={tariff.min_days ?? 1}
                          max={tariff.max_days ?? 365}
                          value={customDays}
                          onChange={(e) => setCustomDays(parseInt(e.target.value, 10))}
                          className="min-w-0 flex-1 accent-accent-500"
                        />
                        <input
                          type="number"
                          value={customDays}
                          min={tariff.min_days ?? 1}
                          max={tariff.max_days ?? 365}
                          onChange={(e) =>
                            setCustomDays(
                              Math.max(
                                tariff.min_days ?? 1,
                                Math.min(
                                  tariff.max_days ?? 365,
                                  parseInt(e.target.value, 10) || (tariff.min_days ?? 1),
                                ),
                              ),
                            )
                          }
                          className="w-20 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-center text-dark-100"
                        />
                      </div>
                      {(() => {
                        const basePrice = customDays * (tariff.price_per_day_kopeks ?? 0);
                        const existingOriginal =
                          tariff.original_price_per_day_kopeks &&
                          tariff.original_price_per_day_kopeks > (tariff.price_per_day_kopeks ?? 0)
                            ? customDays * tariff.original_price_per_day_kopeks
                            : undefined;
                        const promoCustom = applyPromoDiscount(basePrice, existingOriginal);
                        return (
                          <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                            {/* «/день» — уже в переводе; второй «/» давал «₽//день». */}
                            <span className="text-dark-400">
                              {t('subscription.days', { count: customDays })} ×{' '}
                              <span className="whitespace-nowrap">
                                {formatPrice(tariff.price_per_day_kopeks ?? 0)}
                                {t('subscription.customDays.perDay')}
                              </span>
                            </span>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className="font-medium text-accent-400">
                                {formatPrice(promoCustom.price)}
                              </span>
                              {promoCustom.original && promoCustom.original > promoCustom.price && (
                                <>
                                  <span className="text-xs text-dark-500 line-through">
                                    {formatPrice(promoCustom.original)}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-xs ${
                                      promoCustom.isPromoGroup
                                        ? 'bg-success-500/20 text-success-400'
                                        : 'bg-warning-500/20 text-warning-400'
                                    }`}
                                  >
                                    -{promoCustom.percent}%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom traffic option */}
            {tariff.custom_traffic_enabled && (tariff.traffic_price_per_gb_kopeks ?? 0) > 0 && (
              <div>
                <div className="mb-3 text-sm text-dark-400">
                  {t('subscription.customTraffic.label')}
                </div>
                <div className="rounded-xl border border-dark-700/50 bg-dark-800/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-dark-200">
                      {t('subscription.customTraffic.selectVolume')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseCustomTraffic(!useCustomTraffic)}
                      role="switch"
                      aria-checked={useCustomTraffic}
                      aria-label={t('subscription.customTraffic.selectVolume')}
                      className={`relative h-6 w-10 rounded-full transition-colors ${
                        useCustomTraffic ? 'bg-accent-500' : 'bg-dark-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          useCustomTraffic ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {!useCustomTraffic && (
                    <div className="text-sm text-dark-400">
                      {t('subscription.customTraffic.default', {
                        label: tariff.traffic_limit_label,
                      })}
                    </div>
                  )}
                  {useCustomTraffic && (
                    <div className="space-y-3">
                      {/* Ползунок сжимается, поле с «ГБ» — нет: на 360 «ГБ» упиралось
                        в рамку карточки. */}
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={tariff.min_traffic_gb ?? 1}
                          max={tariff.max_traffic_gb ?? 1000}
                          value={customTrafficGb}
                          onChange={(e) => setCustomTrafficGb(parseInt(e.target.value, 10))}
                          className="min-w-0 flex-1 accent-accent-500"
                        />
                        <div className="flex shrink-0 items-center gap-2">
                          <input
                            type="number"
                            value={customTrafficGb}
                            min={tariff.min_traffic_gb ?? 1}
                            max={tariff.max_traffic_gb ?? 1000}
                            onChange={(e) =>
                              setCustomTrafficGb(
                                Math.max(
                                  tariff.min_traffic_gb ?? 1,
                                  Math.min(
                                    tariff.max_traffic_gb ?? 1000,
                                    parseInt(e.target.value, 10) || (tariff.min_traffic_gb ?? 1),
                                  ),
                                ),
                              )
                            }
                            className="w-20 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-center text-dark-100"
                          />
                          <span className="text-dark-400">{t('common.units.gb')}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                        <span className="text-dark-400">
                          {customTrafficGb} {t('common.units.gb')} ×{' '}
                          <span className="whitespace-nowrap">
                            {formatPrice(tariff.traffic_price_per_gb_kopeks ?? 0)}/
                            {t('common.units.gb')}
                          </span>
                        </span>
                        <span className="whitespace-nowrap font-medium text-accent-400">
                          +
                          {formatPrice(customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary & Purchase */}
            {(selectedTariffPeriod || useCustomDays) && (
              <div className="rounded-xl bg-dark-800/50 p-5">
                {(() => {
                  const basePeriodPrice = useCustomDays
                    ? customDays * (tariff.price_per_day_kopeks ?? 0)
                    : selectedTariffPeriod?.price_kopeks || 0;
                  const existingPeriodOriginal = useCustomDays
                    ? tariff.original_price_per_day_kopeks &&
                      tariff.original_price_per_day_kopeks > (tariff.price_per_day_kopeks ?? 0)
                      ? customDays * tariff.original_price_per_day_kopeks
                      : undefined
                    : selectedTariffPeriod?.original_price_kopeks &&
                        selectedTariffPeriod.original_price_kopeks >
                          selectedTariffPeriod.price_kopeks
                      ? selectedTariffPeriod.original_price_kopeks
                      : undefined;
                  const promoPeriod = applyPromoDiscount(basePeriodPrice, existingPeriodOriginal);

                  const trafficPrice =
                    useCustomTraffic && tariff.custom_traffic_enabled
                      ? customTrafficGb * (tariff.traffic_price_per_gb_kopeks ?? 0)
                      : 0;

                  const totalPrice = promoPeriod.price + trafficPrice;
                  const originalTotal = promoPeriod.original
                    ? promoPeriod.original + trafficPrice
                    : null;

                  return (
                    <>
                      <div className="mb-4 space-y-2">
                        {useCustomDays ? (
                          <div className="flex flex-wrap justify-between gap-x-3 text-sm text-dark-300">
                            <span>
                              {t('subscription.stepPeriod')}:{' '}
                              {t('subscription.days', { count: customDays })}
                            </span>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span>{formatPrice(promoPeriod.price)}</span>
                              {promoPeriod.original && promoPeriod.original > promoPeriod.price && (
                                <span className="text-xs text-dark-500 line-through">
                                  {formatPrice(promoPeriod.original)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          selectedTariffPeriod && (
                            <>
                              {(selectedTariffPeriod.extra_devices_count ?? 0) > 0 &&
                              !promoPeriod.original &&
                              selectedTariffPeriod.base_tariff_price_kopeks ? (
                                <>
                                  <div className="flex flex-wrap justify-between gap-x-3 text-sm text-dark-300">
                                    <span>
                                      {t('subscription.baseTariff')}: {selectedTariffPeriod.label}
                                    </span>
                                    <span>
                                      {formatPrice(selectedTariffPeriod.base_tariff_price_kopeks)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap justify-between gap-x-3 text-sm text-dark-300">
                                    <span>
                                      {t('subscription.extraDevices')} (
                                      {selectedTariffPeriod.extra_devices_count})
                                    </span>
                                    <span>
                                      +
                                      {formatPrice(
                                        selectedTariffPeriod.extra_devices_cost_kopeks ?? 0,
                                      )}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-wrap justify-between gap-x-3 text-sm text-dark-300">
                                  <span>
                                    {t('subscription.summary.period', {
                                      label: selectedTariffPeriod.label,
                                    })}
                                  </span>
                                  <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span>{formatPrice(promoPeriod.price)}</span>
                                    {promoPeriod.original &&
                                      promoPeriod.original > promoPeriod.price && (
                                        <span className="text-xs text-dark-500 line-through">
                                          {formatPrice(promoPeriod.original)}
                                        </span>
                                      )}
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        )}
                        {useCustomTraffic && tariff.custom_traffic_enabled && (
                          <div className="flex flex-wrap justify-between gap-x-3 text-sm text-dark-300">
                            <span>
                              {t('subscription.summary.traffic', { gb: customTrafficGb })}
                            </span>
                            <span>+{formatPrice(trafficPrice)}</span>
                          </div>
                        )}
                      </div>

                      {promoPeriod.percent && (
                        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 p-2">
                          <span className="text-sm font-medium text-warning-400">
                            {t('promo.discountApplied')} -{promoPeriod.percent}%
                          </span>
                        </div>
                      )}

                      {extendedUntil && (
                        <p className="mb-3 text-xs leading-relaxed text-dark-300">
                          После продления — до{' '}
                          {new Intl.DateTimeFormat('ru-RU', {
                            timeZone: 'Europe/Moscow',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }).format(extendedUntil)}
                          .
                        </p>
                      )}
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-dark-700/50 pt-2">
                        <span className="font-medium text-dark-100">{t('subscription.total')}</span>
                        <div className="text-right">
                          <span className="break-words text-2xl font-bold text-accent-400 [overflow-wrap:anywhere]">
                            {formatPrice(totalPrice)}
                          </span>
                          {originalTotal && (
                            <div className="text-sm text-dark-500 line-through">
                              {formatPrice(originalTotal)}
                            </div>
                          )}
                        </div>
                      </div>

                      {balanceKopeks !== undefined && totalPrice > balanceKopeks && (
                        <p className="mb-3 text-xs leading-relaxed text-dark-300">
                          Для покупки не хватает {formatPrice(totalPrice - balanceKopeks)} на
                          балансе.
                        </p>
                      )}

                      <button
                        onClick={() => void confirmPurchase()}
                        disabled={
                          purchaseMutation.isPending ||
                          checkingPrice ||
                          tariff.is_available === false
                        }
                        className="btn-primary w-full py-3"
                      >
                        {purchaseMutation.isPending || checkingPrice ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            {t('common.loading')}
                          </span>
                        ) : currentSubscription?.tariff_id === tariff.id &&
                          !currentSubscription.is_trial ? (
                          t('subscription.extend')
                        ) : (
                          t('subscription.purchase')
                        )}
                      </button>

                      {sbpPurchaseButton}
                      {lavaPurchaseButton}
                      {casheraPurchaseButton}
                    </>
                  );
                })()}

                {purchaseMutation.isError &&
                  !getInsufficientBalanceError(purchaseMutation.error) && (
                    <div className="mt-3 text-center text-sm text-error-400">
                      {getErrorMessage(purchaseMutation.error)}
                    </div>
                  )}
                {purchaseMutation.isError &&
                  getInsufficientBalanceError(purchaseMutation.error) && (
                    <div className="mt-3">
                      <InsufficientBalancePrompt
                        missingAmountKopeks={
                          getInsufficientBalanceError(purchaseMutation.error)?.missingAmount || 0
                        }
                        compact
                      />
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
}
