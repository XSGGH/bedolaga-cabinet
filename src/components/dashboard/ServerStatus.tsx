import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MobileCoverage from './MobileCoverage';
import { ChevronDownIcon } from '@/components/icons';
import { fetchStatus, fetchStatusEvents, fetchStatusSummary } from '@/api/serverStatus';
import { normalizeStatus, statePresentation, statusTimeline } from './serverStatusModel';
export { fetchStatus } from '@/api/serverStatus';

// Same-origin server proxy. The Uptime API key must never be sent by the browser.
const STATUS_PAGE = 'https://uptime.xsgvpn.ru/';

/**
 * Точки ряда → координаты в viewBox (w×h). Масштаб — по диапазону самого ряда
 * (не 0–100 %), иначе спокойная нагрузка рисуется ровной линией; минимальный
 * размах 20 п.п., чтобы шум не превращался в «горы». Одна точка — линия.
 */
function toPoints(values: number[], w: number, h: number, pad = 3): string {
  const v = values.length === 1 ? [values[0], values[0]] : values;
  if (v.length === 0) return '';
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = Math.max(20, hi - lo);
  const base = Math.max(0, Math.min(lo, 100 - span));
  return v
    .map((y, i) => {
      const x = (i / (v.length - 1)) * w;
      const yy = h - pad - ((y - base) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${yy.toFixed(1)}`;
    })
    .join(' ');
}

function Spark({
  values,
  color,
  height,
  label,
  area = false,
  id,
}: {
  values: number[];
  color: string;
  height: number;
  label: string;
  area?: boolean;
  id: string;
}) {
  const w = 240;
  const pts = toPoints(values, w, height);
  if (!pts) return <div style={{ height }} aria-hidden="true" />;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.35" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${pts} ${w},${height} 0,${height}`} fill={`url(#${id})`} />
        </>
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Часовая подпись «HH:00» для момента `hoursAgo` часов назад. */
function hourLabel(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 3600_000);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

/**
 * Блок «Статус серверов»: доступность направлений и результаты мобильных проверок.
 * Общий график реальной нагрузки за сутки доступен в подробностях.
 * Nginx кабинета получает /api/public с серверным ключом и кэширует на 30 секунд.
 * Ошибка обновления не оставляет на экране старую зелёную сводку.
 */
export default function ServerStatus() {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data, isError, isLoading } = useQuery({
    queryKey: ['server-status'],
    queryFn: ({ signal }) => fetchStatus(signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  const { data: summary, isError: summaryError } = useQuery({
    queryKey: ['server-status-summary'],
    queryFn: ({ signal }) => fetchStatusSummary(signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  const { data: events, isError: eventsError } = useQuery({
    queryKey: ['server-status-events'],
    queryFn: ({ signal }) => fetchStatusEvents(signal),
    enabled: detailsOpen,
    staleTime: 30_000,
    retry: false,
  });

  if (isError) {
    return (
      <section
        aria-label="Статус серверов"
        className="rounded-[20px] border border-[var(--xsg-line)] bg-dark-800 p-4 text-sm text-dark-300 sm:p-6"
      >
        <span className="font-semibold text-dark-100">Статус серверов</span>
        <p className="mt-1 text-xs text-dark-400">
          Не удалось обновить мониторинг. Попробуем снова через минуту.
        </p>
        <a
          href={STATUS_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-accent-300"
        >
          Открыть мониторинг ›
        </a>
      </section>
    );
  }
  if (!data?.ok || !data.servers?.length)
    return (
      <section
        aria-label="Статус серверов"
        className="rounded-[20px] border border-[var(--xsg-line)] bg-dark-800 p-4 text-sm text-dark-300"
        role="status"
      >
        {isLoading ? 'Проверяем состояние серверов…' : 'Нет данных о серверах'}
      </section>
    );
  const mobile = data.mobile ?? data.servers.find((server) => server.mobile)?.mobile;
  const model = normalizeStatus(data, summaryError ? undefined : summary, summaryError);
  const visibleServers = detailsOpen
    ? model.servers
    : model.servers.filter((s) => s.state !== 'up');
  const timeline = eventsError || !events ? [] : statusTimeline(events);
  const chip = { color: model.color, text: model.headline };
  return (
    <section
      aria-label={t('dashboard.serverStatus.title', 'Статус серверов')}
      className="xsg-server-status space-y-3 rounded-[20px] border border-[var(--xsg-line)] bg-dark-800 p-4 sm:p-5"
    >
      <div className="xsg-server-status-heading flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-dark-100">
          {t('dashboard.serverStatus.title', 'Статус серверов')}
        </h2>
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="server-status-details"
          onClick={() => setDetailsOpen((current) => !current)}
          className="flex min-h-11 shrink-0 items-center text-xs font-medium text-accent-300 hover:text-accent-200"
        >
          {detailsOpen
            ? t('common.hide', 'Свернуть')
            : t('dashboard.serverStatus.more', 'Подробнее')}
          <ChevronDownIcon
            className={`ml-1 h-3.5 w-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <p
        className="xsg-server-status-summary flex items-center gap-2 text-sm font-medium"
        style={{ color: chip.color }}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
        {chip.text}
      </p>
      <p className="xsg-server-status-count text-xs text-dark-400">{model.description}</p>
      <div
        id="server-status-details"
        hidden={visibleServers.length === 0}
        className="divide-y divide-divider"
      >
        {visibleServers.map((s) => {
          const state = statePresentation[s.state];
          return (
            <div
              key={s.name}
              data-server-state={s.state}
              className="flex min-h-10 min-w-0 items-center justify-between gap-3 py-2"
            >
              <p className="break-words text-xs font-semibold leading-relaxed text-dark-100 [overflow-wrap:anywhere]">
                {s.mobile ? s.name.replace(/^\[📡\]\s*/, '') : s.name}
                {detailsOpen && s.state === 'maintenance' && !!s.maintTo && s.maintTo > 0 && (
                  <span className="mt-1 block font-normal text-dark-400">
                    Плановое завершение: {new Date(s.maintTo * 1000).toLocaleString('ru-RU')}
                  </span>
                )}
              </p>
              <span className="shrink-0 text-xs" style={{ color: state.color }} title={state.label}>
                {s.state === 'up' ? (
                  <>
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">{state.label}</span>
                  </>
                ) : (
                  state.label
                )}
              </span>
            </div>
          );
        })}
      </div>
      {mobile && <MobileCoverage mobile={mobile} progress={data.mobileNodes} />}
      <details hidden={!detailsOpen} className="group/occupancy border-t border-[var(--xsg-line)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-xs text-dark-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 [&::-webkit-details-marker]:hidden">
          <span>Загруженность серверов</span>
          <span className="flex items-center gap-2 tabular-nums">
            {Number.isFinite(data.load.now) ? `${data.load.now}%` : '—'}
            <ChevronDownIcon className="h-4 w-4 transition-transform group-open/occupancy:rotate-180" />
          </span>
        </summary>
        <div className="pb-2">
          <p className="mb-2 text-xs text-dark-400">Изменение за сутки</p>
          <Spark
            values={data.load.series}
            color="rgb(var(--color-accent-500))"
            height={40}
            label={t('dashboard.serverStatus.loadChart', 'График общей нагрузки за 24 часа')}
            area
            id="srv-load-area"
          />
          <div className="mt-1 flex justify-between text-[10px] text-dark-400">
            <span>{hourLabel(24)}</span>
            <span>{t('dashboard.serverStatus.now', 'сейчас')}</span>
          </div>
        </div>
      </details>
      {detailsOpen && (
        <div className="xsg-status-history space-y-2 border-t border-divider pt-3">
          <h3 className="text-sm font-semibold text-dark-100">Что происходило</h3>
          {eventsError ? (
            <p className="text-xs text-dark-400">Не удалось загрузить события мониторинга.</p>
          ) : !events ? (
            <p className="text-xs text-dark-400">Загружаем события…</p>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-dark-400">В доступной истории нет событий.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((event) => (
                <li key={event.at + event.label + event.title} className="text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong style={{ color: statePresentation[event.state].color }}>
                      {event.label}
                    </strong>
                    <time
                      className="text-dark-400"
                      dateTime={new Date(event.at * 1000).toISOString()}
                    >
                      {new Date(event.at * 1000).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  <p className="mt-1 text-dark-200">{event.title}</p>
                  {event.detail && <p className="mt-1 text-dark-400">{event.detail}</p>}
                </li>
              ))}
            </ol>
          )}
          {!!data.updated && (
            <p className="text-xs text-dark-400">
              Последний замер: {new Date(data.updated * 1000).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
      )}
      {detailsOpen && (
        <a
          href={STATUS_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center text-xs font-medium text-accent-300"
        >
          Открыть мониторинг ›
        </a>
      )}
    </section>
  );
}
