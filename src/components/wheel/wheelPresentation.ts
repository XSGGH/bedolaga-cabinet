import type { SpinHistoryItem, WheelPrize } from '@/api/wheel';

export function subscriptionDays(amount: number): string {
  const word: Record<string, string> = { one: 'день', few: 'дня', many: 'дней', other: 'дня' };
  return `${amount} ${word[new Intl.PluralRules('ru').select(amount)]} подписки`;
}

export function spinCost(type: string, amount: number): string {
  if (type === 'subscription_days') return subscriptionDays(amount);
  if (type === 'telegram_stars') return `${amount} ⭐`;
  return amount === 0 ? 'Без списания' : `${amount} (${type})`;
}

/** Normalize only simple numeric labels; custom descriptions and promo rewards stay intact. */
export function rewardTitle(prize: Pick<WheelPrize, 'display_name' | 'prize_type'>): string {
  if (prize.prize_type === 'subscription_days') {
    const match = /^\+?(\d+)\s*(?:день|дня|дней)(?:\s+(?:к\s+)?подписк[еи])?\.?$/i.exec(
      prize.display_name.trim(),
    );
    if (match) return `+${subscriptionDays(Number(match[1]))}`;
  }
  if (prize.prize_type === 'balance_bonus') {
    const match = /^\+?(\d+(?:[.,]\d+)?)\s*₽(?:\s+на\s+баланс)?\.?$/i.exec(
      prize.display_name.trim(),
    );
    if (match) return `+${match[1]} ₽ на баланс`;
  }
  return prize.display_name;
}

export function historyReward(item: SpinHistoryItem): string {
  return rewardTitle({ display_name: item.prize_display_name, prize_type: item.prize_type });
}
