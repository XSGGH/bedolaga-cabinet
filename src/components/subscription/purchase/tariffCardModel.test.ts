import { describe, expect, it } from 'vitest';
import type { Tariff } from '../../../types';
import {
  buildTrafficModel,
  displayServerName,
  isMeteredServer,
  parseTariffDescription,
} from './tariffCardModel';

const DESCRIPTION = [
  'Расширенный тариф на 3 устройства с Wi-Fi и LTE локациями.',
  '',
  '📡 Работает на мобильных сетях с включенными белыми списками.',
  '',
  '📊 Безлимитный трафик на Wi-Fi локациях',
  '🎬 Рекламы на YouTube не будет',
  '🌐 Умная маршрутизация (отключать VPN не нужно)',
  '',
  'Доступные локации:',
  '📡 Обход белых списков',
  '🇩🇪 Германия',
].join('\n');

function tariff(over: Partial<Tariff>): Tariff {
  return {
    id: 1,
    name: 'T',
    description: null,
    traffic_limit_gb: 150,
    is_unlimited_traffic: false,
    servers: [],
    ...over,
  } as Tariff;
}

describe('parseTariffDescription', () => {
  it('отделяет суть, преимущества и выкидывает список локаций и безлимит', () => {
    const d = parseTariffDescription(DESCRIPTION);
    expect(d.tagline).toBe('Расширенный тариф на 3 устройства с Wi-Fi и LTE локациями.');
    expect(d.features.map((f) => f.text)).toEqual([
      'Работает на мобильных сетях с включенными белыми списками.',
      'Рекламы на YouTube не будет',
      'Умная маршрутизация (отключать VPN не нужно)',
    ]);
  });

  it('помечает предупреждения', () => {
    const d = parseTariffDescription(
      'Базовый\n⚠️ Не будет работать на мобильных сетях с белыми списками.',
    );
    expect(d.features).toEqual([
      { text: 'Не будет работать на мобильных сетях с белыми списками.', warn: true },
    ]);
  });

  it('пустое описание — пустая модель', () => {
    expect(parseTariffDescription(null)).toEqual({ tagline: null, features: [] });
  });
});

describe('серверы', () => {
  it('нормализует названия и узнаёт 📡', () => {
    expect(displayServerName('[📡] Обход белых списков')).toBe('📡 Обход белых списков');
    expect(displayServerName('Германия')).toBe('🇩🇪 Германия');
    expect(displayServerName('🇸🇪 Швеция')).toBe('🇸🇪 Швеция');
    expect(isMeteredServer('[📡] X')).toBe(true);
    expect(isMeteredServer('Германия')).toBe(false);
  });
});

describe('buildTrafficModel', () => {
  const servers = [
    { uuid: 'a', name: '[📡] Обход' },
    { uuid: 'b', name: 'Германия' },
  ];

  it('лимит и 📡: безлимит на обычных, лимит только на 📡', () => {
    const m = buildTrafficModel(tariff({ servers }));
    expect(m.unlimitedScope).toBe('regular');
    expect(m.unlimitedServers).toEqual(['🇩🇪 Германия']);
    expect(m.limitedServers).toEqual(['📡 Обход']);
    expect(m.limitedOnlyMetered).toBe(true);
  });

  it('безлимитный тариф: все серверы безлимитные', () => {
    const m = buildTrafficModel(tariff({ servers, is_unlimited_traffic: true }));
    expect(m.hasLimit).toBe(false);
    expect(m.unlimitedScope).toBe('all');
    expect(m.unlimitedServers).toHaveLength(2);
  });

  it('лимит без 📡-серверов: один лимит на все серверы', () => {
    const m = buildTrafficModel(tariff({ servers: [{ uuid: 'b', name: 'Германия' }] }));
    expect(m.unlimitedScope).toBeNull();
    expect(m.limitedOnlyMetered).toBe(false);
    expect(m.limitedServers).toEqual(['🇩🇪 Германия']);
  });
});
