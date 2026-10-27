import type { WheelPrize } from '../../api/wheel';

/**
 * Что рисуем на секторе колеса. Призы в панели свободные («7 дней», «50₽»,
 * «Промокод −20%»), поэтому число и единицу достаём из названия; нет числа —
 * показываем эмодзи приза.
 */

export interface PrizeLabel {
  /** Крупная строка: число, «—» или эмодзи. */
  main: string;
  /** Мелкая строка под ней: единица («ДНЕЙ», «₽», «ГБ»); пусто, если нечего писать. */
  unit: string;
  /** Крупная строка — эмодзи, а не число. */
  isEmoji: boolean;
}

const NUMBER_WITH_UNIT = /(\d+(?:[.,]\d+)?)\s*([^\d\s.,;:!?)]{1,8})?/u;

export function prizeLabel(
  prize: Pick<WheelPrize, 'display_name' | 'emoji' | 'prize_type'>,
): PrizeLabel {
  if (prize.prize_type === 'nothing') return { main: '—', unit: '', isEmoji: false };
  const match = NUMBER_WITH_UNIT.exec(prize.display_name);
  if (!match) return { main: prize.emoji || '🎁', unit: '', isEmoji: true };
  return {
    main: (match[1] ?? '').replace(',', '.'),
    unit: (match[2] ?? '').toUpperCase(),
    isEmoji: false,
  };
}

/** Цвет категории приза: по нему красится дуга сектора и точки в легенде. */
export const PRIZE_TYPE_COLORS: Record<string, string> = {
  subscription_days: '#4ade80',
  balance_bonus: '#f0abfc',
  traffic_gb: '#7aa2ff',
  promocode: '#67e8f9',
  nothing: '#4a3d68',
};

const FALLBACK_COLOR = '#a896c4';

export function prizeTypeColor(prizeType: string): string {
  return PRIZE_TYPE_COLORS[prizeType] ?? FALLBACK_COLOR;
}

function numberOf(prize: WheelPrize): number {
  const match = NUMBER_WITH_UNIT.exec(prize.display_name);
  return match ? Number.parseFloat((match[1] ?? '').replace(',', '.')) : Number.NaN;
}

/**
 * Главные призы: самый крупный в своей категории, если в категории есть из чего
 * выбирать (три и больше числовых призов). Иначе подсвечивать нечего.
 */
export function jackpotIds(prizes: WheelPrize[]): Set<number> {
  const byType = new Map<string, WheelPrize[]>();
  for (const prize of prizes) {
    if (prize.prize_type === 'nothing' || Number.isNaN(numberOf(prize))) continue;
    byType.set(prize.prize_type, [...(byType.get(prize.prize_type) ?? []), prize]);
  }
  const result = new Set<number>();
  for (const group of byType.values()) {
    if (group.length < 3) continue;
    const max = Math.max(...group.map(numberOf));
    for (const prize of group) {
      if (numberOf(prize) === max) result.add(prize.id);
    }
  }
  return result;
}
