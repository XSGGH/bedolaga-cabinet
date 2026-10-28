import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  displayServerName,
  isMeteredServer,
  parseTariffDescription,
} from '../subscription/purchase/tariffCardModel';

interface GiftTariffDetailsProps {
  description: string | null | undefined;
}

/**
 * Описание выбранного тарифа на странице подарка: суть → преимущества
 * списком → доступные локации чипами. Вместо одного сплошного абзаца.
 */
export default function GiftTariffDetails({ description }: GiftTariffDetailsProps) {
  const { t } = useTranslation();
  const { tagline, features, locations } = parseTariffDescription(description, {
    keepUnlimited: true,
  });
  if (!tagline && features.length === 0 && locations.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-dark-700/60 bg-dark-900/40">
      {tagline && (
        <div className="px-4 pb-3 pt-4 text-[15px] font-semibold leading-snug text-dark-50">
          {tagline}
        </div>
      )}

      {features.length > 0 && (
        <ul className={cn('flex flex-col gap-2.5 px-4 pb-4', !tagline && 'pt-4')}>
          {features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-2.5 text-sm leading-snug">
              <span
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full',
                  feature.warn
                    ? 'bg-warning-500/15 text-warning-400'
                    : 'bg-accent-500/15 text-accent-300',
                )}
              >
                <CheckIcon className="h-3 w-3" />
              </span>
              <span className={feature.warn ? 'text-warning-400' : 'text-dark-200'}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {locations.length > 0 && (
        <div className="border-t border-dark-700/60 bg-dark-800/30 px-4 py-3.5">
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-dark-400">
            {t('gift.availableLocations')}
          </div>
          <div className="flex flex-wrap gap-2">
            {locations.map((raw) => {
              const name = displayServerName(raw);
              const metered = isMeteredServer(name);
              return (
                <span
                  key={raw}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[13px] font-medium',
                    metered
                      ? 'border-accent-500/40 bg-accent-500/15 text-accent-200'
                      : 'border-dark-700/70 bg-dark-800/60 text-dark-200',
                  )}
                >
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
