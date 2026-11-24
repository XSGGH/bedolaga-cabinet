import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, DevicesIcon, PlusIcon } from '@/components/icons';

export default function AddonOpportunities({ canAddDevices, canAddTraffic, onDevices, onTraffic }: {
  canAddDevices: boolean;
  canAddTraffic: boolean;
  onDevices: () => void;
  onTraffic: () => void;
}) {
  const { t } = useTranslation();
  if (!canAddDevices && !canAddTraffic) return null;
  return (
    <section className="order-2 space-y-2" aria-label={t('addonsUi.title')}>
      <h2 className="text-sm font-semibold text-dark-200">{t('addonsUi.title')}</h2>
      <div className={`grid gap-2 ${canAddDevices && canAddTraffic ? 'min-[390px]:grid-cols-2' : ''}`}>
        {canAddDevices && <button type="button" onClick={onDevices} className="group flex min-w-0 items-start gap-2 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent-500/40 hover:bg-elevated active:bg-selected">
          <DevicesIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-dark-100">{t('addonsUi.devicesTitle')}</span><span className="mt-1 block text-xs leading-relaxed text-dark-400">{t('addonsUi.devicesHint')}</span><span className="mt-2 block text-xs font-medium text-accent-300">{t('addonsUi.increaseDevices')}</span></span>
          <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-dark-400" />
        </button>}
        {canAddTraffic && <button type="button" onClick={onTraffic} className="group flex min-w-0 items-start gap-2 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent-500/40 hover:bg-elevated active:bg-selected">
          <PlusIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-dark-100">{t('addonsUi.trafficTitle')}</span><span className="mt-1 block text-xs leading-relaxed text-dark-400">{t('addonsUi.trafficHint')}</span><span className="mt-2 block text-xs font-medium text-accent-300">{t('addonsUi.buy')}</span></span>
          <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-dark-400" />
        </button>}
      </div>
    </section>
  );
}
