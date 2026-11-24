import { useTranslation } from 'react-i18next';
import { RefreshIcon } from '@/components/icons';

/** Presentation only: the owning page keeps its existing timer and rate limits. */
export default function TrafficRefreshButton({
  cooldown,
  pending,
  onRefresh,
}: {
  cooldown: number;
  pending: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const waiting = cooldown > 0 && !pending;
  const label = waiting
    ? t('dashboard.ui.refreshWait', {
        defaultValue: 'Обновление доступно через {{count}} сек.',
        count: Math.ceil(cooldown),
      })
    : t('subscriptionCommand.refreshTraffic');
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={pending || cooldown > 0}
      aria-label={t('subscriptionCommand.refreshTraffic')}
      title={label}
      aria-busy={pending}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-elevated text-dark-300 transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:cursor-default"
    >
      <RefreshIcon
        aria-hidden="true"
        className={`h-[18px] w-[18px] ${pending ? 'animate-spin motion-reduce:animate-none' : ''}`}
      />
    </button>
  );
}
