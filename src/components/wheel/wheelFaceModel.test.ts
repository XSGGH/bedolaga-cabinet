import { describe, expect, it } from 'vitest';
import type { WheelPrize } from '../../api/wheel';
import { jackpotIds, prizeLabel } from './wheelFaceModel';

const prize = (id: number, display_name: string, prize_type: string, emoji = '🎁'): WheelPrize => ({
  id,
  display_name,
  prize_type,
  emoji,
  color: '#000',
});

describe('prizeLabel', () => {
  it('берёт число и единицу из названия', () => {
    expect(prizeLabel(prize(1, '7 дней', 'subscription_days'))).toEqual({
      main: '7',
      unit: 'ДНЕЙ',
      isEmoji: false,
    });
    expect(prizeLabel(prize(2, '50₽', 'balance_bonus'))).toEqual({
      main: '50',
      unit: '₽',
      isEmoji: false,
    });
    expect(prizeLabel(prize(3, '5 ГБ', 'traffic_gb')).unit).toBe('ГБ');
  });

  it('без числа показывает эмодзи, а «ничего» — тире', () => {
    expect(prizeLabel(prize(4, 'Промокод', 'promocode', '🎟️'))).toEqual({
      main: '🎟️',
      unit: '',
      isEmoji: true,
    });
    expect(prizeLabel(prize(5, 'Ничего', 'nothing', '😔')).main).toBe('—');
  });
});

describe('jackpotIds', () => {
  it('отмечает самый крупный приз категории, если их три и больше', () => {
    const prizes = [
      prize(1, '1 день', 'subscription_days'),
      prize(2, '7 дней', 'subscription_days'),
      prize(3, '60 дней', 'subscription_days'),
      prize(4, '5₽', 'balance_bonus'),
      prize(5, '100₽', 'balance_bonus'),
    ];
    expect([...jackpotIds(prizes)]).toEqual([3]);
  });
});
