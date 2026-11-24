import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MonitorIcon } from '@/components/icons';

interface ConnectDeviceTileProps {
  subscription: { id: number; device_limit: number; subscription_url?: string | null };
  connectedDevices: number;
  usedPercent?: number;
  onManage?: () => void;
  connectionPath?: string;
  canIncreaseLimit?: boolean;
  onIncreaseLimit?: () => void;
}

export default function ConnectDeviceTile({
  subscription,
  connectedDevices,
  onManage,
  connectionPath,
  canIncreaseLimit = false,
  onIncreaseLimit,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const full = subscription.device_limit > 0 && connectedDevices >= subscription.device_limit;
  if (!subscription.subscription_url) return null;
  return (
    <div>
      <button
        type="button"
        data-onboarding="connect-devices"
        onClick={() => {
          if (full && onManage) onManage();
          else
            navigate(
              full
                ? `/subscriptions/${subscription.id}`
                : (connectionPath ?? `/connection?sub=${subscription.id}`),
            );
        }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-3 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800"
      >
        <MonitorIcon className="h-[18px] w-[18px] shrink-0" />
        {full ? t('subscription.myDevices') : t('dashboard.connectDevice')}
      </button>
      <p className="mt-1.5 text-center text-xs leading-relaxed text-dark-200">
        {subscription.device_limit === 0
            ? t('dashboard.devicesConnectedUnlimited', { used: connectedDevices })
            : t('dashboard.ui.connectedDevices', {
                defaultValue: 'Подключено {{used}} из {{max}} устройств',
                used: connectedDevices,
                max: subscription.device_limit,
              })}
      </p>
      {full && <p className="mt-1 text-center text-xs leading-relaxed text-warning-300">{t('addonsUi.devicesFull')}{canIncreaseLimit && <span className="mt-1 block text-dark-300">{t('addonsUi.devicesFullHint')}</span>}</p>}
      {canIncreaseLimit && <button type="button" onClick={() => onIncreaseLimit ? onIncreaseLimit() : navigate(`/subscriptions/${subscription.id}?addon=devices`)} className="mx-auto mt-1 flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-accent-300 hover:bg-accent-500/10 active:bg-selected">+ {t('addonsUi.increaseDevices')}</button>}
    </div>
  );
}
