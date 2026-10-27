import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PiAppleLogo } from 'react-icons/pi';
import { ChevronRightIcon, XIcon } from '@/components/icons';
import { safeLocal } from '../../utils/safeStorage';

const DISMISS_KEY = 'xsg_stealthnet_promo_dismissed';

/**
 * Плашка о новой интеграции StealthNet для iPhone и Mac.
 * Ведёт на страницу подключения, закрывается крестиком навсегда.
 */
export default function AppUpdatePromo() {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(() => safeLocal.getItem(DISMISS_KEY) === '1');
  if (hidden) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent-500/35 bg-gradient-to-r from-accent-500/[0.20] via-accent-500/[0.08] to-transparent py-3 pl-3.5 pr-2">
      <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-accent-500/25 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_6px_16px_rgba(163,92,255,0.40)]">
          <PiAppleLogo className="h-[22px] w-[22px]" />
        </span>
        <Link to="/connection" className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold leading-tight text-dark-50">
              {t('dashboard.appUpdatePromo.title')}
            </span>
            <span className="rounded-md bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-accent-300">
              {t('dashboard.appUpdatePromo.badge')}
            </span>
          </div>
          <div className="mt-0.5 text-xs leading-snug text-dark-300">
            {t('dashboard.appUpdatePromo.text')}
          </div>
        </Link>
        <Link
          to="/connection"
          className="hidden flex-shrink-0 items-center gap-1 rounded-lg bg-accent-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-400 sm:flex"
        >
          {t('dashboard.appUpdatePromo.button')}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
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
    </div>
  );
}
