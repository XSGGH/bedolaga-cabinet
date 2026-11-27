import apiClient from './client';

export type SubscriptionScenario = 'active' | 'none' | 'expired' | 'renewed';
export interface SnowProgress {
  balance: number;
  earned: number;
  days: Record<string, { checkin?: boolean; game?: boolean }>;
  weeks: number[];
  cosmetics: string[];
  receipts: {
    id: string;
    reward_id: string;
    name: string;
    cost: number;
    at: string;
    test: boolean;
    status?: string;
  }[];
}
export interface SnowReward {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: string;
  value: number;
}
export interface SnowState {
  phase: 'upcoming' | 'active' | 'shop_only' | 'finished';
  server_now: string;
  starts_at: string;
  shop_at: string;
  ends_at: string;
  today: string;
  subscription: SubscriptionScenario;
  subscriptions: { id: number; name: string; daily: boolean; traffic: boolean }[];
  progress: SnowProgress;
  global_earned: number;
  goal: number;
  rewards: SnowReward[];
  preview: boolean;
  preview_id: string | null;
}
export interface SnowGame {
  id: string;
  duration: number;
  required: number;
  targets: { id: string; lane: number; at: number }[];
}
export const snowDates = [
  ['2026-11-27', '27 ноября · анонс'],
  ['2026-11-30', '30 ноября · ожидание'],
  ['2026-12-01', '1 декабря · старт'],
  ['2026-12-07', '7 декабря · первая неделя'],
  ['2026-12-15', '15 декабря · событие'],
  ['2026-12-31', '31 декабря · финал игр'],
  ['2027-01-01', '1 января · магазин'],
  ['2027-01-08', '8 января · завершение'],
] as const;
export const subscriptionLabels: Record<SubscriptionScenario, string> = {
  active: 'Активная подписка',
  none: 'Нет подписки',
  expired: 'Подписка закончилась',
  renewed: 'Подписка продлена',
};
const base = (preview?: string) =>
  preview ? `/cabinet/admin/snow-event/previews/${preview}` : '/cabinet/snow-event';
export const snowApi = {
  state: async (preview?: string): Promise<SnowState> => (await apiClient.get(base(preview))).data,
  action: async <T = unknown>(
    action: string,
    body: Record<string, unknown> = {},
    preview?: string,
  ): Promise<T> =>
    (await apiClient.post(`${base(preview)}/actions`, { action, ...body })).data.result,
  create: async (subscription: SubscriptionScenario, date: string): Promise<{ id: string }> =>
    (
      await apiClient.post('/cabinet/admin/snow-event/previews', {
        subscription,
        date: `${date}T12:00:00+03:00`,
      })
    ).data,
  scenario: async (
    id: string,
    subscription: SubscriptionScenario,
    date: string,
    extra: Record<string, unknown> = {},
  ) => apiClient.patch(base(id), { subscription, date: `${date}T12:00:00+03:00`, ...extra }),
  admin: async (): Promise<{
    config: {
      goal: number;
      rewards: SnowReward[];
      starts_at: string;
      shop_at: string;
      ends_at: string;
    };
    participants: number;
    earned: number;
    locked: boolean;
  }> => (await apiClient.get('/cabinet/admin/snow-event')).data,
  config: async (goal: number, prices: Record<string, number>) =>
    apiClient.patch('/cabinet/admin/snow-event', { goal, prices }),
};
export function snowError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: { message?: string } | string } } })
    ?.response?.data?.detail;
  return typeof detail === 'string'
    ? detail
    : detail?.message || 'Не удалось связаться с событием. Попробуйте ещё раз.';
}
