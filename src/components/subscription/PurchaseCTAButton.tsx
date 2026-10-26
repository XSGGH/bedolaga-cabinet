import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '@/components/icons';
import type { Subscription } from '../../types';
import { needsTariff, tariffSelectionPath } from '../../utils/legacySubscription';

interface PurchaseCTAButtonProps {
  subscription: Subscription | null;
  /** In multi-tariff mode, link to /subscriptions/:id/renew instead of /subscription/purchase */
  isMultiTariff?: boolean;
}

export default function PurchaseCTAButton({
  subscription,
  isMultiTariff = false,
}: PurchaseCTAButtonProps) {
  const { t } = useTranslation();

  const isExpired =
    !subscription ||
    (!subscription.is_active && !subscription.is_trial && !subscription.is_limited);
  const isTrial = subscription?.is_trial;
  const isDaily = subscription?.is_daily;
  // Старая подписка (куплена в классике, тарифа нет): продлить нельзя — ведём на витрину тарифов.
  const requiresTariff = needsTariff(subscription);

  // Daily tariffs renew automatically — no manual renewal button needed in multi-tariff
  if (isMultiTariff && isDaily && !isExpired) return null;

  const buttonText = requiresTariff
    ? t('subscription.cta.moveToTariff')
    : isExpired
      ? t('subscription.getSubscription')
      : isTrial
        ? t('subscription.trialUpgrade.title')
        : t('subscription.extend');

  const hintText = isExpired
    ? t('subscription.cta.expiredHint')
    : requiresTariff
      ? t('subscription.cta.moveToTariffHint')
      : isTrial
        ? t('subscription.cta.trialHint')
        : isMultiTariff
          ? t('subscription.cta.renewHint', 'Продление подписки')
          : t('subscription.cta.activeHint');

  // Legacy (no tariff) → tariff catalog pinned to this subscription
  // Trial → purchase page (buy a real tariff, trial can't be renewed)
  // Multi-tariff active → per-subscription renew page
  // Otherwise → purchase page
  const linkTo =
    requiresTariff && subscription?.id
      ? tariffSelectionPath(subscription.id)
      : isTrial
        ? '/subscription/purchase'
        : isMultiTariff && subscription?.id
          ? `/subscriptions/${subscription.id}/renew`
          : '/subscription/purchase';

  return (
    <Link
      to={linkTo}
      className="group flex items-center gap-3.5 rounded-[20px] bg-accent-500 px-[22px] py-5 text-on-accent transition-colors hover:bg-accent-400"
    >
      <div className="min-w-0 flex-1">
        <div className="text-base font-extrabold tracking-tight">{buttonText}</div>
        <div className="mt-0.5 text-[12.5px] font-semibold opacity-75">{hintText}</div>
      </div>
      <ChevronRightIcon className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
