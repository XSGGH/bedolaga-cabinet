import { expect, it } from 'vitest';
import { historyReward, rewardTitle, spinCost, subscriptionDays } from './wheelPresentation';

it('names the actual cost and pluralizes days', () => {
  expect(subscriptionDays(1)).toBe('1 день подписки');
  expect(subscriptionDays(3)).toBe('3 дня подписки');
  expect(subscriptionDays(12)).toBe('12 дней подписки');
  expect(spinCost('telegram_stars', 30)).toBe('30 ⭐');
  expect(spinCost('subscription_days', 0)).toBe('0 дней подписки');
});
it('normalizes simple reward labels without changing custom or promo descriptions', () => {
  expect(rewardTitle({ prize_type: 'subscription_days', display_name: '+4 дня к подписки' })).toBe(
    '+4 дня подписки',
  );
  expect(rewardTitle({ prize_type: 'balance_bonus', display_name: '30₽ на баланс' })).toBe(
    '+30 ₽ на баланс',
  );
  expect(
    historyReward({
      prize_type: 'promocode',
      prize_display_name: 'Промокод: 20 ₽ + 5 дней',
    } as never),
  ).toBe('Промокод: 20 ₽ + 5 дней');
  expect(
    rewardTitle({ prize_type: 'subscription_days', display_name: 'Особая награда: 5 дней' }),
  ).toBe('Особая награда: 5 дней');
});
