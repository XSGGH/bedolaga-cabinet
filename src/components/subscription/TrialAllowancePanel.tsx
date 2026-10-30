import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

interface TrialAllowancePanelProps {
  /** Лимит трафика на белые списки из конфига триала; 0 — без лимита. */
  trafficLimitGb: number;
  compact?: boolean;
}

/**
 * Что входит в пробный период: лимит на белые списки и безлимит на всё остальное.
 * Одна панель с двумя крупными цифрами; общая для плашки триала на главной и
 * блока «Пробный период» на странице подписки.
 */
export function TrialAllowancePanel({ trafficLimitGb, compact = false }: TrialAllowancePanelProps) {
  const { t } = useTranslation();
  const limited = trafficLimitGb > 0;
  const cells = [
    limited && {
      key: 'limit',
      value: String(trafficLimitGb),
      unit: t('common.units.gb'),
      title: t('dashboard.trialOffer.whitelistTitle'),
      hint: t('dashboard.trialOffer.whitelistHint'),
    },
    {
      key: 'unlimited',
      value: '∞',
      unit: '',
      title: t('dashboard.trialOffer.unlimitedTitle'),
      hint: t('dashboard.trialOffer.unlimitedHint'),
    },
  ].filter(Boolean) as { key: string; value: string; unit: string; title: string; hint: string }[];

  return (
    <div
      className={`grid rounded-[20px] border border-accent-400/25 px-2 ${compact ? 'py-3.5' : 'py-[18px]'}`}
      style={{
        gridTemplateColumns: cells.length > 1 ? '1fr 1px 1fr' : '1fr',
        background:
          'linear-gradient(135deg, rgba(var(--color-accent-500), 0.18), rgba(236,72,153,0.08))',
      }}
    >
      {cells.map((cell, i) => (
        <Fragment key={cell.key}>
          {i > 0 && (
            <div
              aria-hidden="true"
              style={{
                background:
                  'linear-gradient(180deg, transparent, rgba(var(--color-accent-400), 0.4), transparent)',
              }}
            />
          )}
          <div className="px-1.5 text-center">
            <div
              className={`font-extrabold leading-none tracking-tight ${compact ? 'text-[36px]' : 'text-[44px]'}`}
              style={{
                background: 'linear-gradient(180deg, #fff, rgb(var(--color-accent-400)))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {cell.value}
              {cell.unit && (
                <span
                  className="ml-1 text-base font-extrabold"
                  style={{ WebkitTextFillColor: 'rgb(var(--color-accent-400))' }}
                >
                  {cell.unit}
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dark-50">
              {cell.title}
            </div>
            <div className="mt-0.5 text-xs text-dark-400">{cell.hint}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
