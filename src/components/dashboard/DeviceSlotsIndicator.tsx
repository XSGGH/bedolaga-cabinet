import { useTranslation } from 'react-i18next';
import { DevicesIcon } from '@/components/icons';

/** Read-only occupancy: individual slots up to eight, one proportional bar above that. */
export default function DeviceSlotsIndicator({
  connectedDevices,
  deviceLimit,
}: {
  connectedDevices: number | undefined;
  deviceLimit: number;
}) {
  const { t } = useTranslation();
  const known = Number.isFinite(connectedDevices) && connectedDevices! >= 0;
  const unlimited = deviceLimit === 0;
  const finiteLimit = Number.isFinite(deviceLimit) && deviceLimit > 0;
  const used = known ? connectedDevices! : 0;
  const free = finiteLimit ? Math.max(0, deviceLimit - used) : 0;
  const full = known && finiteLimit && free === 0;
  const progress = finiteLimit ? Math.min(1, used / deviceLimit) : 0;

  return (
    <div className="mt-2 rounded-xl bg-inset px-3 py-2.5" data-testid="device-slots">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-dark-300">
          <DevicesIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-dark-400" />
          {t('subscriptionCommand.devices')}
        </span>
        <span className="font-semibold tabular-nums text-dark-100">
          {known ? used : '—'} / {unlimited ? '∞' : finiteLimit ? deviceLimit : '—'}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {finiteLimit && known && (
          <div
            role="progressbar"
            aria-label={t('subscriptionCommand.devices')}
            aria-valuemin={0}
            aria-valuemax={deviceLimit}
            aria-valuenow={Math.min(used, deviceLimit)}
            aria-valuetext={`${used} / ${deviceLimit}`}
            className="flex h-1.5 min-w-0 flex-1 gap-1 overflow-hidden rounded-full bg-dark-700/40"
          >
            {Number.isInteger(deviceLimit) && deviceLimit <= 8 ? (
              Array.from({ length: deviceLimit }, (_, slot) => (
                <span
                  key={slot}
                  aria-hidden="true"
                  className={`h-full flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${slot < used ? 'bg-accent-400/60' : 'bg-dark-700/60'}`}
                />
              ))
            ) : (
              <span
                aria-hidden="true"
                className="h-full w-full origin-left rounded-full bg-accent-400/60 transition-transform duration-200 motion-reduce:transition-none"
                style={{ transform: `scaleX(${progress})` }}
              />
            )}
          </div>
        )}
        <span
          className={`shrink-0 text-xs leading-relaxed ${full ? 'text-warning-300' : 'text-dark-300'}`}
        >
          {!known || (!finiteLimit && !unlimited)
            ? t('subscriptionCommand.devicesUnknown')
            : unlimited
              ? t('dashboard.unlimited')
              : full
                ? t('addonsUi.devicesFull')
                : t('subscriptionCommand.freeSlots', { count: free })}
        </span>
      </div>
    </div>
  );
}
