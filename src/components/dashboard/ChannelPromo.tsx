import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiTelegramLogo } from 'react-icons/pi';
import { usePlatform } from '@/platform';
import { XIcon } from '@/components/icons';
import { safeLocal } from '../../utils/safeStorage';

const CHANNEL_URL = 'https://t.me/xsgvpn';
const DISMISS_KEY = 'xsg_channel_promo_dismissed';

/**
 * Ненавязчивая плашка с приглашением в Telegram-канал. Закрывается крестиком
 * и больше не показывается на этом устройстве.
 */
export default function ChannelPromo() {
  const { t } = useTranslation();
  const { openLink } = usePlatform();
  const [hidden, setHidden] = useState(() => safeLocal.getItem(DISMISS_KEY) === '1');
  if (hidden) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--xsg-line)] bg-dark-900/60 py-2.5 pl-3.5 pr-2">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#2AABEE]/15 text-[#5bc0f5]">
        <PiTelegramLogo className="h-5 w-5" />
      </span>
      <button
        type="button"
        onClick={() => openLink(CHANNEL_URL)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="text-[13.5px] font-bold leading-tight text-dark-50">
          {t('dashboard.channelPromo.title')}
        </div>
        <div className="mt-0.5 text-xs leading-snug text-dark-400">
          {t('dashboard.channelPromo.text')}
        </div>
      </button>
      <button
        type="button"
        onClick={() => openLink(CHANNEL_URL)}
        className="hidden flex-shrink-0 rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-1.5 text-xs font-bold text-accent-300 transition-colors hover:bg-accent-500/20 sm:block"
      >
        {t('dashboard.channelPromo.button')}
      </button>
      <button
        type="button"
        onClick={() => {
          safeLocal.setItem(DISMISS_KEY, '1');
          setHidden(true);
        }}
        aria-label={t('common.close', 'Закрыть')}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-dark-800 hover:text-dark-200"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
