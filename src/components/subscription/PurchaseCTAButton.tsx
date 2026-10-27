import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, RefreshIcon, SparklesIcon } from '@/components/icons';
import type { Subscription } from '../../types';
import { needsTariff, tariffSelectionPath } from '../../utils/legacySubscription';

interface PurchaseCTAButtonProps {
  subscription: Subscription | null;
  /** In multi-tariff mode, link to /subscriptions/:id/renew instead of /subscription/purchase */
  isMultiTariff?: boolean;
  /** Компактная кнопка внутри карточки (без подсказки). */
  inline?: boolean;
}

export default function PurchaseCTAButton({
  subscription,
  isMultiTariff = false,
  inline = false,
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
  // Обычное продление в одиночном режиме открывает выбор периода текущего тарифа
  // сразу (renew=1), а не список всех тарифов; список доступен кнопкой «Сменить тариф».
  const linkTo =
    requiresTariff && subscription?.id
      ? tariffSelectionPath(subscription.id)
      : isTrial
        ? '/subscription/purchase'
        : isMultiTariff && subscription?.id
          ? `/subscriptions/${subscription.id}/renew`
          : isExpired
            ? '/subscription/purchase'
            : '/subscription/purchase?renew=1';
  const Icon = isExpired || isTrial || requiresTariff ? SparklesIcon : RefreshIcon;

  const glow = 'shadow-[0_8px_24px_rgba(var(--color-accent-500),0.35)]';
  const fill = `bg-gradient-to-r from-accent-500 to-fuchsia-500 text-white hover:brightness-110 ${glow}`;

  if (inline) {
    return (
      <Link
        to={linkTo}
        className={`flex h-12 items-center justify-center gap-2 rounded-[14px] px-3 text-[14px] font-bold transition-[filter] ${fill}`}
      >
        <Icon className="h-[18px] w-[18px]" />
        {buttonText}
      </Link>
    );
  }

  return (
    <Link
      to={linkTo}
      className={`group flex min-h-16 items-center gap-3.5 rounded-[20px] px-5 py-4 transition-[filter] ${fill}`}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-extrabold tracking-tight">{buttonText}</div>
        <div className="mt-0.5 text-[12.5px] font-semibold opacity-80">{hintText}</div>
      </div>
      <ChevronRightIcon className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
