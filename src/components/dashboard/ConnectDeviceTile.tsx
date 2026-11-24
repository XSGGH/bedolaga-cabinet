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

export default function ConnectDeviceTile({
  subscription,
  connectedDevices,
  onManage,
  connectionPath,
  canIncreaseLimit = false,
  showSummary = true,
  onIncreaseLimit,
}: ConnectDeviceTileProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const full =
    subscription.device_limit > 0 &&
    connectedDevices !== undefined &&
    connectedDevices >= subscription.device_limit;
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
        className={`${subscriptionActionClass} bg-accent-500 text-on-accent hover:bg-accent-600 active:bg-accent-700 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800`}
      >
        <MonitorIcon className="h-[18px] w-[18px] shrink-0" />
        {full ? t('subscription.myDevices') : t('dashboard.connectDevice')}
      </button>
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
          className="mt-2 w-full"
        >
          {t('addonsUi.increaseDevices')}
        </AddonPurchaseButton>
      )}
    </div>
  );
}
