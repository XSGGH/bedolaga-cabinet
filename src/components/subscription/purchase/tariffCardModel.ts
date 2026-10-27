import type { Tariff } from '../../../types';

/**
 * Модель карточки тарифа: из описания и списка серверов, которые заводит
 * оператор в панели, собираем то, что показываем структурно — короткое
 * описание, строки трафика и список преимуществ.
 *
 * Серверы с отметкой 📡 расходуют лимит трафика, остальные — безлимитные.
 */

const METERED_MARK = '📡';

const FLAGS: Record<string, string> = {
  германия: '🇩🇪',
  нидерланды: '🇳🇱',
  швеция: '🇸🇪',
  польша: '🇵🇱',
  эстония: '🇪🇪',
  финляндия: '🇫🇮',
  россия: '🇷🇺',
  казахстан: '🇰🇿',
  латвия: '🇱🇻',
  литва: '🇱🇹',
  франция: '🇫🇷',
  сша: '🇺🇸',
  турция: '🇹🇷',
  армения: '🇦🇲',
  грузия: '🇬🇪',
};

const STARTS_WITH_FLAG = /^\p{Regional_Indicator}{2}/u;
const LEADING_PICTOGRAPHS = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+/u;

export function isMeteredServer(name: string): boolean {
  return name.includes(METERED_MARK);
}

/** «[📡] Обход» → «📡 Обход»; страна без флага получает флаг по названию. */
export function displayServerName(rawName: string): string {
  const name = rawName
    .replace(/\[\s*📡\s*\]/g, METERED_MARK)
    .replace(/\s+/g, ' ')
    .trim();
  if (isMeteredServer(name) || STARTS_WITH_FLAG.test(name)) return name;
  const flag = FLAGS[name.toLowerCase()];
  return flag ? `${flag} ${name}` : name;
}

export interface TariffFeature {
  text: string;
  /** Предупреждение («не будет работать …») — выделяем цветом. */
  warn: boolean;
}

export interface TariffDescription {
  tagline: string | null;
  features: TariffFeature[];
}

/**
 * Описание в панели — свободный текст: первая строка — суть тарифа, дальше
 * строки-преимущества, в конце блок «Доступные локации:» со списком серверов.
 * Список серверов и строки про безлимит выкидываем: они показаны отдельно.
 */
export function parseTariffDescription(description: string | null | undefined): TariffDescription {
  const lines = (description ?? '').split(/\r?\n/).map((line) => line.trim());
  const locationsAt = lines.findIndex((line) => /^доступные\s+локации/i.test(line));
  const body = (locationsAt >= 0 ? lines.slice(0, locationsAt) : lines).filter(Boolean);
  if (body.length === 0) return { tagline: null, features: [] };

  const clean = (line: string) => line.replace(LEADING_PICTOGRAPHS, '').trim();
  const [first, ...rest] = body;
  const features: TariffFeature[] = [];
  for (const line of rest) {
    const text = clean(line);
    if (!text || /безлимит/i.test(text)) continue;
    features.push({
      text,
      warn: /^[⚠⛔❌🚫]/u.test(line) || /не\s+(будет\s+работать|работает)/i.test(text),
    });
  }
  return { tagline: clean(first ?? '') || null, features };
}

export interface TariffTrafficModel {
  /** Серверы без расхода трафика. */
  unlimitedServers: string[];
  /** Подпись безлимитной строки: на всех серверах / на обычных. */
  unlimitedScope: 'all' | 'regular' | null;
  /** Серверы 📡 (или все серверы, если лимит один на всех). */
  limitedServers: string[];
  /** Лимит действует только на 📡 (иначе — на все серверы). */
  limitedOnlyMetered: boolean;
  hasLimit: boolean;
}

export function buildTrafficModel(tariff: Tariff): TariffTrafficModel {
  const servers = (tariff.servers ?? []).map((s) => displayServerName(s.name));
  const metered = servers.filter(isMeteredServer);
  const regular = servers.filter((name) => !isMeteredServer(name));
  const hasLimit = !tariff.is_unlimited_traffic && tariff.traffic_limit_gb > 0;

  if (!hasLimit) {
    return {
      unlimitedServers: servers,
      unlimitedScope: 'all',
      limitedServers: [],
      limitedOnlyMetered: false,
      hasLimit: false,
    };
  }
  if (metered.length > 0) {
    return {
      unlimitedServers: regular,
      unlimitedScope: regular.length > 0 ? 'regular' : null,
      limitedServers: metered,
      limitedOnlyMetered: true,
      hasLimit: true,
    };
  }
  return {
    unlimitedServers: [],
    unlimitedScope: null,
    limitedServers: servers,
    limitedOnlyMetered: false,
    hasLimit: true,
  };
}

/** Есть ли 📡-серверы хотя бы у одного тарифа из списка. */
export function anyTariffHasMetered(tariffs: Tariff[]): boolean {
  return tariffs.some((tariff) => (tariff.servers ?? []).some((s) => isMeteredServer(s.name)));
}
