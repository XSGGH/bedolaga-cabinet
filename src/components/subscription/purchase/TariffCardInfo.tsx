import { useTranslation } from 'react-i18next';
import { CheckIcon, DevicesIcon } from '@/components/icons';
import type { Tariff } from '../../../types';
import { buildTrafficModel, isMeteredServer, tariffLocations } from './tariffCardModel';

import { tariffCopy } from './tariffPresentation';

function ServerList({ names }: { names: string[] }) {
  const list = (items: string[]) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-dark-300">
      {items.map((name) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  );
  return (
    <div className="mt-2">
      {list(names.slice(0, 6))}
      {names.length > 6 && (
        <details className="mt-1 text-xs text-accent-300">
          <summary className="min-h-11 cursor-pointer py-3">Все локации ({names.length})</summary>
          {list(names.slice(6))}
        </details>
      )}
    </div>
  );
}

/** Поля тарифа, из которых строится содержимое карточки (превью в админке — тоже). */
export type TariffCardSource = Pick<
  Tariff,
  | 'name'
  | 'description'
  | 'traffic_limit_gb'
  | 'traffic_limit_label'
  | 'is_unlimited_traffic'
  | 'device_limit'
  | 'traffic_reset_mode'
  | 'servers'
>;

interface TariffCardInfoProps {
  tariff: TariffCardSource;
  isCurrent: boolean;
  /** Есть ли 📡-локации у какого-либо тарифа в списке: нужно для строки «Недоступно». */
  hasMeteredElsewhere: boolean;
}

/**
 * Верх карточки тарифа: название, суть, строки трафика, устройства и
 * преимущества. Общий для витрины и для предпросмотра в админке — чтобы
 * оператор видел ровно то, что увидит клиент.
 */
export function TariffCardInfo({ tariff, isCurrent, hasMeteredElsewhere }: TariffCardInfoProps) {
  const { t } = useTranslation();
  const { tagline, features } = tariffCopy(tariff);
  const traffic = buildTrafficModel(tariff as Tariff);
  const showNoMetered =
    hasMeteredElsewhere && !tariffLocations(tariff as Tariff).some(isMeteredServer);
  const resetMonthly = tariff.traffic_reset_mode === 'MONTH';
  const resetLabel =
    tariff.traffic_reset_mode && tariff.traffic_reset_mode !== 'NO_RESET'
      ? t(`subscription.trafficReset.${tariff.traffic_reset_mode}`)
      : null;
  const regularScope =
    traffic.unlimitedScope === 'regular' || !traffic.unlimitedServers.some(isMeteredServer);
  return (
    <>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-xl font-bold tracking-tight text-dark-50 [overflow-wrap:anywhere]">
            {tariff.name}
          </h2>
          {isCurrent && (
            <span className="shrink-0 pt-1 text-xs font-semibold text-success-400">
              {t('subscription.currentTariff')}
            </span>
          )}
        </div>
        {tagline && <p className="mt-1.5 text-sm leading-relaxed text-dark-300">{tagline}</p>}
      </div>
      <div className="space-y-3 text-sm">
        {traffic.unlimitedScope && (
          <div>
            <p className="font-semibold text-dark-100">
              <span className="text-success-400">∞</span>{' '}
              {t('subscription.tariffCard.unlimited', 'Безлимит')}{' '}
              <span className="font-normal text-dark-300">
                {regularScope
                  ? t('subscription.tariffCard.onRegularServers', 'на обычных серверах')
                  : t('subscription.checkout.availableServers', 'на доступных серверах')}
              </span>
            </p>
            {traffic.unlimitedServers.length > 0 && <ServerList names={traffic.unlimitedServers} />}
          </div>
        )}
        {traffic.hasLimit && (
          <div>
            <p className="font-semibold text-accent-300">
              {tariff.traffic_limit_label}
              {resetMonthly && ' в месяц'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-dark-300">
              {traffic.limitedOnlyMetered
                ? 'На специальных серверах обхода мобильных ограничений'
                : 'На доступных серверах'}
            </p>
            {traffic.limitedServers.length > 0 && !traffic.limitedOnlyMetered && (
              <ServerList names={traffic.limitedServers} />
            )}
            {!resetMonthly && resetLabel && (
              <p className="mt-1 text-xs text-dark-300">{resetLabel}</p>
            )}
          </div>
        )}
        {showNoMetered && (
          <p className="text-xs leading-relaxed text-dark-300">
            Специальные серверы для обхода мобильных ограничений не входят в тариф.
          </p>
        )}
        <p className="flex items-center gap-2 font-medium text-dark-100">
          <DevicesIcon className="h-4 w-4 shrink-0 text-accent-300" />
          {tariff.device_limit === 0
            ? 'Устройства без ограничений'
            : t('subscription.devices', { count: tariff.device_limit })}
        </p>
      </div>
      {features.length > 0 && (
        <ul className="space-y-2 border-t border-[var(--xsg-line)] pt-3 text-xs leading-relaxed text-dark-300">
          {features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-300" />
              <span className={feature.warn ? 'text-warning-400' : ''}>{feature.text}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
