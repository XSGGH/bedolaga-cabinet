import { useTranslation } from 'react-i18next';
import { DevicesIcon } from '@/components/icons';
import type { Tariff } from '../../../types';
import {
  buildTrafficModel,
  isMeteredServer,
  parseTariffDescription,
  tariffLocations,
} from './tariffCardModel';

function ServerList({ names }: { names: string[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-dark-200">
      {names.map((name) => (
        <span key={name}>{name}</span>
      ))}
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
  const { tagline, features } = parseTariffDescription(tariff.description);
  const traffic = buildTrafficModel(tariff as Tariff);
  const showNoMetered =
    hasMeteredElsewhere && !tariffLocations(tariff as Tariff).some(isMeteredServer);
  const resetMonthly = tariff.traffic_reset_mode === 'MONTH';
  const resetLabel =
    tariff.traffic_reset_mode && tariff.traffic_reset_mode !== 'NO_RESET'
      ? t(`subscription.trafficReset.${tariff.traffic_reset_mode}`)
      : null;
  const isCurrentTariff = isCurrent;

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-2xl font-extrabold tracking-tight text-dark-50">{tariff.name}</div>
          {isCurrentTariff && (
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-success-400">
              {t('subscription.currentTariff')}
            </span>
          )}
        </div>
        {tagline && <div className="mt-1.5 text-sm text-dark-300">{tagline}</div>}
      </div>

      {/* Трафик и устройства */}
      <div className="border-t border-dark-700/60">
        {traffic.unlimitedScope && (
          <div className="border-b border-dark-700/60 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xl font-extrabold text-success-400">
                ∞ {t('subscription.tariffCard.unlimited', 'Безлимит')}
              </span>
              <span className="text-[13px] text-dark-300">
                {traffic.unlimitedScope === 'all'
                  ? t('subscription.tariffCard.onAllServers', 'на всех серверах')
                  : t('subscription.tariffCard.onRegularServers', 'на обычных серверах')}
              </span>
            </div>
            {traffic.unlimitedServers.length > 0 && <ServerList names={traffic.unlimitedServers} />}
          </div>
        )}

        {traffic.hasLimit && (
          <div className="border-b border-dark-700/60 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xl font-extrabold text-accent-300">
                {tariff.traffic_limit_label}
                {resetMonthly && ` ${t('subscription.tariffCard.perMonth', 'в месяц')}`}
              </span>
              <span className="text-[13px] text-dark-300">
                {traffic.limitedOnlyMetered
                  ? t('subscription.tariffCard.onlyMetered', 'только на 📡')
                  : t('subscription.tariffCard.onAllServers', 'на всех серверах')}
              </span>
            </div>
            {traffic.limitedServers.length > 0 && <ServerList names={traffic.limitedServers} />}
            {resetLabel && <div className="mt-1.5 text-[13px] text-dark-400">{resetLabel}</div>}
          </div>
        )}

        {showNoMetered && (
          <div className="border-b border-dark-700/60 py-4">
            <div className="text-xl font-bold text-dark-500">
              {'📡 '}
              {t('subscription.tariffCard.unavailable', 'Недоступно')}
            </div>
            <div className="mt-1.5 text-[13px] text-dark-400">
              {t('subscription.tariffCard.noMetered', 'Обход белых списков в этот тариф не входит')}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 border-b border-dark-700/60 py-4">
          <DevicesIcon className="h-5 w-5 shrink-0 text-accent-300" />
          <span className="text-xl font-extrabold text-dark-50">
            {tariff.device_limit === 0
              ? `∞ ${t('subscription.tariffCard.devicesUnlimited', 'устройств')}`
              : t('subscription.devices', { count: tariff.device_limit })}
          </span>
          <span className="text-[13px] text-dark-300">
            {t('subscription.tariffCard.inSubscription', 'в подписке')}
          </span>
        </div>
      </div>

      {features.length > 0 && (
        <ul className="flex flex-col gap-2.5 text-sm leading-snug">
          {features.map((feature) => (
            <li key={feature.text} className={feature.warn ? 'text-warning-400' : 'text-dark-200'}>
              {feature.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
