import type { SnowReward, SnowState } from '@/api/snowEvent';

// Event protocol: a daily visit, the daily game, and four seven-day bonus windows.
export const DAILY_VISIT = 5;
export const DAILY_GAME = 15;
export const WEEKLY_BONUS = 25;
export const number = (value: number) => value.toLocaleString('ru-RU');
export const hasSubscription = (state: SnowState) =>
  state.subscription === 'active' || state.subscription === 'renewed';

export function weekProgress(state: SnowState) {
  const day = state.today.startsWith('2026-12-') ? Number(state.today.slice(-2)) : state.today < '2026-12-01' ? 1 : 31;
  const week = Math.min(3, Math.floor((day - 1) / 7));
  const first = week * 7 + 1;
  const count = Array.from(
    { length: 7 },
    (_, index) => state.progress.days[`2026-12-${String(first + index).padStart(2, '0')}`]?.game,
  ).filter(Boolean).length;
  return { week, first, count, claimed: state.progress.weeks.includes(week), over: day > 28 };
}

export function rewardStatus(state: SnowState, reward: SnowReward) {
  const receipt = state.progress.receipts.find((item) => item.reward_id === reward.id);
  if (receipt) return receipt.status === 'sync_pending' ? 'processing' : 'owned';
  if (state.phase === 'upcoming' || state.phase === 'finished') return 'locked';
  if (!hasSubscription(state)) return 'subscription';
  if (
    (reward.kind === 'days' && !state.subscriptions.some((s) => !s.daily)) ||
    (reward.kind === 'traffic' && !state.subscriptions.some((s) => s.traffic))
  )
    return 'ineligible';
  return state.progress.balance < reward.cost ? 'insufficient' : 'available';
}

export function nextBoundary(state: SnowState): string | undefined {
  if (state.phase === 'upcoming') return state.starts_at;
  if (state.phase === 'shop_only') return state.ends_at;
  if (state.phase !== 'active') return;
  // UTC+3 has no seasonal offset; the next local midnight is 21:00 UTC.
  const next = new Date(`${state.today}T00:00:00+03:00`).getTime() + 86400000;
  return new Date(Math.min(next, Date.parse(state.shop_at))).toISOString();
}
