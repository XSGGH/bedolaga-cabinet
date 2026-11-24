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
    'block min-w-0 h-full rounded-2xl border border-[var(--xsg-line)] bg-dark-800 px-3.5 py-3 transition-colors hover:border-[var(--xsg-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

  return (
    <>
      <Link to="/balance" className={tile} data-onboarding="balance">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-dark-300">{t('dashboard.stats.balance')}</span>
          {chevron}
        </div>
        <div className="mt-2 text-[22px] font-bold leading-none tracking-tight tabular-nums text-dark-50 [overflow-wrap:anywhere]">
          {formatAmount(balanceRubles)}
          <span className="ml-1.5 text-accent-400">{currencySymbol}</span>
        </div>
      </Link>
      <Link to="/referral" className={tile}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-dark-300">
            {t('dashboard.stats.referrals')}
          </span>
          {chevron}
        </div>
        {refLoading ? (
          <Skeleton className="mt-2.5 h-6 w-20 rounded" />
        ) : (
          <div className="mt-2 min-w-0 space-y-1.5">
            <span className="block break-words text-[22px] font-bold leading-none tabular-nums text-dark-50 [overflow-wrap:anywhere]">
              {referralCount}
            </span>
            <span className="block text-xs tabular-nums text-dark-300 [overflow-wrap:anywhere]">
              {t('dashboard.ui.referralEarnings', 'Доход')}: {formatAmount(earningsRubles)}{' '}
              {currencySymbol}
            </span>
          </div>
        )}
      </Link>
    </>
  );
}
