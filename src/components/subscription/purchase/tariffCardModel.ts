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
  if (STARTS_WITH_FLAG.test(name)) return name.replace(/^(\p{Regional_Indicator}{2})\s*/u, '$1 ');
  if (isMeteredServer(name)) return name;
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
  /** Строки блока «Доступные локации:» (как их ввёл оператор). */
  locations: string[];
}

/**
 * Описание в панели — свободный текст: первая строка — суть тарифа, дальше
 * строки-преимущества, в конце блок «Доступные локации:» со списком серверов.
 * Список серверов и строки про безлимит выкидываем: они показаны отдельно.
 */
export function parseTariffDescription(
  description: string | null | undefined,
  options: { keepUnlimited?: boolean } = {},
): TariffDescription {
  const lines = (description ?? '').split(/\r?\n/).map((line) => line.trim());
  const locationsAt = lines.findIndex((line) => /^доступные\s+локации/i.test(line));
  const body = (locationsAt >= 0 ? lines.slice(0, locationsAt) : lines).filter(Boolean);
  const locations =
    locationsAt >= 0
      ? lines
          .slice(locationsAt + 1)
          .map((line) => line.replace(/^[-•·*\s]+/, '').trim())
          .filter(Boolean)
      : [];
  if (body.length === 0) return { tagline: null, features: [], locations };

  const clean = (line: string) => line.replace(LEADING_PICTOGRAPHS, '').trim();
  const [first, ...rest] = body;
  const features: TariffFeature[] = [];
  for (const line of rest) {
    const text = clean(line);
    if (!text || (!options.keepUnlimited && /безлимит/i.test(text))) continue;
    features.push({
      text,
      warn: /^[⚠⛔❌🚫]/u.test(line) || /не\s+(будет\s+работать|работает)/i.test(text),
    });
  }
  return { tagline: clean(first ?? '') || null, features, locations };
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

/**
 * Откуда брать локации. В панели у тарифа обычно один сквад («Hyperdrive»),
 * а страны перечислены в описании, поэтому блок «Доступные локации» главнее
 * списка серверов; список серверов — запасной вариант.
 */
export function tariffLocations(tariff: Tariff): string[] {
  const fromDescription = parseTariffDescription(tariff.description).locations;
  const raw =
    fromDescription.length > 0 ? fromDescription : (tariff.servers ?? []).map((s) => s.name);
  return raw.map(displayServerName);
}

export function buildTrafficModel(tariff: Tariff): TariffTrafficModel {
  const servers = tariffLocations(tariff);
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
  return tariffs.some((tariff) => tariffLocations(tariff).some(isMeteredServer));
}

// ──────────────────────────────────────────────────────────────────
// Редактируемая форма описания. Админка собирает описание из полей в
// формате, который читает parseTariffDescription, — оператору не нужно
// помнить разметку, а кабинет не зависит от свободного текста.
// ──────────────────────────────────────────────────────────────────

export const LOCATIONS_HEADING = 'Доступные локации:';

export interface TariffCardForm {
  tagline: string;
  features: { icon: string; text: string; warn: boolean }[];
  /** Строки локаций как в описании: «🇩🇪 Германия», «📡 Обход белых списков». */
  locations: string[];
}

const WARN_ICON = '⚠️';
const LEADING_ICON = /^((?:\p{Extended_Pictographic}|️|‍)+)\s*/u;

export function parseCardForm(description: string | null | undefined): TariffCardForm {
  const lines = (description ?? '').split(/\r?\n/).map((line) => line.trim());
  const locationsAt = lines.findIndex((line) => /^доступные\s+локации/i.test(line));
  const body = (locationsAt >= 0 ? lines.slice(0, locationsAt) : lines).filter(Boolean);
  const locations =
    locationsAt >= 0
      ? lines
          .slice(locationsAt + 1)
          .map((line) => line.replace(/^[-•·*\s]+/, '').trim())
          .filter(Boolean)
      : [];
  const [first, ...rest] = body;
  const features = rest.map((line) => {
    const match = LEADING_ICON.exec(line);
    const icon = match?.[1] ?? '';
    const text = line.slice(match?.[0].length ?? 0).trim();
    const warn = icon.startsWith('⚠') || /не\s+(будет\s+работать|работает)/i.test(text);
    return { icon, text, warn };
  });
  return { tagline: first ?? '', features, locations };
}

/** Собирает описание обратно. Пустые строки и пустые блоки не пишем. */
export function serializeCardForm(form: TariffCardForm): string {
  const parts: string[] = [];
  const tagline = form.tagline.trim();
  if (tagline) parts.push(tagline);

  const featureLines = form.features
    .filter((feature) => feature.text.trim())
    .map((feature) => {
      const icon = feature.warn ? WARN_ICON : feature.icon.trim();
      return `${icon ? `${icon} ` : ''}${feature.text.trim()}`;
    });
  if (featureLines.length > 0) parts.push(featureLines.join('\n'));

  const locations = form.locations.map((line) => line.trim()).filter(Boolean);
  if (locations.length > 0) parts.push([LOCATIONS_HEADING, ...locations].join('\n'));

  return parts.join('\n\n');
}

export const KNOWN_COUNTRIES: { name: string; flag: string }[] = Object.entries(FLAGS).map(
  ([name, flag]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), flag }),
);

/** Включает/выключает отметку 📡 у строки локации. */
export function setMetered(line: string, metered: boolean): string {
  const bare = line
    .replace(/\[\s*📡\s*\]/g, '')
    .replace(/📡/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return metered ? `${METERED_MARK} ${bare}`.trim() : bare;
}
