import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { copyToClipboard } from '@/utils/clipboard';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import type {
  AppConfig,
  LocalizedText,
  RemnawaveAppClient,
  RemnawavePlatformData,
  RemnawaveButtonClient,
} from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { CardsBlock, TimelineBlock, AccordionBlock, MinimalBlock, BlockButtons } from './blocks';
import type { BlockRendererProps, RenderBlock } from './blocks';
import TvQuickConnect from './TvQuickConnect';
import {
  BackIcon,
  BookOpenIcon,
  ChatIcon,
  CheckIcon,
  CopyIcon,
  QrCodeIcon,
} from '@/components/icons';

const platformOrder = ['ios', 'android', 'windows', 'macos', 'linux', 'androidTV', 'appleTV'];

function detectPlatform(): string | null {
  if (typeof window === 'undefined' || !navigator?.userAgent) return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return /tv|television/.test(ua) ? 'androidTV' : 'android';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/windows/.test(ua)) return 'windows';
  if (/linux/.test(ua)) return 'linux';
  return null;
}

const RENDERERS: Record<string, React.ComponentType<BlockRendererProps>> = {
  cards: CardsBlock,
  timeline: TimelineBlock,
  accordion: AccordionBlock,
  minimal: MinimalBlock,
};

/** TV quick-connect is a Happ-only feature (check.happ.su/sendtv) — show it only
 *  for the Happ app, detected by its happ:// deep-link scheme (name as fallback). */
function isHappApp(app: RemnawaveAppClient | null): boolean {
  if (!app) return false;
  if ((app.deepLink ?? '').toLowerCase().startsWith('happ://')) return true;
  return app.name.toLowerCase().includes('happ');
}

interface Props {
  appConfig: AppConfig;
  onOpenDeepLink: (url: string) => void;
  isTelegramWebApp: boolean;
  onGoBack: () => void;
  onOpenQR?: () => void;
  /** Ссылка для QR и блока «Ваша подписка» (с учётом режима Happ-cryptolink). */
  qrUrl?: string;
  username?: string;
}

export default function InstallationGuide({
  appConfig,
  onOpenDeepLink,
  isTelegramWebApp,
  onGoBack,
  onOpenQR,
  qrUrl,
  username,
}: Props) {
  const { t, i18n } = useTranslation();
  const { isLight } = useTheme();

  const detectedPlatform = useMemo(() => detectPlatform(), []);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [activePlatformKey, setActivePlatformKey] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<RemnawaveAppClient | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const getLocalizedText = useCallback(
    (text: LocalizedText | undefined): string => {
      if (!text) return '';
      const lang = i18n.language || 'en';
      return text[lang] || text['en'] || text['ru'] || Object.values(text)[0] || '';
    },
    [i18n.language],
  );

  const getBaseTranslation = useCallback(
    (key: string, i18nKey: string): string => {
      const bt = appConfig.baseTranslations;
      if (bt && key in bt) {
        const text = getLocalizedText(bt[key as keyof typeof bt] as LocalizedText);
        if (text) return text;
      }
      return t(i18nKey);
    },
    [appConfig.baseTranslations, getLocalizedText, t],
  );

  const getSvgHtml = useCallback(
    (svgKey: string | undefined): string => {
      if (!svgKey || !appConfig.svgLibrary?.[svgKey]) return '';
      const entry = appConfig.svgLibrary[svgKey];
      const raw = typeof entry === 'string' ? entry : entry.svgString;
      if (!raw) return '';
      return DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } });
    },
    [appConfig.svgLibrary],
  );

  const availablePlatforms = useMemo(() => {
    if (!appConfig.platforms) return [];
    const available = platformOrder.filter((key) => {
      const data = appConfig.platforms[key] as RemnawavePlatformData | undefined;
      return data && data.apps && data.apps.length > 0;
    });
    if (detectedPlatform && available.includes(detectedPlatform)) {
      return [detectedPlatform, ...available.filter((p) => p !== detectedPlatform)];
    }
    return available;
  }, [appConfig.platforms, detectedPlatform]);

  useEffect(() => {
    if (selectedApp || !availablePlatforms.length) return;
    const platform = availablePlatforms[0];
    const data = appConfig.platforms[platform] as RemnawavePlatformData | undefined;
    if (!data?.apps?.length) return;
    const app = data.apps.find((a) => a.featured) || data.apps[0];
    if (app) {
      setSelectedApp(app);
      setActivePlatformKey(platform);
    }
  }, [appConfig.platforms, availablePlatforms, selectedApp]);

  const renderBlockButtons = useCallback(
    (buttons: RemnawaveButtonClient[] | undefined, variant: 'light' | 'subtle' | 'step') => (
      <BlockButtons
        buttons={buttons}
        variant={variant}
        isLight={isLight}
        subscriptionUrl={appConfig.subscriptionUrl}
        hideLink={appConfig.hideLink}
        deepLink={selectedApp?.deepLink}
        username={username}
        getLocalizedText={getLocalizedText}
        getBaseTranslation={getBaseTranslation}
        getSvgHtml={getSvgHtml}
        onOpenDeepLink={onOpenDeepLink}
      />
    ),
    [
      appConfig.subscriptionUrl,
      appConfig.hideLink,
      selectedApp?.deepLink,
      username,
      isLight,
      getLocalizedText,
      getBaseTranslation,
      getSvgHtml,
      onOpenDeepLink,
    ],
  );

  const userIsOnTv = detectedPlatform === 'androidTV' || detectedPlatform === 'appleTV';
  // Happ's TV quick-connect (check.happ.su/sendtv) is ONE API serving BOTH
  // Android TV and Apple TV — show the widget on either.
  const selectedPlatform = activePlatformKey || availablePlatforms[0];
  const isTvLayout =
    (selectedPlatform === 'androidTV' || selectedPlatform === 'appleTV') && !userIsOnTv;

  const currentPlatformKey = activePlatformKey || availablePlatforms[0];
  const currentPlatformData = currentPlatformKey
    ? (appConfig.platforms[currentPlatformKey] as RemnawavePlatformData | undefined)
    : undefined;
  const currentPlatformApps = currentPlatformData?.apps || [];

  // Platform display name
  const getPlatformDisplayName = useCallback(
    (key: string): string => {
      const data = appConfig.platforms[key] as RemnawavePlatformData | undefined;
      if (data?.displayName) {
        const name = getLocalizedText(data.displayName);
        if (name) return name;
      }
      if (appConfig.platformNames?.[key]) {
        return getLocalizedText(appConfig.platformNames[key]);
      }
      const fallback: Record<string, string> = {
        ios: 'iOS',
        android: 'Android',
        windows: 'Windows',
        macos: 'macOS',
        linux: 'Linux',
        androidTV: 'Android TV',
        appleTV: 'Apple TV',
      };
      return fallback[key] || key;
    },
    [appConfig.platforms, appConfig.platformNames, getLocalizedText],
  );

  const selectPlatform = useCallback(
    (newPlatform: string) => {
      setActivePlatformKey(newPlatform);
      const data = appConfig.platforms[newPlatform] as RemnawavePlatformData | undefined;
      if (data?.apps?.length) {
        // Keep the user's current app (by name) if it also exists on the
        // new platform; only fall back to featured/first otherwise.
        const app =
          data.apps.find((a) => a.name === selectedApp?.name) ||
          data.apps.find((a) => a.featured) ||
          data.apps[0];
        if (app) setSelectedApp(app);
      }
    },
    [appConfig.platforms, selectedApp?.name],
  );

  // Block renderer
  const blockType = appConfig.uiConfig?.installationGuidesBlockType || 'cards';
  const Renderer = RENDERERS[blockType] || CardsBlock;

  // For the Happ TV app (Android TV / Apple TV), inject the TV connect widget as
  // customNode so it renders THROUGH the active block style (cards/timeline/
  // accordion/minimal) instead of as separate clashing cards that break it.
  const showTvConnect = Boolean(
    selectedApp && isTvLayout && isHappApp(selectedApp) && appConfig.subscriptionUrl,
  );
  let renderBlocks: RenderBlock[] = selectedApp?.blocks ?? [];
  if (selectedApp && showTvConnect && appConfig.subscriptionUrl) {
    // install → add-subscription → connect: attach to the add step (index 1);
    // fall back to the last block for shorter configs.
    const idx = selectedApp.blocks.length >= 3 ? 1 : Math.max(0, selectedApp.blocks.length - 1);
    const widget = <TvQuickConnect subscriptionUrl={appConfig.subscriptionUrl} isLight={isLight} />;
    renderBlocks = selectedApp.blocks.map((b, i) => (i === idx ? { ...b, customNode: widget } : b));
  }

  const showLink = Boolean(appConfig.subscriptionUrl) && !appConfig.hideLink;
  const sideUrl = qrUrl || appConfig.subscriptionUrl || '';

  const header = (
    <div className="flex items-center gap-3">
      {!isTelegramWebApp && (
        <button
          onClick={onGoBack}
          aria-label={t('common.back', 'Back')}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] border border-accent-500/20 bg-accent-500/[0.06] transition-colors hover:border-accent-400/40"
        >
          <BackIcon className="h-5 w-5" />
        </button>
      )}
      <h2 className="min-w-0 flex-1 text-2xl font-extrabold tracking-tight text-dark-50 sm:text-[30px]">
        {getBaseTranslation('installationGuideHeader', 'subscription.connection.title')}
      </h2>
      {appConfig.subscriptionUrl && onOpenQR && (
        <button
          onClick={() => onOpenQR()}
          aria-label={t('subscription.connection.openQr', 'Open QR code')}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] border border-accent-500/20 bg-accent-500/[0.06] text-accent-300 transition-colors hover:border-accent-400/40 lg:hidden"
        >
          <QrCodeIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  const platformPills = availablePlatforms.length > 1 && (
    <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {availablePlatforms.map((p) => {
        const on = p === currentPlatformKey;
        const svg = getSvgHtml(
          (appConfig.platforms[p] as RemnawavePlatformData | undefined)?.svgIconKey,
        );
        return (
          <button
            key={p}
            type="button"
            onClick={() => selectPlatform(p)}
            aria-pressed={on}
            className={`flex h-[42px] shrink-0 items-center gap-2 rounded-[14px] border px-4 text-sm font-bold transition-all ${
              on
                ? 'border-accent-300/60 text-white shadow-[0_8px_22px_-10px_rgb(var(--color-accent-500))]'
                : 'border-accent-500/20 bg-accent-500/[0.05] text-dark-300 hover:border-accent-400/40'
            }`}
            style={
              on
                ? {
                    background:
                      'linear-gradient(135deg, rgba(var(--color-accent-500), 0.35), rgba(var(--color-accent-600), 0.25))',
                  }
                : undefined
            }
          >
            {svg && (
              <span
                className="h-[18px] w-[18px] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
            {getPlatformDisplayName(p)}
          </button>
        );
      })}
    </div>
  );

  const appCards = currentPlatformApps.length > 0 && (
    <div className="grid max-w-[460px] grid-cols-2 gap-2.5 pt-2">
      {currentPlatformApps.map((app, idx) => {
        const isSelected = selectedApp?.name === app.name;
        return (
          <button
            key={app.name + idx}
            type="button"
            onClick={() => setSelectedApp(app)}
            aria-pressed={isSelected}
            className={`relative flex items-center justify-between gap-2 rounded-[14px] border px-3.5 py-3 text-left transition-all active:scale-[0.98] ${
              isSelected
                ? 'border-accent-300/55 shadow-[0_12px_28px_-16px_rgb(var(--color-accent-500))]'
                : 'border-accent-500/20 bg-accent-500/[0.05] hover:border-accent-400/40'
            }`}
            style={
              isSelected
                ? {
                    background:
                      'linear-gradient(160deg, rgba(var(--color-accent-500), 0.28), rgba(var(--color-accent-500), 0.06))',
                  }
                : undefined
            }
          >
            {app.featured && (
              <span className="absolute -top-2 left-3 rounded-full bg-gradient-to-r from-accent-300 to-accent-600 px-2 py-px text-[9px] font-extrabold uppercase tracking-wider text-white">
                {t('subscription.connection.recommended')}
              </span>
            )}
            <span className="min-w-0 truncate text-[15px] font-extrabold tracking-tight text-dark-50">
              {app.name}
            </span>
            {isSelected ? (
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-300 to-accent-600 text-white">
                <CheckIcon className="h-3 w-3" />
              </span>
            ) : (
              <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-accent-500/30" />
            )}
          </button>
        );
      })}
    </div>
  );

  const supportPlaque = (
    <div className="flex items-center gap-3 rounded-[18px] border border-accent-500/25 bg-accent-500/[0.07] p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/15 text-accent-300">
        <ChatIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold text-dark-50">
          {t('subscription.connection.supportTitle')}
        </div>
        <div className="mt-0.5 text-xs leading-snug text-dark-400">
          {t('subscription.connection.supportDescription')}
        </div>
      </div>
      <Link
        to="/support"
        className="shrink-0 rounded-xl border border-accent-400/40 bg-accent-500/20 px-3.5 py-2 text-[13px] font-extrabold text-dark-50 transition-colors hover:bg-accent-500/30"
      >
        {t('subscription.connection.supportButton')}
      </Link>
    </div>
  );

  const sideCard = sideUrl && (
    <div className="hidden rounded-3xl border border-accent-500/20 bg-accent-500/[0.05] p-5 lg:block">
      <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-dark-400">
        {t('subscription.connection.yourSubscription')}
      </div>
      {showLink && (
        <div className="mt-3 flex h-[46px] items-center gap-2 rounded-[14px] border border-accent-500/20 bg-dark-950/60 px-3.5 font-mono text-[12.5px] text-dark-400">
          <span className="min-w-0 flex-1 truncate">{sideUrl}</span>
          <button
            type="button"
            aria-label={t('common.copy', 'Копировать')}
            onClick={() => {
              void copyToClipboard(sideUrl);
              setLinkCopied(true);
              window.setTimeout(() => setLinkCopied(false), 1500);
            }}
            className="shrink-0 text-accent-300 transition-colors hover:text-accent-200"
          >
            {linkCopied ? (
              <CheckIcon className="h-[18px] w-[18px]" />
            ) : (
              <CopyIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      )}
      <div className="mt-3.5 flex items-center gap-4">
        <div className="h-[132px] w-[132px] shrink-0 rounded-2xl bg-white p-2.5">
          <QRCodeSVG value={sideUrl} size={112} level="M" className="h-full w-full" />
        </div>
        <p className="text-[13px] leading-relaxed text-dark-400">
          {t('subscription.connection.qrHint')}
        </p>
      </div>
    </div>
  );

  return (
    <div className="pb-6">
      <div className="space-y-4">
        {header}
        {platformPills}
      </div>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          {appCards}

          {/* Tutorial button */}
          {appConfig.baseSettings?.isShowTutorialButton && appConfig.baseSettings?.tutorialUrl && (
            <a
              href={appConfig.baseSettings.tutorialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full justify-center"
            >
              <BookOpenIcon className="h-5 w-5" />
              {getBaseTranslation('tutorial', 'subscription.connection.tutorial')}
            </a>
          )}

          {/* Blocks rendered in the panel's active style. For the Happ Android TV
              app the TV connect widget is injected into a step (customNode), so it
              adapts to that style instead of breaking it. */}
          {selectedApp && (
            <Renderer
              blocks={renderBlocks}
              isMobile={isMobile}
              isLight={isLight}
              getLocalizedText={getLocalizedText}
              getSvgHtml={getSvgHtml}
              renderBlockButtons={renderBlockButtons}
            />
          )}

          <div className="lg:hidden">{supportPlaque}</div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          {sideCard}
          <div className="hidden lg:block">{supportPlaque}</div>
        </div>
      </div>
    </div>
  );
}
