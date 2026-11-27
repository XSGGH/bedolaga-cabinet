import { describe, expect, it } from 'vitest';
import type { SnowReward, SnowState } from '@/api/snowEvent';
import { nextBoundary, rewardStatus, weekProgress } from './snowPresentation';

const reward: SnowReward = {
  id: 'days',
  kind: 'days',
  name: 'Дни',
  description: '',
  cost: 130,
  value: 1,
};
function state(extra: Partial<SnowState> = {}): SnowState {
  return {
    phase: 'active',
    subscription: 'active',
    today: '2026-12-15',
    server_now: '2026-12-15T12:00:00+03:00',
    starts_at: '2026-12-01T00:00:00+03:00',
    shop_at: '2027-01-01T00:00:00+03:00',
    ends_at: '2027-01-08T00:00:00+03:00',
    subscriptions: [{ id: 1, name: 'Тариф', daily: false, traffic: true }],
    progress: { balance: 130, earned: 130, days: {}, weeks: [], receipts: [], cosmetics: [] },
    goal: 10000,
    global_earned: 0,
    rewards: [reward],
    preview: false,
    preview_id: null,
    ...extra,
  };
}
describe('Event presentation follows the server contract', () => {
  it('distinguishes pending delivery from a received or affordable reward', () => {
    const s = state();
    expect(rewardStatus(s, reward)).toBe('available');
    s.progress.balance = 129;
    expect(rewardStatus(s, reward)).toBe('insufficient');
    s.progress.receipts.push({
      id: 'r',
      reward_id: reward.id,
      name: '',
      cost: 130,
      at: '',
      test: false,
      status: 'sync_pending',
    });
    expect(rewardStatus(s, reward)).toBe('processing');
    s.progress.receipts[0].status = 'granted';
    expect(rewardStatus(s, reward)).toBe('owned');
  });
  it('never offers inaccessible actions, even with enough currency', () => {
    for (const subscription of ['none', 'expired'] as const)
      expect(rewardStatus(state({ subscription }), reward)).toBe('subscription');
    for (const phase of ['upcoming', 'finished'] as const)
      expect(rewardStatus(state({ phase }), reward)).toBe('locked');
    expect(
      rewardStatus(
        state({ subscriptions: [{ id: 1, name: '', daily: true, traffic: false }] }),
        reward,
      ),
    ).toBe('ineligible');
    expect(rewardStatus(state({ subscriptions: [] }), { ...reward, kind: 'traffic' })).toBe(
      'ineligible',
    );
    expect(rewardStatus(state({ subscription: 'renewed' }), reward)).toBe('available');
  });
  it('counts games only inside the current seven-day window, not check-ins', () => {
    const s = state();
    s.progress.days = {
      '2026-12-14': { game: true },
      '2026-12-15': { checkin: true },
      '2026-12-16': { game: true },
    };
    expect(weekProgress(s)).toMatchObject({ week: 2, first: 15, count: 1, claimed: false });
    s.progress.weeks = [2];
    expect(weekProgress(s).claimed).toBe(true);
    expect(weekProgress({ ...s, today: '2026-12-31' }).over).toBe(true);
  });
  it('refreshes on Moscow midnight and stops setting boundaries after the event', () => {
    expect(nextBoundary(state())).toBe('2026-12-15T21:00:00.000Z');
    expect(nextBoundary(state({ today: '2026-12-31' }))).toBe('2026-12-31T21:00:00.000Z');
    expect(nextBoundary(state({ phase: 'upcoming' }))).toBe(state().starts_at);
    expect(nextBoundary(state({ phase: 'shop_only' }))).toBe(state().ends_at);
    expect(nextBoundary(state({ phase: 'finished' }))).toBeUndefined();
  });
});
