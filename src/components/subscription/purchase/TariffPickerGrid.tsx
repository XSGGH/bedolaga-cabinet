import { useTranslation } from 'react-i18next';
import { BestValueBadge, bestValueFrame } from '../BestValueBadge';
import { useNavigate } from 'react-router';
import { useTheme } from '../../../hooks/useTheme';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { dailyPriceQuote } from './dailyPrice';
import { getGlassColors } from '../../../utils/glassTheme';
import type { Tariff, Subscription, PurchaseOptions } from '../../../types';
import { tariffAction, type TariffActionKind } from './tariffAction';
import { anyTariffHasMetered } from './tariffCardModel';
import { TariffCardInfo } from './TariffCardInfo';

/** Подпись кнопки для действий, которые ведут в один и тот же сценарий выбора. */
const TARIFF_ACTION_LABEL: Record<Exclude<TariffActionKind, 'current-daily' | 'switch'>, string> = {
  extend: 'subscription.extend',
  moveToTariff: 'subscription.cta.moveToTariff',
  purchase: 'subscription.purchase',
};

// ──────────────────────────────────────────────────────────────────
// TariffPickerGrid
//
// The tariff selection surface inside SubscriptionPurchase. Renders:
//   - an optional promo-group banner when any tariff carries a
//     promo_group_name
//   - the "all tariffs purchased" empty state (multi-tariff mode)
//   - the grid itself (1 col mobile, 2 cols sm+) with promo prices,
//     per-tariff CTAs differentiated by user state (extend / switch /
//     purchase / legacy renewal)
//
// Owns nothing — pure presentation that calls back into the parent
// for selection (`onSelectTariff`) and switch (`onSwitchTariff`).
// ──────────────────────────────────────────────────────────────────

export interface TariffPickerGridProps {
  tariffs: Tariff[];
  subscription: Subscription | null;
  purchaseOptions: PurchaseOptions | undefined;
  isTariffsMode: boolean;
  isMultiTariff: boolean;
  onSelectTariff: (tariff: Tariff) => void;
  onSwitchTariff: (tariffId: number) => void;
}

export function TariffPickerGrid({
  tariffs,
  subscription,
  purchaseOptions,
  isTariffsMode,
  isMultiTariff,
  onSelectTariff,
  onSwitchTariff,
}: TariffPickerGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();

  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100)}\u00A0${currencySymbol}`;

  const hasMeteredElsewhere = anyTariffHasMetered(tariffs);

  return (
    <>
      {/* Promo group discount banner */}
      {tariffs.some((tariff) => tariff.promo_group_name) && (
        <p className="mb-4 text-sm text-success-400">
          <span className="font-bold">
            {t('subscription.promoGroup.yourGroup', {
              name: tariffs.find((tariff) => tariff.promo_group_name)?.promo_group_name,
            })}
          </span>
          <span className="text-success-400/80">
            {' · '}
            {t('subscription.promoGroup.personalDiscountsApplied')}
          </span>
        </p>
      )}

      {/* Tariff Grid */}
      {isMultiTariff &&
        purchaseOptions &&
        'all_tariffs_purchased' in purchaseOptions &&
        purchaseOptions.all_tariffs_purchased && (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ background: g.cardBg, borderColor: g.cardBorder }}
          >
            <div className="mb-2 text-3xl">✅</div>
            <h3 className="mb-1 text-lg font-semibold" style={{ color: g.text }}>
              {t('subscription.allTariffsPurchased', 'Все тарифы подключены')}
            </h3>
            <p className="mb-4 text-sm" style={{ color: g.textSecondary }}>
              {t(
                'subscription.allTariffsPurchasedDesc',
                'Вы уже приобрели все доступные тарифы. Продлить подписку можно на странице тарифа.',
              )}
            </p>
            <button
              onClick={() => navigate('/subscriptions')}
              className="rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-600"
            >
              {t('subscription.backToList', 'Мои подписки')}
            </button>
          </div>
        )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
        {[...tariffs]
          .filter((tariff) => {
            // In multi-tariff mode: hide already purchased tariffs
            if (isMultiTariff && tariff.is_purchased) return false;
            if (subscription?.is_trial && tariff.name.toLowerCase().includes('trial')) {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            const aIsCurrent = a.is_current || a.id === subscription?.tariff_id;
            const bIsCurrent = b.is_current || b.id === subscription?.tariff_id;
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return 0;
          })
          .map((tariff) => {
            const isCurrentTariff = tariff.is_current || tariff.id === subscription?.tariff_id;
            // Ветвление кнопки живёт в tariffAction(): витрин стало две
            // (обычная и простая), и расхождение в этом условии списало бы с
            // части людей не ту сумму.
            const action = tariffAction({
              tariff,
              subscription,
              purchaseOptions,
              isTariffsMode,
              isMultiTariff,
            });

            const isPrimary = isCurrentTariff || !subscription;

            return (
              <div
                key={tariff.id}
                className={`bento-card-hover flex flex-col gap-5 p-5 text-left transition-all sm:p-7 ${
                  isCurrentTariff
                    ? 'border-accent-500'
                    : tariff.is_highlighted
                      ? // Текущий тариф важнее подсказки: две «активные» рамки
                        // сразу не дают понять, что именно сейчас куплено.
                        bestValueFrame(false)
                      : ''
                }`}
              >
                {tariff.is_highlighted && !isCurrentTariff && <BestValueBadge />}

                <TariffCardInfo
                  tariff={tariff}
                  isCurrent={isCurrentTariff}
                  hasMeteredElsewhere={hasMeteredElsewhere}
                />

                {/* Цена и действие */}
                <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="text-sm text-dark-400">
                    {(() => {
                      const promoDaily = dailyPriceQuote(tariff, applyPromoDiscount);
                      if (promoDaily) {
                        return (
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-dark-50">
                              {formatPrice(promoDaily.price)}
                            </span>
                            {promoDaily.original && promoDaily.original > promoDaily.price && (
                              <span className="text-xs text-dark-500 line-through">
                                {formatPrice(promoDaily.original)}
                              </span>
                            )}
                            <span>{t('subscription.tariff.perDay')}</span>
                            {promoDaily.percent != null && promoDaily.percent > 0 && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs ${
                                  promoDaily.isPromoGroup
                                    ? 'bg-success-500/20 text-success-400'
                                    : 'bg-warning-500/20 text-warning-400'
                                }`}
                              >
                                -{promoDaily.percent}%
                              </span>
                            )}
                          </span>
                        );
                      }
                      if (tariff.periods.length > 0) {
                        const firstPeriod = tariff.periods[0];
                        const promoPeriod = applyPromoDiscount(
                          firstPeriod?.price_kopeks || 0,
                          firstPeriod?.original_price_kopeks,
                        );
                        return (
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span>{t('subscription.from')}</span>
                            <span className="text-2xl font-extrabold text-dark-50">
                              {formatPrice(promoPeriod.price)}
                            </span>
                            {promoPeriod.original && promoPeriod.original > promoPeriod.price && (
                              <span className="text-xs text-dark-500 line-through">
                                {formatPrice(promoPeriod.original)}
                              </span>
                            )}
                            {promoPeriod.percent != null && promoPeriod.percent > 0 && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs ${
                                  promoPeriod.isPromoGroup
                                    ? 'bg-success-500/20 text-success-400'
                                    : 'bg-warning-500/20 text-warning-400'
                                }`}
                              >
                                -{promoPeriod.percent}%
                              </span>
                            )}
                          </span>
                        );
                      }
                      return (
                        <span className="font-medium text-accent-400">
                          {t('subscription.tariff.flexiblePayment')}
                        </span>
                      );
                    })()}
                  </div>

                  {action === 'current-daily' ? (
                    <div className="py-2 text-center text-sm text-dark-500">
                      {t('subscription.currentTariff')}
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        action === 'switch' ? onSwitchTariff(tariff.id) : onSelectTariff(tariff)
                      }
                      className={`h-12 w-full rounded-[14px] px-7 text-[15px] font-bold transition-colors sm:w-auto ${
                        isPrimary
                          ? 'bg-accent-500 text-on-accent hover:bg-accent-600'
                          : 'border border-accent-500/40 text-accent-300 hover:bg-accent-500/10'
                      }`}
                    >
                      {action === 'switch'
                        ? t('subscription.switchTariff.switch')
                        : t(TARIFF_ACTION_LABEL[action])}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
