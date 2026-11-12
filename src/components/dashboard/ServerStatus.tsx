import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import MobileCoverage from './MobileCoverage';
import type { MobileProgress, MobileStatus } from './mobileCoverageModel';

// Same-origin server proxy. The Uptime API key must never be sent by the browser.
const STATUS_URL = '/status-api/public';
const STATUS_PAGE = 'https://uptime.xsgvpn.ru/';

interface PublicServer {
  name: string;
  cc?: string;
  online: boolean;
  maintenance?: boolean;
  uptime30: number | null;
  load: number[];
  loadNow?: number;
  /** Итог проверки мобильного сервера из сетей операторов РФ (дополняет обычную доступность). */
  mobile?: MobileStatus;
}

interface PublicStatus {
  ok: boolean;
  status: 'ok' | 'degraded' | 'down';
  online: number;
  total: number;
  uptime30: number | null;
  load: { now: number; series: number[] };
  servers: PublicServer[];
  mobile?: MobileStatus;
  mobileNodes?: MobileProgress;
}

export async function fetchStatus(signal?: AbortSignal): Promise<PublicStatus> {
  const res = await fetch(STATUS_URL, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    signal,
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (!data?.ok || !Array.isArray(data.servers) || !Array.isArray(data.load?.series)) {
    throw new Error('Invalid status response');
  }
  return data;
}

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

const GREEN = 'rgb(var(--color-success-400))';
const RED = 'rgb(var(--color-critical-500))';
const AMBER = 'rgb(var(--color-warning-400))';

/** Часовая подпись «HH:00» для момента `hoursAgo` часов назад. */
function hourLabel(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 3600_000);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

/**
 * Блок «Статус серверов» на главной: общий статус, общая нагрузка за сутки и
 * по каждой локации — онлайн/недоступен, аптайм за 30 дней и мини-график.
 * Nginx кабинета получает /api/public с серверным ключом и кэширует на 30 секунд.
 * Ошибка обновления не оставляет на экране старую зелёную сводку.
 */
export default function ServerStatus() {
  const { t } = useTranslation();
  const { data, isError } = useQuery({
    queryKey: ['server-status'],
    queryFn: ({ signal }) => fetchStatus(signal),
    refetchInterval: 60_000,
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
  if (!data?.ok || !data.servers?.length) return null;
  const hasMobileCard = data.servers.some((server) => server.mobile);

  const chip =
    data.status === 'ok'
      ? { color: GREEN, text: t('dashboard.serverStatus.allOk', 'Все работают') }
      : data.status === 'down'
        ? { color: RED, text: t('dashboard.serverStatus.down', 'Сбой') }
        : { color: AMBER, text: t('dashboard.serverStatus.degraded', 'Есть проблемы') };

  return (
    <section
      aria-label={t('dashboard.serverStatus.title', 'Статус серверов')}
      className="flex flex-col gap-4 rounded-[20px] border border-[var(--xsg-line)] bg-dark-800 p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 className="text-base font-extrabold tracking-tight text-dark-50 sm:text-lg">
            {t('dashboard.serverStatus.title', 'Статус серверов')}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold"
            style={{
              color: chip.color,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${chip.color}`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.color }} />
            {chip.text}
          </span>
        </div>
        <a
          href={STATUS_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[13px] font-semibold text-accent-300 transition-colors hover:text-accent-200"
        >
          {t('dashboard.serverStatus.more', 'Подробнее')} &rsaquo;
        </a>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--xsg-line)] bg-dark-900/60 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-6 sm:px-5">
        <div className="flex items-baseline justify-between sm:block">
          <div className="xsg-eyebrow">{t('dashboard.serverStatus.load', 'Общая нагрузка')}</div>
          <div className="sm:mt-1.5">
            <span className="text-[26px] font-extrabold tabular-nums text-dark-50 sm:text-[30px]">
              {data.load.now}
            </span>
            <span className="ml-0.5 text-sm text-dark-400">%</span>
          </div>
        </div>
        <div>
          <Spark
            values={data.load.series}
            color="rgb(var(--color-accent-500))"
            height={60}
            label={t('dashboard.serverStatus.loadChart', 'График общей нагрузки за 24 часа')}
            area
            id="srv-load-area"
          />
          <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-dark-500">
            <span>{hourLabel(24)}</span>
            <span>{hourLabel(18)}</span>
            <span>{hourLabel(12)}</span>
            <span>{hourLabel(6)}</span>
            <span>{t('dashboard.serverStatus.now', 'сейчас')}</span>
          </div>
        </div>
      </div>

      {!hasMobileCard && data.mobile && (
        <MobileCoverage mobile={data.mobile} progress={data.mobileNodes} />
      )}

      <div className="grid gap-0 lg:grid-cols-4 lg:gap-3 xl:grid-cols-4">
        {data.servers.map((s) => {
          const color = s.maintenance ? AMBER : s.online ? GREEN : RED;
          const state = s.maintenance
            ? t('dashboard.serverStatus.maintenance', 'работы')
            : s.online
              ? t('dashboard.serverStatus.online', 'онлайн')
              : t('dashboard.serverStatus.offline', 'недоступен');
          return (
            <div
              key={s.name}
              className={`grid grid-cols-[minmax(0,1fr)_92px] content-start items-center gap-3 border-t border-[var(--xsg-line)] py-2.5 lg:gap-2 lg:rounded-[14px] lg:border lg:bg-dark-900/60 lg:px-3.5 lg:py-3 ${s.mobile ? 'lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_120px]' : 'lg:grid-cols-1'}`}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                    title={state}
                    role="img"
                    aria-label={state}
                  />
                  <b className="truncate text-sm text-dark-50">{s.name}</b>
                </span>
              </div>
              <div>
                <Spark
                  values={s.load}
                  color={s.online ? 'rgb(var(--color-accent-500))' : RED}
                  height={28}
                  label={`${t('dashboard.serverStatus.loadOf', 'Нагрузка')}: ${s.name}`}
                  id={`srv-${s.name}`}
                />
                <div className="mt-0.5 flex justify-between text-[9.5px] tabular-nums text-dark-500">
                  <span>{hourLabel(24)}</span>
                  <span>{t('dashboard.serverStatus.now', 'сейчас')}</span>
                </div>
              </div>
              {s.mobile && (
                <div className="col-span-2">
                  <MobileCoverage mobile={s.mobile} progress={data.mobileNodes} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
