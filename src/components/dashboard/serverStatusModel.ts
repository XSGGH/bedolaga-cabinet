import type { MobileProgress, MobileStatus } from './mobileCoverageModel';

export type ServerState = 'up' | 'maintenance' | 'degraded' | 'down' | 'unknown';
export interface PublicServer {
  name: string;
  cc?: string;
  online?: boolean | null;
  maintenance?: boolean;
  uptime30?: number | null;
  load: number[];
  loadNow?: number;
  mobile?: MobileStatus;
}
export interface PublicStatus {
  ok: boolean;
  status: 'ok' | 'degraded' | 'down';
  updated?: number;
  online?: number;
  total?: number;
  load: { now: number; series: number[] };
  servers: PublicServer[];
  mobile?: MobileStatus;
  mobileNodes?: MobileProgress;
}
export interface SummaryServer {
  name: string;
  kind: string;
  online: boolean;
  maintenance: boolean;
  members?: number;
  membersOnline?: number;
  maintTo?: number;
}
export interface StatusSummary {
  monitoringDown?: boolean;
  servers: SummaryServer[];
}
export interface StatusEvent {
  k: string;
  t: string;
  p?: string;
  ts?: number;
  from?: number;
  to?: number;
  done?: boolean;
  tl?: unknown[];
}
export interface StatusEvents {
  now?: number;
  feed: StatusEvent[];
  history: StatusEvent[];
  mwin?: { name: string; from: number; to: number }[];
}

export const statePresentation: Record<ServerState, { label: string; color: string }> = {
  up: { label: 'Работает', color: 'rgb(var(--color-success-400))' },
  maintenance: { label: 'Технические работы', color: 'rgb(var(--color-warning-400))' },
  degraded: { label: 'Нестабильная работа', color: '#fb923c' },
  down: { label: 'Недоступен', color: 'rgb(var(--color-critical-500))' },
  unknown: { label: 'Нет данных', color: 'rgb(var(--color-dark-400))' },
};

/** Current availability only. Historical uptime and load never define health. */
export function normalizeStatus(
  data: PublicStatus,
  summary?: StatusSummary,
  detailsUnavailable = false,
) {
  const servers = data.servers.map((server) => {
    // Summary adds group health, but may be a different cache generation. Never
    // attach details from a contradictory availability/maintenance snapshot.
    const detail = summary?.servers.find(
      (s) =>
        s.kind === 'server' &&
        s.name === server.name &&
        s.online === server.online &&
        s.maintenance === (server.maintenance === true),
    );
    let state: ServerState = 'unknown';
    if (server.maintenance === true) state = 'maintenance';
    else if (summary?.monitoringDown) state = 'unknown';
    else if (server.online === false) state = 'down';
    else if (server.online === true) {
      state =
        detail &&
        Number.isInteger(detail.members) &&
        Number.isInteger(detail.membersOnline) &&
        (detail.membersOnline ?? 0) > 0 &&
        (detail.membersOnline ?? 0) < (detail.members ?? 0)
          ? 'degraded'
          : 'up';
    }
    return { ...server, state, maintTo: detail?.maintTo };
  });
  const counts = { up: 0, maintenance: 0, degraded: 0, down: 0, unknown: 0 };
  for (const server of servers) counts[server.state]++;
  const active = servers.length - counts.maintenance;
  // The aggregate also counts website checks; its degraded flag cannot mark
  // healthy VPN directions as unstable. A contradictory all-down flag stays
  // neutral. Missing measurements never produce an all-green summary.
  const state: ServerState = counts.down
    ? 'down'
    : counts.degraded
      ? 'degraded'
      : detailsUnavailable ||
          counts.unknown ||
          !servers.length ||
          (data.status === 'down' && active > 0)
        ? 'unknown'
        : counts.maintenance
          ? 'maintenance'
          : 'up';
  const headline =
    state === 'down'
      ? counts.down === servers.length
        ? 'Серверы недоступны'
        : 'Обнаружены проблемы'
      : state === 'degraded'
        ? 'Обнаружены проблемы'
        : state === 'maintenance'
          ? 'Проводятся технические работы'
          : state === 'unknown'
            ? 'Не удалось обновить статус серверов'
            : 'Все серверы работают штатно';
  const verb = (count: number, singular: string, plural: string) =>
    new Intl.PluralRules('ru').select(count) === 'one' ? singular : plural;
  const parts = [
    counts.up ? `${counts.up} ${verb(counts.up, 'работает', 'работают')}` : '',
    counts.maintenance ? `${counts.maintenance} на обслуживании` : '',
    counts.degraded
      ? `${counts.degraded} ${verb(counts.degraded, 'работает', 'работают')} нестабильно`
      : '',
    counts.down ? `${counts.down} ${verb(counts.down, 'недоступен', 'недоступны')}` : '',
    counts.unknown ? `${counts.unknown} без данных` : '',
  ].filter(Boolean);
  return {
    servers,
    counts,
    state,
    headline,
    color:
      statePresentation[state === 'down' && counts.down < servers.length ? 'degraded' : state]
        .color,
    description:
      state === 'up' ? `${counts.up} из ${servers.length} серверов доступны` : parts.join(' · '),
  };
}

/** Derive transitions only from typed events and their confirmed timestamps. */
export function statusTimeline(data: StatusEvents) {
  const rows: { at: number; label: string; title: string; detail?: string; state: ServerState }[] =
    [];
  const seen = new Set<string>();
  function add(at: number | undefined, label: string, e: StatusEvent, state: ServerState) {
    if (!at || !Number.isFinite(at)) return;
    const key = `${at}:${label}:${e.t}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ at, label, title: e.t, detail: e.p, state });
  }
  for (const e of [...data.feed, ...data.history]) {
    if (!e || typeof e.k !== 'string' || typeof e.t !== 'string') continue;
    if (e.done === true && Array.isArray(e.tl)) {
      add(e.from, 'Технические работы', e, 'maintenance');
      add(e.to, 'Обслуживание завершено', e, 'up');
    } else if (e.k === 'plan') {
      add(
        e.ts,
        (e.ts ?? 0) > (data.now ?? Date.now() / 1000)
          ? 'Запланированы работы'
          : 'Технические работы',
        e,
        'maintenance',
      );
    } else if (e.k === 'down' || e.k === 'warn') {
      add(e.from ?? e.ts, 'Нарушение доступности', e, e.k === 'down' ? 'down' : 'degraded');
      if (e.to && e.to <= (data.now ?? Date.now() / 1000))
        add(e.to, 'Работа восстановлена', e, 'up');
    } else if (e.k === 'mon') add(e.from ?? e.ts, 'Мониторинг был недоступен', e, 'unknown');
  }
  for (const m of data.mwin ?? [])
    add(m.from, 'Технические работы', { k: 'plan', t: m.name }, 'maintenance');
  return rows.sort((a, b) => b.at - a.at).slice(0, 8);
}
