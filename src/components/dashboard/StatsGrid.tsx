import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCurrency } from '../../hooks/useCurrency';
import { Skeleton } from '../ui/skeleton';
import { ChevronRightIcon } from '@/components/icons';

interface StatsGridProps {
  balanceRubles: number;
  referralCount: number;
  earningsRubles: number;
  refLoading: boolean;
}

export default function StatsGrid({
  balanceRubles,
  referralCount,
  earningsRubles,
  refLoading,
}: StatsGridProps) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();

  const chevron = <ChevronRightIcon className="h-4 w-4 shrink-0 text-dark-500" />;
  const tile =
    'block h-full rounded-2xl border border-[var(--xsg-line)] bg-dark-800 p-4 transition-colors hover:border-[var(--xsg-line-strong)]';

  return (
    <>
      <Link to="/balance" className={tile} data-onboarding="balance">
        <div className="flex items-center justify-between gap-2">
          <span className="xsg-eyebrow">{t('dashboard.stats.balance')}</span>
          {chevron}
        </div>
        <div className="mt-2.5 text-[22px] font-bold leading-none tracking-tight tabular-nums text-dark-50 [overflow-wrap:anywhere]">
          {formatAmount(balanceRubles)}
          <span className="ml-1.5 text-accent-400">{currencySymbol}</span>
        </div>
      </Link>
      <Link to="/referral" className={tile}>
        <div className="flex items-center justify-between gap-2">
          <span className="xsg-eyebrow">{t('dashboard.stats.referrals')}</span>
          {chevron}
        </div>
        {refLoading ? (
          <Skeleton className="mt-2.5 h-6 w-20 rounded" />
        ) : (
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="text-[22px] font-bold leading-none tabular-nums text-dark-50">
              {referralCount}
            </span>
            <span className="text-xs tabular-nums text-dark-400">
              +{formatAmount(earningsRubles)}&nbsp;{currencySymbol}
            </span>
          </div>
        )}
      </Link>
    </>
  );
}
