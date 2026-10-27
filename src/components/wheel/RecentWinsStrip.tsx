import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { wheelApi, type RecentWin } from '../../api/wheel';
import { prizeTypeColor } from './wheelFaceModel';

const REFRESH_MS = 20_000;
/** Сколько последних выигрышей показываем. */
const WINS_SHOWN = 6;
/** На телефоне сначала показываем только столько, остальные — по кнопке. */
const WINS_COLLAPSED = 2;

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

function WinCard({
  win,
  t,
  hiddenOnMobile,
}: {
  win: RecentWin;
  t: Parameters<typeof timeAgo>[1];
  hiddenOnMobile: boolean;
}) {
  const color = prizeTypeColor(win.prize_type);
  return (
    <div
      className={`min-w-0 items-center gap-3 rounded-2xl border border-dark-700 bg-dark-900/80 p-3 ${hiddenOnMobile ? 'hidden sm:flex' : 'flex'}`}
      style={{ boxShadow: `inset 0 -2px 0 ${color}55` }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ backgroundColor: `${color}1f` }}
      >
        {win.emoji}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-sm font-bold leading-tight text-dark-50">
          {win.prize_display_name}
        </div>
        <div className="mt-0.5 text-xs text-dark-500">{timeAgo(win.created_at, t)}</div>
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
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ['wheel-recent-wins'],
    queryFn: () => wheelApi.getRecentWins(WINS_SHOWN),
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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {data.slice(0, WINS_SHOWN).map((win, i) => (
          <WinCard key={win.id} win={win} t={t} hiddenOnMobile={!expanded && i >= WINS_COLLAPSED} />
        ))}
      </div>
      {Math.min(data.length, WINS_SHOWN) > WINS_COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-dark-700 bg-dark-900/60 py-2.5 text-[13px] font-bold text-accent-300 transition-colors hover:border-accent-500/40 sm:hidden"
        >
          {expanded
            ? t('wheel.showLess')
            : t('wheel.showMore', { count: Math.min(data.length, WINS_SHOWN) - WINS_COLLAPSED })}
        </button>
      )}
    </section>
  );
}
