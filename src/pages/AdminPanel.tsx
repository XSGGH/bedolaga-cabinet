import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { usePermissionStore } from '@/store/permissions';
import { adminApi, statsApi, type SystemInfo, type DashboardStats } from '@/api/admin';
import { withdrawalApi } from '@/api/withdrawals';
import { useCurrency } from '@/hooks/useCurrency';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { cn } from '@/lib/utils';
import {
  ArrowUpIcon,
  BellIcon,
  BroadcastIcon,
  CabinetIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CreditCardIcon,
  FileTextIcon,
  GiftIcon,
  HistoryIcon,
  LifebuoyIcon,
  LockIcon,
  MailIcon,
  MegaphoneIcon,
  NewsIcon,
  PartnerIcon,
  PercentIcon,
  PinIcon,
  RemnawaveIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  ShareIcon,
  ShieldIcon,
  SparklesIcon,
  StatBotIcon,
  StatCabinetIcon,
  StatPaidIcon,
  StatsChartIcon,
  StatTrialIcon,
  StatUptimeIcon,
  SyncIcon,
  TagIcon,
  TicketIcon,
  TrafficIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  WheelIcon,
  XIcon,
  RadarIcon,
  WallIcon,
} from '@/components/icons';

const CABINET_VERSION = __APP_VERSION__;
const IS_MAC = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);

// Section nav icons (24x24 viewBox)
const icons = {
  'bar-chart': <ChartBarIcon />,
  'credit-card': <CreditCardIcon />,
  activity: <TrafficIcon />,
  trending: <StatsChartIcon />,
  users: <UsersIcon />,
  ticket: <TicketIcon />,
  'shield-alert': <ShieldIcon />,
  tag: <TagIcon />,
  gift: <GiftIcon />,
  percent: <PercentIcon />,
  sparkle: <SparklesIcon />,
  wallet: <WalletIcon />,
  layout: <CabinetIcon />,
  newspaper: <NewsIcon />,
  megaphone: <MegaphoneIcon />,
  send: <SendIcon />,
  pin: <PinIcon />,
  bell: <BellIcon />,
  'circle-dot': <WheelIcon />,
  handshake: <PartnerIcon />,
  'arrow-up': <ArrowUpIcon />,
  network: <ShareIcon />,
  radio: <BroadcastIcon />,
  settings: <SettingsIcon />,
  app: <CabinetIcon />,
  server: <ServerIcon />,
  remnawave: <RemnawaveIcon />,
  radar: <RadarIcon />,
  wall: <WallIcon />,
  mail: <MailIcon />,
  refresh: <SyncIcon />,
  shield: <ShieldIcon />,
  'user-check': <UserPlusIcon />,
  lifebuoy: <LifebuoyIcon />,
  lock: <LockIcon />,
  scroll: <HistoryIcon />,
  'list-checks': <ClipboardIcon />,
  search: <SearchIcon />,
  'file-text': <FileTextIcon />,
  chevron: <ChevronRightIcon />,
  x: <XIcon />,
} as const;

type IconName = keyof typeof icons;

// ─── Section Data ───

interface AdminNavItem {
  name: string;
  icon: IconName;
  to: string;
  permission: string;
}

interface AdminSection {
  id: string;
  titleKey: string;
  accent: string;
  gradient: string;
  items: AdminNavItem[];
}

const sections: AdminSection[] = [
  {
    id: 'analytics',
    titleKey: 'admin.groups.analytics',
    accent: 'rgb(var(--color-success-400))',
    gradient:
      'linear-gradient(135deg, rgb(var(--color-success-400)), rgb(var(--color-accent-500)))',
    items: [
      {
        name: 'admin.nav.dashboard',
        icon: 'bar-chart',
        to: '/admin/dashboard',
        permission: 'stats:read',
      },
      {
        name: 'admin.nav.payments',
        icon: 'credit-card',
        to: '/admin/payments',
        permission: 'payments:read',
      },
      {
        name: 'admin.nav.trafficUsage',
        icon: 'activity',
        to: '/admin/traffic-usage',
        permission: 'traffic:read',
      },
      {
        name: 'admin.nav.salesStats',
        icon: 'trending',
        to: '/admin/sales-stats',
        permission: 'sales_stats:read',
      },
    ],
  },
  {
    id: 'users',
    titleKey: 'admin.groups.users',
    accent: 'rgb(var(--color-accent-400))',
    gradient: 'linear-gradient(135deg, rgb(var(--color-accent-400)), rgb(var(--color-error-400)))',
    items: [
      { name: 'admin.nav.users', icon: 'users', to: '/admin/users', permission: 'users:read' },
      {
        name: 'admin.nav.bulkActions',
        icon: 'list-checks',
        to: '/admin/bulk-actions',
        permission: 'bulk_actions:read',
      },
      {
        name: 'admin.nav.tickets',
        icon: 'ticket',
        to: '/admin/tickets',
        permission: 'tickets:read',
      },
      {
        name: 'admin.nav.banSystem',
        icon: 'shield-alert',
        to: '/admin/ban-system',
        permission: 'ban_system:read',
      },
    ],
  },
  {
    id: 'tariffs',
    titleKey: 'admin.groups.tariffs',
    accent: 'rgb(var(--color-warning-400))',
    gradient: 'linear-gradient(135deg, rgb(var(--color-warning-400)), rgb(var(--color-error-300)))',
    items: [
      { name: 'admin.nav.tariffs', icon: 'tag', to: '/admin/tariffs', permission: 'tariffs:read' },
      {
        name: 'admin.nav.promocodes',
        icon: 'gift',
        to: '/admin/promocodes',
        permission: 'promocodes:read',
      },
      {
        name: 'admin.nav.coupons',
        icon: 'ticket',
        to: '/admin/coupons',
        permission: 'coupons:read',
      },
      {
        name: 'admin.nav.promoGroups',
        icon: 'percent',
        to: '/admin/promo-groups',
        permission: 'promo_groups:read',
      },
      {
        name: 'admin.nav.promoOffers',
        icon: 'sparkle',
        to: '/admin/promo-offers',
        permission: 'promo_offers:read',
      },
      {
        name: 'admin.nav.paymentMethods',
        icon: 'wallet',
        to: '/admin/payment-methods',
        permission: 'payment_methods:read',
      },
      {
        name: 'admin.nav.landings',
        icon: 'layout',
        to: '/admin/landings',
        permission: 'landings:read',
      },
    ],
  },
  {
    id: 'marketing',
    titleKey: 'admin.groups.marketing',
    accent: 'rgb(var(--color-accent-300))',
    gradient: 'linear-gradient(135deg, rgb(var(--color-accent-300)), rgb(var(--color-accent-600)))',
    items: [
      { name: 'admin.nav.news', icon: 'newspaper', to: '/admin/news', permission: 'news:read' },
      {
        name: 'admin.nav.campaigns',
        icon: 'megaphone',
        to: '/admin/campaigns',
        permission: 'campaigns:read',
      },
      {
        name: 'admin.nav.broadcasts',
        icon: 'send',
        to: '/admin/broadcasts',
        permission: 'broadcasts:read',
      },
      {
        name: 'admin.nav.pinnedMessages',
        icon: 'pin',
        to: '/admin/pinned-messages',
        permission: 'pinned_messages:read',
      },
      {
        name: 'admin.nav.reminders',
        icon: 'bell',
        to: '/admin/reminders',
        permission: 'user_reminders:read',
      },
      { name: 'admin.nav.wheel', icon: 'circle-dot', to: '/admin/wheel', permission: 'wheel:read' },
      {
        name: 'admin.nav.partners',
        icon: 'handshake',
        to: '/admin/partners',
        permission: 'partners:read',
      },
      {
        // Раньше страница уровней открывалась только из Партнёры → Настройки, и
        // включив многоуровневую схему, админ не находил её в меню вовсе.
        // Пункт показывается всегда, а не при включённой схеме: саму схему
        // переключают с этой же страницы, и условный пункт замкнул бы круг.
        name: 'admin.nav.referralLevels',
        icon: 'trending',
        to: '/admin/partners/referral-levels',
        // Совпадает с правом, которое требуют и маршрут, и все эндпоинты уровней.
        permission: 'partners:settings',
      },
      {
        name: 'admin.nav.withdrawals',
        icon: 'arrow-up',
        to: '/admin/withdrawals',
        permission: 'withdrawals:read',
      },
      {
        name: 'admin.nav.referralNetwork',
        icon: 'network',
        to: '/admin/referral-network',
        permission: 'stats:read',
      },
    ],
  },
  {
    id: 'system',
    titleKey: 'admin.groups.system',
    accent: 'rgb(var(--color-accent-500))',
    gradient:
      'linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-success-500)))',
    items: [
      {
        name: 'admin.nav.channelSubscriptions',
        icon: 'radio',
        to: '/admin/channel-subscriptions',
        permission: 'channels:read',
      },
      {
        name: 'admin.nav.settings',
        icon: 'settings',
        to: '/admin/settings',
        permission: 'settings:read',
      },
      {
        // Настройки grace-доступа существуют и на общей странице настроек — там это
        // двенадцать несвязанных строк. Тут они собраны вместе с проверкой конфигурации
        // и состоянием сессий, поэтому и пункт меню отдельный.
        name: 'admin.nav.graceAccess',
        icon: 'lifebuoy',
        to: '/admin/grace-access',
        // То же право, что у страницы настроек и у эндпоинтов раздела.
        permission: 'settings:read',
      },
      { name: 'admin.nav.apps', icon: 'app', to: '/admin/apps', permission: 'apps:read' },
      {
        name: 'admin.nav.servers',
        icon: 'server',
        to: '/admin/servers',
        permission: 'servers:read',
      },
      {
        name: 'admin.nav.remnawave',
        icon: 'remnawave',
        to: '/admin/remnawave',
        permission: 'remnawave:read',
      },
      {
        name: 'admin.nav.reachability',
        icon: 'radar',
        to: '/admin/reachability',
        permission: 'reachability:read',
      },
      {
        name: 'admin.nav.dpichecker',
        icon: 'wall',
        to: '/admin/dpichecker',
        permission: 'dpichecker:read',
      },
      {
        name: 'admin.nav.emailTemplates',
        icon: 'mail',
        to: '/admin/email-templates',
        permission: 'email_templates:read',
      },
      {
        name: 'admin.nav.infoPages',
        icon: 'file-text',
        to: '/admin/info-pages',
        permission: 'info_pages:read',
      },
      {
        name: 'admin.nav.legalPages',
        icon: 'file-text',
        to: '/admin/legal-pages',
        permission: 'info_pages:read',
      },
      {
        name: 'admin.nav.updates',
        icon: 'refresh',
        to: '/admin/updates',
        permission: 'updates:read',
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'admin.groups.security',
    accent: 'rgb(var(--color-error-400))',
    gradient: 'linear-gradient(135deg, rgb(var(--color-error-400)), rgb(var(--color-accent-600)))',
    items: [
      { name: 'admin.nav.roles', icon: 'shield', to: '/admin/roles', permission: 'roles:read' },
      {
        name: 'admin.nav.roleAssign',
        icon: 'user-check',
        to: '/admin/roles/assign',
        permission: 'roles:assign',
      },
      { name: 'admin.nav.policies', icon: 'lock', to: '/admin/policies', permission: 'roles:read' },
      {
        name: 'admin.nav.auditLog',
        icon: 'scroll',
        to: '/admin/audit-log',
        permission: 'audit_log:read',
      },
      {
        name: 'admin.nav.systemErrors',
        icon: 'shield',
        to: '/admin/system-errors',
        permission: 'system_errors:read',
      },
    ],
  },
];

// ─── Helpers ───

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Animated Stat Number ───

function AnimatedStat({ value, suffix }: { value: number; suffix?: string }) {
  const animated = useAnimatedNumber(value);
  return (
    <span>
      {Math.round(animated).toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Stats Bar ───

interface StatsBarProps {
  systemInfo: SystemInfo | null;
  dashboardStats: DashboardStats | null;
  loading: boolean;
}

const StatsBar = memo(function StatsBar({ systemInfo, dashboardStats, loading }: StatsBarProps) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const uptime = systemInfo?.uptime_seconds ?? 0;
    const trial = dashboardStats?.subscriptions.trial ?? 0;
    const paid = dashboardStats?.subscriptions.paid ?? 0;
    const purchasedToday = dashboardStats?.subscriptions.purchased_today ?? 0;

    return [
      {
        icon: <StatUptimeIcon className="h-5 w-5" />,
        label: t('admin.panel.statsUptime'),
        value: uptime > 0 ? formatUptime(uptime) : '--',
        colorClass: 'text-success-400 bg-success-400/10 border-success-400/25',
      },
      {
        icon: <StatBotIcon className="h-5 w-5" />,
        label: t('admin.panel.statsBot'),
        value: systemInfo?.bot_version ?? '--',
        colorClass: 'text-accent-400 bg-accent-400/10 border-accent-400/25',
      },
      {
        icon: <StatCabinetIcon className="h-5 w-5" />,
        label: t('admin.panel.statsCabinet'),
        value: `v${CABINET_VERSION}`,
        colorClass: 'text-accent-300 bg-accent-300/10 border-accent-300/25',
      },
      {
        icon: <StatTrialIcon className="h-5 w-5" />,
        label: t('admin.panel.statsTrials'),
        numericValue: trial,
        colorClass: 'text-warning-400 bg-warning-400/10 border-warning-400/25',
      },
      {
        icon: <StatPaidIcon className="h-5 w-5" />,
        label: t('admin.panel.statsPaid'),
        numericValue: paid,
        delta: purchasedToday > 0 ? `+${purchasedToday}` : undefined,
        colorClass: 'text-error-300 bg-error-300/10 border-error-300/25',
      },
    ];
  }, [systemInfo, dashboardStats, t]);

  return (
    <div className="grid w-full grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-3.5">
      {stats.map((s, i) => (
        <div
          key={i}
          className={cn(
            'flex min-w-0 items-center gap-3 rounded-2xl border border-dark-700/60 bg-dark-900/70 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:gap-3.5 sm:p-4',
            'light:border-champagne-300/50 light:bg-champagne-100/60',
            i === 4 && 'col-span-2 lg:col-span-1',
            loading && 'animate-pulse',
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11',
              s.colorClass,
            )}
          >
            {s.icon}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[11px] font-bold uppercase tracking-wider text-dark-400 light:text-champagne-600">
              {s.label}
              {s.delta && ` · ${t('admin.panel.statsToday')}`}
            </span>
            <span className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-dark-50 light:text-champagne-900 sm:text-2xl">
              {'numericValue' in s && s.numericValue !== undefined ? (
                <AnimatedStat value={s.numericValue} />
              ) : (
                <span className="truncate">{s.value}</span>
              )}
              {s.delta && (
                <span className="shrink-0 rounded-full border border-success-400/25 bg-success-400/10 px-2 py-0.5 text-xs font-bold text-success-400">
                  {s.delta}
                </span>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Attention strip ───

interface AttentionItem {
  key: string;
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: string;
  tone: 'accent' | 'pink';
}

function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:gap-3.5">
      {items.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className={cn(
            'group flex min-w-0 items-center gap-3.5 rounded-2xl border p-3.5 transition-colors sm:p-4',
            it.tone === 'accent'
              ? 'border-accent-500/30 bg-gradient-to-r from-accent-500/15 to-transparent hover:border-accent-400/50'
              : 'border-error-300/30 bg-gradient-to-r from-error-300/15 to-transparent hover:border-error-300/50',
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5',
              it.tone === 'accent'
                ? 'bg-accent-500/20 text-accent-300'
                : 'bg-error-300/20 text-error-300',
            )}
          >
            {it.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-dark-50 light:text-champagne-900">
              {it.title}
            </div>
            <div className="truncate text-xs text-dark-400 light:text-champagne-600">
              {it.subtitle}
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-on-accent',
              it.tone === 'accent' ? 'bg-accent-500' : 'bg-error-400',
            )}
          >
            {it.action}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ─── Section card ───

interface GlassCardProps {
  section: AdminSection;
  index: number;
  searchTerm: string;
  badges: Record<string, number>;
}

const COLLAPSED_LIMIT = 6;

const GlassCard = memo(function GlassCard({ section, index, searchTerm, badges }: GlassCardProps) {
  const { t } = useTranslation();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const [expanded, setExpanded] = useState(false);
  void index;

  const visibleItems = useMemo(
    () =>
      section.items.filter((item) => {
        if (!hasPermission(item.permission)) return false;
        if (!searchTerm) return true;
        return t(item.name).toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [section.items, hasPermission, searchTerm, t],
  );

  const highlightMatch = useCallback(
    (text: string) => {
      if (!searchTerm) return text;
      const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
      if (idx === -1) return text;
      return (
        <>
          {text.slice(0, idx)}
          <mark className="rounded-sm bg-accent-400/30 px-0.5 text-dark-100 light:text-champagne-900">
            {text.slice(idx, idx + searchTerm.length)}
          </mark>
          {text.slice(idx + searchTerm.length)}
        </>
      );
    },
    [searchTerm],
  );

  if (visibleItems.length === 0) return null;

  // При поиске показываем всё найденное, без сворачивания.
  const collapsible = !searchTerm && visibleItems.length > COLLAPSED_LIMIT + 1;
  const shown = collapsible && !expanded ? visibleItems.slice(0, COLLAPSED_LIMIT) : visibleItems;
  const hiddenCount = visibleItems.length - shown.length;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-dark-700/60 bg-dark-900/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-colors duration-200 hover:border-dark-600/80 light:border-champagne-300/50 light:bg-champagne-100/40 light:hover:border-champagne-400/60">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] opacity-90"
        style={{ background: section.gradient }}
      />
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-dark-50 shadow-lg"
          style={{ background: section.gradient }}
        >
          <span aria-hidden="true">{visibleItems.length}</span>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight text-dark-50 light:text-champagne-900">
          {t(section.titleKey)}
        </h2>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-0.5 px-2.5 pb-2.5">
        {shown.map((item) => {
          const badge = badges[item.to];
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group/item flex min-h-[48px] items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition-colors duration-150 hover:border-dark-600/50 hover:bg-dark-700/30 light:hover:border-champagne-400/40 light:hover:bg-champagne-200/50"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-dark-700/50 bg-dark-800/60 transition-transform duration-150 group-hover/item:scale-105 light:border-champagne-400/30 light:bg-champagne-200/50 [&>svg]:h-[17px] [&>svg]:w-[17px]"
                style={{ color: section.accent }}
              >
                {icons[item.icon]}
              </div>
              <span className="flex-1 truncate text-sm font-semibold text-dark-100 transition-colors group-hover/item:text-dark-50 light:text-champagne-800 light:group-hover/item:text-champagne-950">
                {highlightMatch(t(item.name))}
              </span>
              {badge !== undefined && badge > 0 && (
                <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-accent-500 px-1.5 text-xs font-extrabold text-on-accent">
                  {badge}
                </span>
              )}
              <div className="h-4 w-4 shrink-0 text-dark-600 transition-all duration-150 group-hover/item:translate-x-0.5 group-hover/item:text-dark-300 [&>svg]:h-4 [&>svg]:w-4">
                {icons.chevron}
              </div>
            </Link>
          );
        })}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex h-11 w-full items-center justify-center border-t border-dark-700/50 text-[13px] font-bold text-dark-300 transition-colors hover:bg-dark-700/20 hover:text-dark-100 light:border-champagne-300/50 light:text-champagne-700"
        >
          {expanded ? t('admin.panel.showLess') : t('admin.panel.showMore', { count: hiddenCount })}
        </button>
      )}
    </section>
  );
});

// ─── Main Component ───

export default function AdminPanel() {
  const { t } = useTranslation();
  const { formatWithCurrency } = useCurrency();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { safeAreaInset, contentSafeAreaInset } = useTelegramSDK();

  const safeTop = Math.max(safeAreaInset.top, contentSafeAreaInset.top);
  const safeBottom = Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom);

  // System info + dashboard stats — polled every 60s via React Query.
  const systemInfoQuery = useQuery<SystemInfo>({
    queryKey: ['admin-panel-system-info'] as const,
    queryFn: () => statsApi.getSystemInfo(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const dashboardStatsQuery = useQuery<DashboardStats>({
    queryKey: ['admin-panel-dashboard-stats'] as const,
    queryFn: () => statsApi.getDashboardStats(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const canTickets = hasPermission('tickets:read');
  const canWithdrawals = hasPermission('withdrawals:read');
  // Счётчики «что ждёт админа». Ошибка любого запроса не должна ломать главную —
  // просто не показываем плашку.
  const ticketStatsQuery = useQuery({
    queryKey: ['admin-ticket-stats'] as const,
    queryFn: adminApi.getTicketStats,
    enabled: canTickets,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const withdrawalsQuery = useQuery({
    queryKey: ['admin-withdrawals', 'pending'] as const,
    queryFn: () => withdrawalApi.getAll({ status: 'pending', limit: 1 }),
    enabled: canWithdrawals,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const systemInfo = systemInfoQuery.data ?? null;
  const dashboardStats = dashboardStatsQuery.data ?? null;
  const loading = systemInfoQuery.isLoading || dashboardStatsQuery.isLoading;

  const ticketsWaiting = (ticketStatsQuery.data?.open ?? 0) + (ticketStatsQuery.data?.pending ?? 0);
  const withdrawalsPending = withdrawalsQuery.data?.pending_count ?? 0;
  const withdrawalsTotal = withdrawalsQuery.data?.pending_total_kopeks ?? 0;

  const badges = useMemo<Record<string, number>>(
    () => ({ '/admin/tickets': ticketsWaiting, '/admin/withdrawals': withdrawalsPending }),
    [ticketsWaiting, withdrawalsPending],
  );

  const attention = useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];
    if (canTickets && ticketsWaiting > 0) {
      list.push({
        key: 'tickets',
        to: '/admin/tickets',
        icon: <TicketIcon />,
        title: t('admin.panel.attentionTickets', { count: ticketsWaiting }),
        subtitle: t('admin.panel.attentionTicketsHint'),
        action: t('admin.panel.attentionOpen'),
        tone: 'accent',
      });
    }
    if (canWithdrawals && withdrawalsPending > 0) {
      list.push({
        key: 'withdrawals',
        to: '/admin/withdrawals',
        icon: <ArrowUpIcon />,
        title: t('admin.panel.attentionWithdrawals', { count: withdrawalsPending }),
        subtitle: t('admin.panel.attentionWithdrawalsHint', {
          amount: formatWithCurrency(withdrawalsTotal / 100),
        }),
        action: t('admin.panel.attentionReview'),
        tone: 'pink',
      });
    }
    return list;
  }, [
    canTickets,
    canWithdrawals,
    ticketsWaiting,
    withdrawalsPending,
    withdrawalsTotal,
    formatWithCurrency,
    t,
  ]);

  // Keyboard shortcuts: Cmd+K to focus search, Escape to clear
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearch('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Track which sections have matching items (keeps original section refs for memo stability)
  const visibleSectionIds = useMemo(() => {
    if (!search.trim()) return null; // null = show all
    const lower = search.toLowerCase();
    return new Set(
      sections
        .filter((s) => s.items.some((item) => t(item.name).toLowerCase().includes(lower)))
        .map((s) => s.id),
    );
  }, [search, t]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-0 sm:px-2"
        style={{
          paddingTop: safeTop > 0 ? `${safeTop}px` : 'env(safe-area-inset-top, 0px)',
          paddingBottom: safeBottom > 0 ? `${safeBottom}px` : 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Hero + Search */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-dark-50 light:text-champagne-900 sm:text-3xl">
            {t('admin.panel.title')}
          </h1>
          <div className="flex items-center gap-2 rounded-full border border-success-400/30 bg-success-400/10 px-3 py-1 text-xs font-bold text-success-400">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-success-400"
              style={{ animation: 'adminPulse 2s ease-in-out infinite' }}
            />
            {t('admin.panel.statsOnline')}
          </div>
          {/* Search */}
          <div className="relative w-full min-w-[160px] sm:ml-auto sm:max-w-[340px] sm:flex-1">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500 [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icons.search}
            </div>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.panel.searchPlaceholder')}
              aria-label={t('admin.panel.searchPlaceholder')}
              className="h-11 w-full rounded-2xl border border-dark-700/60 bg-dark-900/70 pl-10 pr-20 font-sans text-sm text-dark-100 outline-none transition-all placeholder:text-dark-500 focus:border-accent-500/50 focus:shadow-[0_0_0_3px_rgba(var(--color-accent-500),0.12)] light:border-champagne-300/50 light:bg-champagne-100/60 light:text-champagne-900 light:placeholder:text-champagne-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label={t('admin.panel.searchClear')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 transition-colors hover:text-dark-300 sm:right-16 [&>svg]:h-4 [&>svg]:w-4"
              >
                {icons.x}
              </button>
            )}
            <kbd
              aria-hidden="true"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-dark-700/60 bg-dark-800/60 px-1.5 py-0.5 font-mono text-2xs text-dark-400 sm:block"
            >
              {IS_MAC ? '⌘' : 'Ctrl+'}K
            </kbd>
          </div>
        </div>

        {/* Stats */}
        <StatsBar systemInfo={systemInfo} dashboardStats={dashboardStats} loading={loading} />

        {/* Что требует внимания */}
        {!search && <AttentionStrip items={attention} />}

        {/* Grid */}
        <div className="pb-4">
          {visibleSectionIds === null || visibleSectionIds.size > 0 ? (
            <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
              {sections
                .filter((s) => !visibleSectionIds || visibleSectionIds.has(s.id))
                .map((section, i) => (
                  <GlassCard
                    key={section.id}
                    section={section}
                    index={i}
                    searchTerm={search}
                    badges={badges}
                  />
                ))}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-16"
              role="status"
              aria-live="polite"
            >
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-dark-700/50 bg-dark-800/40 text-dark-500 [&>svg]:h-6 [&>svg]:w-6">
                {icons.search}
              </div>
              <h3 className="text-sm font-semibold text-dark-200 light:text-champagne-800">
                {t('admin.panel.searchEmpty')}
              </h3>
              <p className="text-xs text-dark-500 light:text-champagne-600">
                {t('admin.panel.searchEmptyHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
