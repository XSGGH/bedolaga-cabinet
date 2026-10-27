import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wheelApi, type RecentWin } from '../../api/wheel';
import { prizeTypeColor } from './wheelFaceModel';

const REFRESH_MS = 20_000;

function timeAgo(
  iso: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return t('notifications.justNow');
  if (diffMin < 60) return t('notifications.minutesAgo', { count: diffMin });
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  return t('notifications.daysAgo', { count: Math.floor(hours / 24) });
}

function WinCard({ win, t }: { win: RecentWin; t: Parameters<typeof timeAgo>[1] }) {
  const color = prizeTypeColor(win.prize_type);
  return (
    <div
      className="flex w-[168px] shrink-0 snap-start items-center gap-3 rounded-2xl border border-dark-700 bg-dark-900/80 p-3"
      style={{ boxShadow: `inset 0 -2px 0 ${color}55` }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ backgroundColor: `${color}1f` }}
      >
        {win.emoji}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-dark-50">{win.prize_display_name}</div>
        <div className="text-xs text-dark-500">{timeAgo(win.created_at, t)}</div>
      </div>
    </div>
  );
}

/**
 * Живая лента последних выигрышей всех игроков. Анонимная: сервер отдаёт только
 * приз и время. Нет данных или эндпоинт недоступен — блок не показываем.
 */
export default function RecentWinsStrip() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['wheel-recent-wins'],
    queryFn: () => wheelApi.getRecentWins(20),
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  if (!data || data.length === 0) return null;

  return (
    <section aria-label={t('wheel.recentWins')}>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-dark-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success-400" />
        </span>
        {t('wheel.recentWins')}
      </div>
      <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {data.map((win) => (
          <WinCard key={win.id} win={win} t={t} />
        ))}
      </div>
    </section>
  );
}
