import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { HIDDEN_UNDER_KEYBOARD, useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

import { HomeIcon, SubscriptionIcon, WalletIcon, UsersIcon, ChatIcon, WheelIcon } from './icons';
import type { MobileNavItem, MobileNavKey } from './mobileNavRoutes';

type NavIcon = React.ComponentType<{ className?: string }>;

const ICONS: Record<MobileNavKey, NavIcon> = {
  dashboard: HomeIcon,
  subscription: SubscriptionIcon,
  balance: WalletIcon,
  wheel: WheelIcon,
  referral: UsersIcon,
  support: ChatIcon,
};

interface MobileBottomNavProps {
  /** Экраны панели — из mobileNavItems(); AppShell рендерит панель только на них. */
  items: readonly MobileNavItem[];
  /** Открыто выезжающее меню шапки: у него есть все те же пункты, панель поверх него лишняя. */
  isMenuOpen?: boolean;
}

export function MobileBottomNav({ items, isMenuOpen = false }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();
  const isKeyboardOpen = useVirtualKeyboard();
  const reducedMotion = useReducedMotion();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <nav
      className={cn(
        'fixed z-50 transition-all duration-200 lg:hidden',
        'bg-navigation',
        'border border-line',
        isKeyboardOpen || isMenuOpen ? HIDDEN_UNDER_KEYBOARD : 'opacity-100',
      )}
      style={{
        // Отступ снизу и просвет под панелью объявлены в globals.css
        // (--mobile-nav-*): в standalone iOS inset около 34pt, и панель стоит
        // вплотную к безопасной зоне, в браузере — 16px.
        bottom: 'var(--mobile-nav-offset)',
        // По бокам та же логика: в альбомной ориентации iPhone вырезы слева и
        // справа около 59pt, панель не должна уходить под чёлку и углы.
        left: 'max(16px, env(safe-area-inset-left, 0px))',
        right: 'max(16px, env(safe-area-inset-right, 0px))',
        borderRadius: 'var(--bento-radius, 24px)',
        padding: '6px 4px',
      }}
    >
      <div className="flex justify-around">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive(item.path) ? 'page' : undefined}
              onClick={handleNavClick}
              className={cn(
                // На 360 пяти пунктам достаётся по ~64 px: при px-3 подпись
                // «Колесо удачи» заходила на соседа. Боковых полей нет (подсветка —
                // по всему пункту), подпись короткая (navShort), а если и она не
                // влезла — многоточие, не наезд.
                'relative flex min-h-[62px] min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-0 py-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400',
                isActive(item.path) ? 'text-accent-400' : 'text-dark-400 hover:text-dark-200',
              )}
            >
              {isActive(item.path) && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-2xl bg-selected"
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 500, damping: 30 }
                  }
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10 mt-1 max-w-full truncate text-[10px] leading-4 min-[360px]:text-[11px]">
                {t(`navShort.${item.key}`, { defaultValue: t(`nav.${item.key}`) })}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
