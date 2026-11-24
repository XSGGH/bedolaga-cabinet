import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { useTheme } from '../hooks/useTheme';
import { getGlassColors } from '../utils/glassTheme';
import { getMonthlyPriceKopeks } from '../utils/pricing';
import { pickBestValue } from '../utils/bestValue';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '../platform';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import { WebBackButton } from '../components/WebBackButton';
import { PeriodOption } from '../components/subscription/purchase/PeriodOption';
import { PageSkeleton, Skeleton } from '../components/ui/skeleton';
import { needsTariff, tariffSelectionPath } from '../utils/legacySubscription';

export default function RenewSubscription() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const subId = subscriptionId ? Number(subscriptionId) : undefined;

  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { formatAmount, currencySymbol } = useCurrency();
  const { impact } = useHaptic();

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingPrice, setCheckingPrice] = useState(false);
  const mounted = useRef(true);
  const checking = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load subscription detail for tariff name
  const { data: subscriptionResponse, isLoading: isSubscriptionLoading } = useQuery({
    queryKey: ['subscription', subId],
    queryFn: () => subscriptionApi.getSubscription(subId),
    enabled: !!subId,
    staleTime: 30_000,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  // Load renewal options
  const { data: options, isLoading } = useQuery({
    queryKey: ['renewal-options', subId],
    queryFn: () => subscriptionApi.getRenewalOptions(subId),
    enabled: !!subId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Отмеченный оператором вариант выбираем сразу, как только приехал список.
  // Без отметки выбор остаётся за человеком: сами выгоду не выдумываем.
  useEffect(() => {
    if (selectedPeriod !== null) return;
    const best = pickBestValue(options);
    if (best) setSelectedPeriod(best.period_days);
  }, [options, selectedPeriod]);

  // Load balance
  const { data: purchaseOptions } = useQuery({
    queryKey: ['purchase-options', subId],
    queryFn: () => subscriptionApi.getPurchaseOptions(subId),
    staleTime: 0,
  });
  const balanceKopeks = purchaseOptions?.balance_kopeks ?? 0;

  const renewMutation = useMutation({
    mutationFn: (periodDays: number) => subscriptionApi.renewSubscription(periodDays, subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-options', subId] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate(`/subscriptions/${subId}`, { replace: true });
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? null)
          : null;

      if (detail && typeof detail === 'object' && 'code' in (detail as Record<string, unknown>)) {
        const typed = detail as { code: string; missing_amount?: number };
        if (typed.code === 'insufficient_funds' && typed.missing_amount) {
          setError(`insufficient:${typed.missing_amount}`);
          return;
        }
      }
      setError(typeof detail === 'string' ? detail : t('common.error'));
    },
  });

  const handleRenew = async (periodDays: number) => {
    if (checking.current || renewMutation.isPending) return;
    impact('medium');
    setError(null);
    checking.current = true;
    setCheckingPrice(true);
    const displayed = options?.find((option) => option.period_days === periodDays);
    try {
      const latest = await queryClient.fetchQuery({
        queryKey: ['renewal-options', subId],
        queryFn: () => subscriptionApi.getRenewalOptions(subId),
        staleTime: 0,
      });
      if (!mounted.current) return;
      const fresh = latest.find((option) => option.period_days === periodDays);
      if (!fresh) {
        setError('Этот период больше недоступен. Выберите другой.');
        return;
      }
      if (
        !displayed ||
        fresh.price_kopeks !== displayed.price_kopeks ||
        fresh.original_price_kopeks !== displayed.original_price_kopeks
      ) {
        setError('Стоимость обновилась. Проверьте итог и подтвердите продление ещё раз.');
        return;
      }
      renewMutation.mutate(periodDays);
    } catch {
      if (mounted.current) setError('Не удалось обновить стоимость. Попробуйте ещё раз.');
    } finally {
      checking.current = false;
      if (mounted.current) setCheckingPrice(false);
    }
  };

  if (!subId) {
    return <Navigate to="/subscriptions" replace />;
  }

  // Старая подписка (куплена в классике, тарифа нет): продлевать нечего, бот
  // отдаёт пустой список — уводим на витрину тарифов с этой подпиской.
  if (needsTariff(subscription)) {
    return <Navigate to={tariffSelectionPath(subId)} replace />;
  }

  if (isLoading || isSubscriptionLoading) {
    return (
      <PageSkeleton leading={1} titleWidth="w-56" className="space-y-5">
        <Skeleton variant="card" className="h-16" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton variant="card" count={4} className="h-20" />
        </div>
      </PageSkeleton>
    );
  }

  const insufficientMatch = error?.match(/^insufficient:(\d+)$/);
  const missingAmount = insufficientMatch ? Number(insufficientMatch[1]) : null;
  const chosen = options?.find((option) => option.period_days === selectedPeriod);
  const money = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100)}\u00A0${currencySymbol}`;
  const monthly = options?.find((option) => option.period_days === 30);

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center gap-3">
        <WebBackButton to={`/subscriptions/${subId}`} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: g.text }}>
            {t('subscription.extend', 'Продлить подписку')}
          </h1>
          {subscription?.tariff_name && (
            <p className="mt-1 text-sm" style={{ color: g.textSecondary }}>
              {subscription.tariff_name}
            </p>
          )}
        </div>
      </div>

      {/* Balance */}
      <div
        className="flex items-center justify-between rounded-2xl p-4"
        style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
      >
        <span className="text-sm" style={{ color: g.textSecondary }}>
          {t('common.balance', 'Баланс')}
        </span>
        <span className="text-base font-semibold" style={{ color: g.text }}>
          {formatAmount(balanceKopeks / 100)}
          {'\u00A0'}
          {currencySymbol}
        </span>
      </div>

      {/* Period options */}
      {!options || options.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
        >
          <p style={{ color: g.textSecondary }}>
            {t('subscription.noRenewalOptions', 'Нет доступных вариантов продления')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((option) => {
            const perMonth = getMonthlyPriceKopeks(option.price_kopeks, option.period_days);
            const saving =
              monthly && option.period_days > 30 && option.period_days % 30 === 0
                ? (monthly.price_kopeks * option.period_days) / 30 - option.price_kopeks
                : 0;
            return (
              <div key={option.period_days}>
                <PeriodOption
                  label={`${option.period_days} ${({ one: 'день', few: 'дня', many: 'дней', other: 'дня' } as Record<string, string>)[new Intl.PluralRules('ru').select(option.period_days)]}`}
                  price={money(option.price_kopeks)}
                  original={
                    option.original_price_kopeks &&
                    option.original_price_kopeks > option.price_kopeks
                      ? money(option.original_price_kopeks)
                      : null
                  }
                  monthly={perMonth !== null ? money(perMonth) : null}
                  saving={saving > 0 ? money(saving) : null}
                  discount={option.discount_percent}
                  highlighted={option.is_highlighted}
                  selected={selectedPeriod === option.period_days}
                  disabled={renewMutation.isPending || checkingPrice}
                  onClick={() => {
                    impact('light');
                    setSelectedPeriod(option.period_days);
                    setError(null);
                  }}
                />
                {balanceKopeks < option.price_kopeks && (
                  <p className="px-4 pt-1 text-xs text-dark-300">
                    Не хватает {money(option.price_kopeks - balanceKopeks)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Insufficient balance prompt */}
      {missingAmount && <InsufficientBalancePrompt missingAmountKopeks={missingAmount} compact />}

      {/* Error */}
      {error && !missingAmount && (
        <div className="rounded-xl bg-error-400/10 p-3 text-center text-sm text-error-400">
          {error}
        </div>
      )}

      {chosen && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--xsg-line)] p-4">
          <span className="text-sm text-dark-200">{t('subscription.total')}</span>
          <strong className="break-words text-xl text-dark-50 [overflow-wrap:anywhere]">
            {money(chosen.price_kopeks)}
          </strong>
        </div>
      )}
      {/* Renew button */}
      {selectedPeriod && (
        <button
          onClick={() => void handleRenew(selectedPeriod)}
          disabled={renewMutation.isPending || checkingPrice}
          className="w-full rounded-2xl bg-accent-500 py-3.5 text-base font-semibold text-on-accent transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {renewMutation.isPending || checkingPrice
            ? t('common.processing', 'Обработка...')
            : t('subscription.extend', 'Продлить подписку')}
        </button>
      )}
    </div>
  );
}
