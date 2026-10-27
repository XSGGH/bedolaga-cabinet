import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useHaptic } from '../../platform';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { MonitorIcon } from '@/components/icons';

/**
 * До скольких устройств лимит показываем точками.
 *
 * Точка занимает 13px вместе с зазором, поэтому десять точек съедали 124px из
 * ~272px плитки — тексту оставалось 80px, и «Подключить устройство» ломалось
 * на четыре строки. Полоска-индикатор занимает фиксированные 64px при любом
 * лимите, так что выше этого порога показываем её.
 */
const DOTS_MAX = 5;

interface ConnectDeviceTileProps {
  subscription: {
    id: number;
    device_limit: number;
    subscription_url?: string | null;
  };
  connectedDevices: number;
  /** Процент израсходованного трафика — от него зависит акцентный цвет плитки. */
  usedPercent?: number;
}

/**
 * Плитка «Подключить устройство».
 *
 * Живёт и в карточке активной подписки, и на главной: пользователь,
 * которому подписку выдал бонус рекламной кампании, попадает на главную
 * с готовым доступом — и без этой плитки не понимает, что делать дальше.
 */
export default function ConnectDeviceTile({
  subscription,
  connectedDevices,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const isAtDeviceLimit =
    subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;

  if (!subscription.subscription_url) return null;

  return (
    <button
      type="button"
      disabled={isAtDeviceLimit}
      onClick={() => {
        if (isAtDeviceLimit) {
          haptic.notification('error');
          return;
        }
        navigate(`/connection?sub=${subscription.id}`);
      }}
      className={`mb-3 flex w-full items-center gap-4 rounded-2xl border border-accent-400/60 bg-gradient-to-r from-accent-500/30 to-fuchsia-500/15 p-4 text-left shadow-[0_8px_26px_rgba(var(--color-accent-500),0.25)] transition-[filter,border-color] duration-200 hover:border-accent-300/80 hover:brightness-110 ${isAtDeviceLimit ? 'cursor-not-allowed opacity-50' : ''}`}
      data-onboarding="connect-devices"
      style={{ fontFamily: 'inherit' }}
    >
      {/* Monitor icon */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-500/30 text-white">
        <MonitorIcon className="h-[18px] w-[18px]" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold tracking-tight text-dark-50">
          {t('dashboard.connectDevice')}
        </div>
        <div className="mt-0.5 text-xs text-dark-400">
          {subscription.device_limit === 0
            ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
            : t('dashboard.devicesOfMax', {
                used: connectedDevices,
                max: subscription.device_limit,
              })}
        </div>
        {isAtDeviceLimit && (
          <div
            className="mt-1 text-[10px] font-medium"
            style={{ color: 'rgb(var(--color-warning-400))' }}
          >
            {t('dashboard.deviceLimitReached')}
          </div>
        )}
      </div>

      {/* Device indicator */}
      {subscription.device_limit === 0 ? (
        <div className="flex flex-shrink-0 items-center text-lg text-dark-400" aria-hidden="true">
          ∞
        </div>
      ) : subscription.device_limit <= DOTS_MAX ? (
        <div className="flex flex-shrink-0 gap-1.5" aria-hidden="true">
          {Array.from({ length: subscription.device_limit }, (_, i) => (
            <div
              key={i}
              className="h-[7px] w-[7px] rounded-full transition-all duration-300"
              style={{
                background: i < connectedDevices ? 'rgb(var(--color-accent-400))' : g.textGhost,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex w-16 flex-shrink-0 items-center" aria-hidden="true">
          <div
            className="h-[6px] w-full overflow-hidden rounded-full"
            style={{ background: g.textGhost }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((connectedDevices / subscription.device_limit) * 100)}%`,
                background: 'rgb(var(--color-accent-400))',
                minWidth: connectedDevices > 0 ? '4px' : '0px',
              }}
            />
          </div>
        </div>
      )}
      <span className="flex-shrink-0 text-lg text-dark-400" aria-hidden="true">
        &rsaquo;
      </span>
    </button>
  );
}
