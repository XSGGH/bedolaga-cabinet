import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PiArrowsLeftRight } from 'react-icons/pi';
import type { Subscription } from '../../types';
import { needsTariff } from '../../utils/legacySubscription';

interface ChangeTariffButtonProps {
  subscription: Subscription | null;
  isMultiTariff?: boolean;
  /** Компактная кнопка внутри карточки. */
  inline?: boolean;
}

/**
 * «Сменить тариф»: ведёт на витрину тарифов. Показывается только у активной
 * подписки с тарифом: у пробной, истёкшей и старой без тарифа есть своя главная кнопка.
 */
export default function ChangeTariffButton({
  subscription,
  isMultiTariff = false,
  inline = false,
}: ChangeTariffButtonProps) {
  const { t } = useTranslation();
  if (!subscription || !subscription.is_active || subscription.is_trial) return null;
  if (needsTariff(subscription)) return null;
  if (isMultiTariff && subscription.is_daily) return null;

  const to =
    isMultiTariff && subscription.id
      ? `/subscription/purchase?subscriptionId=${subscription.id}`
      : '/subscription/purchase';

  return (
    <Link
      to={to}
      className={`flex items-center justify-center gap-2 border border-accent-500/40 bg-accent-500/10 font-bold text-accent-200 transition-colors hover:border-accent-400/70 hover:bg-accent-500/20 ${
        inline ? 'h-12 rounded-[14px] px-3 text-[14px]' : 'min-h-14 rounded-[20px] px-5 text-[15px]'
      }`}
    >
      <PiArrowsLeftRight className="h-[18px] w-[18px]" />
      {t('subscription.cta.changeTariff')}
    </Link>
  );
}
