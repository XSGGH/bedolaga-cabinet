import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

const STATUS_URL = String(
  import.meta.env.VITE_STATUS_API_URL || 'https://uptime.xsgvpn.ru/api/public',
).trim();
const STATUS_PAGE = STATUS_URL.replace(/\/api\/public$/, '/');

interface PublicServer {
  name: string;
  cc?: string;
  online: boolean;
  maintenance?: boolean;
  uptime30: number | null;
  load: number[];
  loadNow?: number;
}

interface PublicStatus {
  ok: boolean;
  status: 'ok' | 'degraded' | 'down';
  online: number;
  total: number;
  uptime30: number | null;
  load: { now: number; series: number[] };
  servers: PublicServer[];
}

async function fetchStatus(): Promise<PublicStatus> {
  const res = await fetch(STATUS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
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

/**
 * Блок «Статус серверов» на главной: общий статус, общая нагрузка за сутки и
 * по каждой локации — онлайн/недоступен, аптайм за 30 дней и мини-график.
 * Данные приходят с сайта аптайма (публичный /api/public). Нет ответа —
 * блок просто не показывается, главная не страдает.
 */
export default function ServerStatus() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['server-status'],
    queryFn: fetchStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  if (!data?.ok || !data.servers?.length) return null;

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

      <div className="grid gap-3 rounded-2xl border border-[var(--xsg-line)] bg-dark-900/60 p-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-7 sm:px-5">
        <div className="flex items-baseline justify-between sm:block">
          <div className="xsg-eyebrow">{t('dashboard.serverStatus.load', 'Общая нагрузка')}</div>
          <div className="sm:mt-2">
            <span className="text-[26px] font-extrabold tabular-nums text-dark-50 sm:text-[32px]">
              {data.load.now}
            </span>
            <span className="ml-0.5 text-sm text-dark-400">%</span>
            <div className="mt-0.5 hidden text-xs text-dark-400 sm:block">
              {t('dashboard.serverStatus.last24h', 'за последние 24 часа')}
            </div>
          </div>
        </div>
        <Spark
          values={data.load.series}
          color="rgb(var(--color-accent-500))"
          height={64}
          label={t('dashboard.serverStatus.loadChart', 'График общей нагрузки за 24 часа')}
          area
          id="srv-load-area"
        />
      </div>

      <div className="grid gap-0 lg:grid-cols-5 lg:gap-3">
        {data.servers.map((s) => {
          const color = s.maintenance ? AMBER : s.online ? GREEN : RED;
          const label = s.maintenance
            ? t('dashboard.serverStatus.maintenance', 'работы')
            : s.online
              ? t('dashboard.serverStatus.online', 'онлайн')
              : t('dashboard.serverStatus.offline', 'недоступен');
          return (
            <div
              key={s.name}
              className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 border-t border-[var(--xsg-line)] py-3 lg:grid-cols-1 lg:gap-2.5 lg:rounded-[14px] lg:border lg:bg-dark-900/60 lg:p-4"
            >
              <div className="flex min-w-0 flex-col gap-1 lg:gap-2.5">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <b className="truncate text-sm text-dark-50">{s.name}</b>
                </span>
                <span className="flex flex-wrap items-center justify-between gap-x-2 pl-4 text-xs text-dark-300 lg:pl-0">
                  <span className="font-semibold" style={{ color }}>
                    {label}
                  </span>
                  {s.uptime30 != null && (
                    <span className="tabular-nums">
                      {s.uptime30.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} %
                    </span>
                  )}
                </span>
              </div>
              <Spark
                values={s.load}
                color={s.online ? 'rgb(var(--color-accent-500))' : RED}
                height={30}
                label={`${t('dashboard.serverStatus.loadOf', 'Нагрузка')}: ${s.name}`}
                id={`srv-${s.name}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
