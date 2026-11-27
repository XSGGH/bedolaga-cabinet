/** /api/public contract: a direction is one district/operator pair, not a subscriber. */
export interface MobileDirection {
  region: string;
  operator: string;
  status: string;
  at?: number;
}

export interface MobileStatus {
  ok: number;
  total: number;
  at?: number;
  last_completed?: number;
  unknown?: number;
  stale?: number;
  whitelist_off?: number;
  no_modem?: number;
  modem_unavailable?: number;
  ops?: { op: string; ok: number; total: number }[];
  districts?: MobileDirection[];
}

export interface MobileProgress {
  checking?: boolean;
  pending?: boolean;
  running?: boolean;
  last_completed?: number;
  districts?: MobileDirection[];
}

export const DISTRICTS: Record<string, string> = {
  cfo: 'ЦФО',
  pfo: 'ПФО',
  sfo: 'СФО',
  urfo: 'УФО',
  yufo: 'ЮФО',
};
export const DISTRICT_NAMES: Record<string, string> = {
  cfo: 'Центральный федеральный округ',
  pfo: 'Приволжский федеральный округ',
  sfo: 'Сибирский федеральный округ',
  urfo: 'Уральский федеральный округ',
  yufo: 'Южный федеральный округ',
};

export const OPERATORS: Record<string, string> = {
  mts: 'МТС',
  megafon: 'МегаФон',
  beeline: 'Билайн',
  t2: 'T2',
};

export const DIRECTION_STATES: Record<string, { label: string; symbol: string; color: string }> = {
  up: { label: 'VPN работает', symbol: '✓', color: 'text-success-400' },
  down: { label: 'Не удалось подключиться', symbol: '×', color: 'text-critical-500' },
  no_bs: { label: 'Не требуется: белые списки отключены', symbol: '—', color: 'text-dark-300' },
  no_modem: { label: 'Нет результата проверки', symbol: '?', color: 'text-dark-300' },
  modem_unavailable: {
    label: 'Проверка временно недоступна',
    symbol: '?',
    color: 'text-dark-400',
  },
  unknown: { label: 'Нет подтверждённого результата', symbol: '?', color: 'text-dark-300' },
  stale: { label: 'Результат устарел', symbol: '◷', color: 'text-warning-400' },
};

function count(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function coverageModel(mobile: MobileStatus, progress?: MobileProgress) {
  // Prefer detailed results. A newer entry wins if the upstream ever returns duplicates.
  const pairs = new Map<string, MobileDirection>();
  for (const row of mobile.districts ?? progress?.districts ?? []) {
    if (!row.region || !row.operator) continue;
    const key = `${row.region}:${row.operator}`;
    const previous = pairs.get(key);
    if (previous && (previous.at ?? 0) > (row.at ?? 0)) continue;
    pairs.set(key, { ...row, status: DIRECTION_STATES[row.status] ? row.status : 'unknown' });
  }
  const directions = [...pairs.values()];
  const detailed = directions.length > 0;
  const up = detailed ? directions.filter((r) => r.status === 'up').length : count(mobile.ok);
  const total = detailed
    ? directions.filter((r) => r.status === 'up' || r.status === 'down').length
    : count(mobile.total);
  const stale = detailed
    ? directions.filter((r) => r.status === 'stale').length
    : count(mobile.stale);
  // no_modem and modem_unavailable are already included in unknown upstream.
  const untested = detailed
    ? directions.filter((r) => !['up', 'down', 'stale'].includes(r.status)).length
    : count(mobile.unknown) + count(mobile.whitelist_off);
  const notRequired = detailed
    ? directions.filter((r) => r.status === 'no_bs').length
    : count(mobile.whitelist_off);
  const noResult = Math.max(0, untested - notRequired);
  const regions = [...new Set(directions.map((r) => r.region))];
  const operators = [...new Set(directions.map((r) => r.operator))];
  const down = Math.max(0, total - up);
  const tone: 'neutral' | 'success' | 'critical' | 'warning' =
    down > 0
      ? up === 0
        ? 'critical'
        : 'warning'
      : total === 0 ||
          noResult > 0 ||
          stale > 0 ||
          progress?.checking ||
          progress?.pending ||
          progress?.running
        ? 'neutral'
        : 'success';

  return {
    directions,
    regions,
    operators,
    up: Math.min(up, total),
    total,
    down,
    stale,
    untested,
    notRequired,
    noResult,
    tone,
    at: mobile.last_completed || progress?.last_completed || mobile.at || 0,
    checking: Boolean(progress?.checking),
    pending: Boolean(progress?.pending || (progress?.running && !progress.checking)),
  };
}

/** Missing measurements never imply an active check. Only API progress flags do. */
export function coveragePresentation(model: ReturnType<typeof coverageModel>) {
  const counts = [
    model.total > 0
      ? `Завершено: ${model.total} · Успешно: ${model.up}`
      : 'Завершённых проверок нет',
    model.down > 0 ? `С ошибкой: ${model.down}` : '',
    model.noResult > 0 ? `Без результата: ${model.noResult}` : '',
    model.stale > 0 ? `Устарели: ${model.stale}` : '',
    model.notRequired > 0 ? `Не требуются: ${model.notRequired}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (model.down > 0) return { headline: 'Обнаружены проблемы с доступностью', caption: counts };
  if (model.checking || model.pending)
    return {
      headline: model.checking
        ? 'Проверка мобильных сетей продолжается'
        : 'Ожидаются результаты проверки',
      caption: counts,
    };
  if (model.noResult > 0 || model.stale > 0)
    return {
      headline: model.total > 0 ? 'Доступность подтверждена частично' : 'Нет свежих данных',
      caption: counts,
    };
  if (model.total > 0) return { headline: 'Мобильные сети работают штатно', caption: counts };
  return {
    headline: model.notRequired > 0 ? 'Проверка не требуется' : 'Нет свежих данных',
    caption: counts,
  };
}

export function checkTime(timestamp: number): string | null {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}

export function districtCount(value: number): string {
  const word = { one: 'округ', few: 'округа', many: 'округов', other: 'округов' };
  const form = new Intl.PluralRules('ru').select(value) as keyof typeof word;
  return `${value} ${word[form] || word.other}`;
}
