import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MonitorIcon } from '@/components/icons';
import AddonPurchaseButton from '@/components/subscription/AddonPurchaseButton';
import { subscriptionActionClass } from '@/components/subscription/actionStyles';
import DeviceSlotsIndicator from './DeviceSlotsIndicator';

interface ConnectDeviceTileProps {
  subscription: { id: number; device_limit: number; subscription_url?: string | null };
  connectedDevices: number | undefined;
  usedPercent?: number;
  onManage?: () => void;
  connectionPath?: string;
  canIncreaseLimit?: boolean;
  showSummary?: boolean;
  onIncreaseLimit?: () => void;
}

function deviceLimitReached({ subscription, connectedDevices }: ConnectDeviceTileProps) {
  return (
    subscription.device_limit > 0 &&
    connectedDevices !== undefined &&
    connectedDevices >= subscription.device_limit
  );
}

export function ConnectDeviceAction({
  subscription,
  connectedDevices,
  onManage,
  connectionPath,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const full = deviceLimitReached({ subscription, connectedDevices });
  if (!subscription.subscription_url) return null;
  return (
    <button
      type="button"
      data-onboarding="connect-devices"
      data-full={full ? true : undefined}
      onClick={() => {
        if (full && onManage) onManage();
        else
          navigate(
            full
              ? `/subscriptions/${subscription.id}`
              : (connectionPath ?? `/connection?sub=${subscription.id}`),
          );
      }}
      className={`xsg-connect-primary ${subscriptionActionClass} bg-accent-500 text-on-accent hover:bg-accent-600 active:bg-accent-700 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800`}
    >
      <MonitorIcon className="h-[18px] w-[18px] shrink-0" />
      {full ? t('subscription.myDevices') : t('dashboard.connectDevice')}
    </button>
  );
}

export function DeviceConnectionSummary({
  subscription,
  connectedDevices,
  canIncreaseLimit = false,
  showSummary = true,
  onIncreaseLimit,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const full = deviceLimitReached({ subscription, connectedDevices });
  if (!subscription.subscription_url) return null;
  return (
    <>
      {showSummary && (
        <DeviceSlotsIndicator
          connectedDevices={connectedDevices}
          deviceLimit={subscription.device_limit}
        />
      )}
      {full && canIncreaseLimit && (
        <AddonPurchaseButton
          onClick={() =>
            onIncreaseLimit
              ? onIncreaseLimit()
              : navigate(`/subscriptions/${subscription.id}?addon=devices`)
          }
          className="xsg-device-buy mt-2 w-full"
        >
          {t('addonsUi.increaseDevices')}
        </AddonPurchaseButton>
      )}
    </>
  );
}

export default function ConnectDeviceTile(props: ConnectDeviceTileProps) {
  if (!props.subscription.subscription_url) return null;
  return (
    <div className="xsg-connect-tile">
      <ConnectDeviceAction {...props} />
      <DeviceConnectionSummary {...props} />
    </div>
  );
}
