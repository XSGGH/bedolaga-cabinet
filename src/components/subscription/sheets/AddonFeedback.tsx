import { useTranslation } from 'react-i18next';
import { CloseIcon, RefreshIcon } from '@/components/icons';

/** Compact non-financial state shared by the three existing add-on forms. */
export default function AddonFeedback({
  title,
  message,
  onClose,
  onRetry,
  busy = false,
}: {
  title: string;
  message: string;
  onClose?: () => void;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const button =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-dark-300 hover:bg-dark-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50';
  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-[var(--xsg-line)] bg-dark-900/30 p-3"
      role="status"
      aria-busy={busy}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-dark-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-dark-300">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          className={button}
          onClick={onRetry}
          disabled={busy}
          aria-label={t('subscription.actionsUi.retry', 'Проверить доступность ещё раз')}
          title={t('subscription.actionsUi.retry', 'Проверить доступность ещё раз')}
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
      )}
      {onClose && (
        <button
          type="button"
          className={button}
          onClick={onClose}
          aria-label={t('common.close', 'Закрыть')}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
