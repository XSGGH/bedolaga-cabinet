import { useTranslation } from 'react-i18next';
import { BestValueBadge, bestValueFrame } from '../BestValueBadge';

/** Shared period row for purchase and renewal; all monetary values come from their callers. */
export function PeriodOption({
  label,
  price,
  original,
  monthly,
  saving,
  selected,
  highlighted,
  discount,
  disabled,
  onClick,
}: {
  label: string;
  price: string;
  original?: string | null;
  monthly?: string | null;
  saving?: string | null;
  selected: boolean;
  highlighted?: boolean;
  discount?: number | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-20 w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50 ${highlighted ? `${bestValueFrame(selected)} ${selected ? 'bg-accent-500/10' : ''}` : selected ? 'border-accent-400 bg-accent-500/10' : 'border-[var(--xsg-line)] bg-dark-900/40 hover:border-accent-400/50'}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-accent-400' : 'border-dark-400'}`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent-400" />}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="break-words text-sm font-semibold text-dark-100">{label}</span>
          <span className="break-words text-base font-bold tabular-nums text-dark-50 [overflow-wrap:anywhere]">
            {price}
          </span>
        </span>
        {(monthly || original) && (
          <span className="flex flex-wrap justify-between gap-x-3 text-xs text-dark-300">
            <span>{monthly ? `${monthly}/${t('subscription.month', 'мес')}` : ''}</span>
            {original && <span className="line-through">{original}</span>}
          </span>
        )}
        {(saving || highlighted || (discount ?? 0) > 0) && (
          <span className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
            {highlighted && <BestValueBadge />}
            {saving ? (
              <span className="text-success-400">
                {t('subscription.checkout.saving', {
                  defaultValue: 'Экономия {{amount}}',
                  amount: saving,
                })}
              </span>
            ) : null}
            {(discount ?? 0) > 0 && <span className="text-success-400">-{discount}%</span>}
          </span>
        )}
      </span>
    </button>
  );
}
