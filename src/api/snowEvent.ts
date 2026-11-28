import apiClient from './client';

export interface SnowChapter {
  id: string;
  planet: string;
  kind: 'main' | 'bonus';
  title: string;
  caption: string;
  count: number;
  total: number;
  columns: number;
  rows: number;
  image_width: number;
  image_height: number;
  tiles: number[];
  story: string | null;
  unlocked: boolean;
}

export interface SnowAttempt {
  id: string;
  cards: (string | null)[];
  matched: number[];
  finished: boolean;
  errors: number;
  elapsed: number;
  status: 'ready' | 'active' | 'paused' | 'timeout' | 'completed';
  session_revision: number;
}

export interface MosaicState {
  chapters: SnowChapter[];
  home_lights: number;
  epilogue: boolean;
  personal_days: { date: string; best: number; attempts: number }[];
  personal_earned: number;
  reserve: number;
  unique_players: number;
  today_players: number;
  personal_contributions: number;
  personal_reserve: number;
  personal_chapters: Record<string, number>;
  best: number;
  attempts_used: number;
  attempt: SnowAttempt | null;
  attempt_end: SnowAttempt['status'] | null;
  target_id: string | null;
  session_version?: number;
  today: string;
  server_now: string;
}

export interface SnowMove {
  attempt: SnowAttempt;
  index?: number;
  first?: number;
  symbol?: string;
  match?: boolean;
  earned: number;
  best: number;
  destination?: { kind: 'main' | 'bonus' | 'reserve'; mosaic_id?: string };
}

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
    after_end?: string;
    option?: { kind: 'traffic' | 'hours'; value: number; name: string } | null;
  }[];
}
export interface SnowReward {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: string;
  value: number;
  options?: { kind: 'traffic' | 'hours'; value: number; name: string; expires_days?: number }[];
  threshold?: number;
  snow?: number;
}
export interface SnowState {
  preview_planet?: string;
  mosaics?: MosaicState;
  preview_revision?: string | null;
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
  preview_tariff?: string;
  rules?: {
    visit: number;
    game: number;
    week: number;
    base_max: number;
    goal: number;
    stretch_goal: number;
  };
  world?: {
    total: number;
    stages: StationStage[];
    events: StationEvent[];
    new_events: StationEvent[];
    decorations: StationDecoration[];
    vote: {
      week: number;
      counts: Record<string, number>;
      own?: string;
      results: { week: number; choice: string; counts: Record<string, number> }[];
      tie_rule: string;
    };
  };
  personal_rewards?: SnowReward[];
  community_rewards?: SnowReward[];
  completed_days?: number;
  game?: { kind: string; name: string; final: boolean };
  quazar?: {
    earned: boolean;
    available: boolean;
    configured: boolean;
    release_at: string;
    price_kopeks: number;
    devices: number;
    special_traffic_gb: number;
    tariff_id?: number;
    earned_at?: string;
  };
  day_ends_at?: string;
  last_visit?: string;
}
export interface StationStage {
  id: string;
  threshold: number;
  zone: string;
  name: string;
}
export interface StationEvent extends StationStage {
  at: string;
}
export interface StationDecoration {
  id: string;
  threshold: number;
  kind: string;
  slot: number;
  name: string;
  own: boolean;
  at: string;
}
export interface SnowGame {
  id: string;
  duration: number;
  required: number;
  targets: { id: string; lane: number; at: number }[];
  kind?: string;
  name?: string;
  final?: boolean;
  min_seconds?: number;
  cards?: { id: string; index: number; object?: string; colour?: string }[];
  order?: string[];
  path?: number[];
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
  state: async (preview?: string, signal?: AbortSignal): Promise<SnowState> =>
    (await apiClient.get(base(preview), { signal, params: { sessions: true } })).data,
  mosaic: async <T>(action: string, body: Record<string, unknown>, preview?: string): Promise<T> =>
    (await apiClient.post(`${base(preview)}/mosaics/actions`, { action, ...body })).data.result,
  tile: async (chapter: string, index: number, signal: AbortSignal, preview?: string) =>
    (
      await apiClient.get<Blob>(`${base(preview)}/mosaics/${chapter}/tiles/${index}`, {
        responseType: 'blob',
        signal,
      })
    ).data,
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
    stats?: {
      active_today: number;
      quazar_completed: number;
      quazar_candidates: number;
      spent: number;
      hours_granted: number;
      traffic_granted: number;
      quazar_accounts: number;
    };
    budget?: {
      max_coins: number;
      per_user_hours_upper: number;
      per_user_gb_upper: number;
      scenarios: {
        participants: number;
        hours_upper: number;
        gb_upper: number;
        quazar_accounts_upper: number;
      }[];
      note: string;
    };
    sources?: { id: number; name: string; traffic: number; devices: number }[];
    audit?: {
      id: string;
      user_id: number;
      day: string;
      incident: string;
      reason: string;
      at: string;
      credited: number;
    }[];
  }> => (await apiClient.get('/cabinet/admin/snow-event')).data,
  setupQuazar: async (source_tariff_id: number) =>
    apiClient.post('/cabinet/admin/snow-event/quazar', { source_tariff_id }),
  incident: async (body: Record<string, unknown>) =>
    apiClient.post('/cabinet/admin/snow-event/incidents', body),
  restoreDay: async (body: Record<string, unknown>) =>
    apiClient.post('/cabinet/admin/snow-event/restore-day', body),
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
