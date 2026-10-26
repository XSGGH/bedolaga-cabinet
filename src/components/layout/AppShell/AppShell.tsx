import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/store/auth';
import { useHaptic } from '@/platform';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { useTheme } from '@/hooks/useTheme';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useLiteMode } from '@/hooks/useLiteMode';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { resetVirtualKeyboard } from '@/hooks/useVirtualKeyboard';
import { themeColorsApi } from '@/api/themeColors';
import { isLogoPreloaded } from '@/api/branding';
import { cn } from '@/lib/utils';

import WebSocketNotifications from '@/components/WebSocketNotifications';
import CampaignBonusNotifier from '@/components/CampaignBonusNotifier';
import SuccessNotificationModal from '@/components/SuccessNotificationModal';
import { PromptDialogHost } from '@/components/PromptDialogHost';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import {
  SubscriptionIcon,
  GiftIcon,
  HomeIcon,
  CreditCardIcon,
  ChatIcon,
  UserIcon,
  UsersIcon,
  ShieldIcon,
  InfoIcon,
  SunIcon,
  MoonIcon,
} from '@/components/icons';

import { MobileBottomNav } from './MobileBottomNav';
import { isMobileNavScreen, mobileNavItems } from './mobileNavRoutes';
import { AppHeader } from './AppHeader';
import { LogoutButton } from './LogoutButton';
import { useBackgroundConsumer } from '@/components/backgrounds/BackgroundHost';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const { isFullscreen, safeAreaInset, contentSafeAreaInset, platform, isMobile } =
    useTelegramSDK();
  const { mobileCss: headerHeight } = useHeaderHeight();
  const haptic = useHaptic();
  const { toggleTheme, isDark } = useTheme();

  // Extracted hooks
  const { appName, logoLetter, hasCustomLogo, logoUrl } = useBranding();
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
  const { lite } = useLiteMode();
  useScrollRestoration();
  // Анимированный фон рендерит BackgroundHost в App (не перемонтируется при
  // смене роута) — здесь только регистрируем, что на этом роуте он нужен.
  useBackgroundConsumer();

  // Theme toggle visibility
  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;

  // Only apply fullscreen UI adjustments on mobile Telegram (iOS/Android)
  const isMobileFullscreen = isFullscreen && isMobile;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Смена экрана закрывает сигнал «клавиатура открыта» (useVirtualKeyboard):
  // поле с фокусом размонтировано, blur не приходит, и прижатые к низу элементы
  // иначе остаются спрятанными.
  // biome-ignore lint/correctness/useExhaustiveDependencies: путь нужен как триггер — сброс на каждой смене экрана
  useEffect(() => {
    resetVirtualKeyboard();
  }, [location.pathname]);

  // Нижняя панель живёт только на экранах своих кнопок; на остальных её нет и
  // место под неё не резервируется (data-mobile-nav="off" → --mobile-nav-clearance).
  const navItems = mobileNavItems({ wheelEnabled, referralEnabled, lite });
  const showMobileNav = isMobileNavScreen(location.pathname, navItems);

  // Desktop navigation — labels always visible (no hover-reveal gimmick)
  const desktopNav = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: CreditCardIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    ...(giftEnabled ? [{ path: '/gift', label: t('nav.gift'), icon: GiftIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: ChatIcon },
    { path: '/info', label: t('nav.info'), icon: InfoIcon },
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    haptic.impact('light');
  };

  // Пункт бокового меню (десктоп): иконка + подпись, активный подсвечен
  // акцентной полоской слева (стили — .xsg-side-link в styles/xsg.css).
  const renderNavLink = (
    path: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    admin = false,
  ) => {
    const active = admin ? location.pathname.startsWith('/admin') : isActive(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={handleNavClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        data-active={active}
        data-admin={admin}
        className="xsg-side-link"
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  // headerHeight comes from useHeaderHeight() — accounts for TG safe area in fullscreen

  return (
    <div className="min-h-viewport" data-mobile-nav={showMobileNav ? 'on' : 'off'}>
      {/* Global components */}
      <WebSocketNotifications />
      <CampaignBonusNotifier />
      <SuccessNotificationModal />
      <PromptDialogHost />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-accent-500/15 bg-dark-900 lg:flex">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3 px-6 pb-6 pt-7"
          onClick={handleNavClick}
        >
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-accent-500/15 ring-1 ring-accent-500/30">
            <span
              className={cn(
                'absolute text-sm font-bold text-accent-400 transition-opacity duration-200',
                hasCustomLogo && isLogoPreloaded() ? 'opacity-0' : 'opacity-100',
              )}
            >
              {logoLetter}
            </span>
            {hasCustomLogo && logoUrl && (
              <img
                src={logoUrl}
                alt={appName || 'Logo'}
                className={cn(
                  'absolute h-full w-full object-contain transition-opacity duration-200',
                  isLogoPreloaded() ? 'opacity-100' : 'opacity-0',
                )}
              />
            )}
          </div>
          <span className="truncate text-[13px] font-semibold uppercase tracking-[0.16em] text-dark-100">
            {appName}
          </span>
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {desktopNav.map((item) => renderNavLink(item.path, item.label, item.icon))}
          {isAdmin && (
            <>
              <div className="mx-3 my-2 h-px shrink-0 bg-dark-800" />
              {renderNavLink('/admin', t('admin.nav.title'), ShieldIcon, true)}
            </>
          )}
        </nav>

        <div className="flex shrink-0 items-stretch gap-2 border-t border-dark-800 px-4 py-4 [&>*]:flex-1 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:justify-center">
          <button
            onClick={() => {
              haptic.impact('light');
              toggleTheme();
            }}
            className={cn(
              'rounded-xl border border-accent-500/20 bg-dark-900 p-2 text-dark-400 transition-colors duration-200 hover:text-accent-400',
              !canToggleTheme && 'hidden',
            )}
            aria-label={isDark ? t('theme.light') || 'Light mode' : t('theme.dark') || 'Dark mode'}
            title={isDark ? t('theme.light') || 'Light mode' : t('theme.dark') || 'Dark mode'}
          >
            {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
          </button>
          <TicketNotificationBell isAdmin={location.pathname.startsWith('/admin')} />
          <LanguageSwitcher />
          <LogoutButton
            variant="icon"
            onLogout={() => {
              haptic.impact('light');
              logout();
            }}
          />
        </div>
      </aside>

      {/* Mobile Header */}
      <AppHeader
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onCommandPaletteOpen={() => {}}
        headerHeight={headerHeight}
        isFullscreen={isMobileFullscreen}
        safeAreaInset={safeAreaInset}
        contentSafeAreaInset={contentSafeAreaInset}
        telegramPlatform={platform}
        wheelEnabled={wheelEnabled}
        referralEnabled={referralEnabled}
        hasContests={hasContests}
        hasPolls={hasPolls}
        giftEnabled={giftEnabled}
      />

      {/* Mobile spacer */}
      <div className="lg:hidden" style={{ height: headerHeight }} />

      {/* Main content */}
      {/* Боковые отступы не меньше вырезов (альбомная ориентация iPhone); снизу —
          просвет под панелью: фиксированные 112px в standalone iOS не хватало,
          и низ контента уходил под неё. */}
      <main className="mx-auto max-w-6xl py-6 pb-[calc(var(--mobile-nav-clearance)+0.5rem)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] lg:ml-60 lg:max-w-none lg:px-10 lg:py-10 lg:pb-12">
        <div className="mx-auto max-w-[1360px]">{children}</div>
      </main>

      {/* Mobile Bottom Navigation — только на экранах её кнопок */}
      {showMobileNav && <MobileBottomNav items={navItems} isMenuOpen={mobileMenuOpen} />}
    </div>
  );
}
