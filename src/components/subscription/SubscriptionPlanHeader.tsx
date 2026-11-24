import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Subscription } from '@/types';
import { planTitle } from '@/utils/legacySubscription';
import { uiLocale } from '@/utils/uiLocale';

/** Shared summary chrome; each page supplies its own actions below it. */
export default function SubscriptionPlanHeader({
  subscription,
  remaining,
}: {
  subscription: Subscription;
  remaining?: ReactNode;
}) {
  const { t } = useTranslation();
  const warning =
    subscription.is_limited || (subscription.is_active && subscription.days_left <= 3);
  const label = subscription.is_limited
    ? t('subscription.trafficLimited')
    : subscription.status === 'disabled'
      ? t('subscription.pause.suspended')
      : subscription.is_active
        ? warning
          ? t('dashboard.ui.endingSoon', 'Скоро закончится')
          : t('dashboard.ui.active', 'Активна')
        : subscription.is_expired
          ? t('subscription.expired')
          : t('dashboard.ui.statusUnknown', 'Статус уточняется');
  const tone = warning
    ? 'bg-warning-500/10 text-warning-300'
    : subscription.is_active
      ? 'bg-success-500/10 text-success-400'
      : subscription.is_expired || subscription.status === 'disabled'
        ? 'bg-error-500/10 text-error-400'
        : 'bg-elevated text-dark-300';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-dark-300">{t('dashboard.tariff')}</span>
        <span
          className={`inline-flex max-w-[65%] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${tone}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          {label}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold leading-tight tracking-tight text-dark-50 [overflow-wrap:anywhere] sm:text-2xl">
            {planTitle(subscription, t)}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-dark-300">
            {t('dashboard.validUntil', {
              date: new Date(subscription.end_date).toLocaleDateString(uiLocale()),
            })}
          </p>
        </div>
        <div className="text-right">
          {remaining ?? (
            <>
              <p className="text-xs text-dark-300">{t('dashboard.remaining')}</p>
              <p
                className={`mt-1 font-semibold tabular-nums ${warning ? 'text-warning-300' : 'text-dark-50'}`}
              >
                {subscription.days_left > 0 ? (
                  <>
                    <span className="text-[28px] leading-none">{subscription.days_left}</span>
                    <span className="ml-1 text-xs">{t('subscription.daysShort')}</span>
                  </>
                ) : (
                  <span className="text-sm">
                    {subscription.time_left_display ||
                      t('dashboard.ui.lessThanDay', 'Меньше суток')}
                  </span>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
