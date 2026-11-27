import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  snowApi,
  snowError,
  subscriptionLabels,
  type SnowReward,
  type SnowState,
  type SubscriptionScenario,
} from '@/api/snowEvent';
import { useNativeDialog } from '@/platform';
export function PurchaseDialog({
  reward,
  state,
  preview,
  onClose,
  onSuccess,
}: {
  reward: SnowReward;
  state: SnowState;
  preview?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionId, setSubscriptionId] = useState<number>(
    () =>
      state.subscriptions.find((s) =>
        reward.kind === 'days' ? !s.daily : reward.kind === 'traffic' ? s.traffic : true,
      )?.id ?? 0,
  );
  // Keep the idempotency key for the whole dialog, including background state refreshes.
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const physical = reward && ['days', 'traffic'].includes(reward.kind);
  const eligible = state.subscriptions.filter((s) =>
    reward?.kind === 'days' ? !s.daily : reward?.kind === 'traffic' ? s.traffic : true,
  );
  return (
    <Dialog.Root
      open={!!reward}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="snow-dialog-overlay snow-event-overlay" />
        <Dialog.Content
          className="snow-dialog snow-card snow-event-dialog"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Dialog.Title>{reward?.name}</Dialog.Title>
          <Dialog.Description>
            {preview
              ? 'Тестовый обмен. Настоящая подписка и баланс не изменятся.'
              : 'Обменяем снежинки на подарок. Эту награду можно получить один раз.'}
          </Dialog.Description>
          {physical && (
            <label className="snow-field">
              Куда добавить подарок
              <select
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(Number(e.target.value))}
              >
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!eligible.length && <span>Для этой награды нет подходящей подписки.</span>}
            </label>
          )}
          <p className="snow-purchase-total">
            <span>Будет списано</span>
            <strong>{reward?.cost} ❄</strong>
          </p>
          {error && (
            <p role="alert" className="snow-error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="snow-button"
            disabled={busy || (!!physical && !eligible.length)}
            onClick={async () => {
              if (submitting.current) return;
              submitting.current = true;
              setBusy(true);
              setError('');
              try {
                await snowApi.action(
                  'purchase',
                  {
                    reward_id: reward.id,
                    subscription_id: subscriptionId,
                    request_id: requestId.current,
                  },
                  preview,
                );
                onSuccess();
                onClose();
              } catch (e) {
                setError(snowError(e));
              } finally {
                submitting.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? 'Выдаём подарок…' : preview ? 'Выполнить тестовый обмен' : 'Подтвердить обмен'}
          </button>
          <button type="button" className="snow-text-button" disabled={busy} onClick={onClose}>
            Отмена
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PreviewBar({ state, onChange }: { state: SnowState; onChange: () => void }) {
  const dialog = useNativeDialog();
  const client = useQueryClient();
  const [search] = useSearchParams();
  const storageKey = `snow-preview-hidden:${state.preview_id}`;
  const [hidden, setHidden] = useState(
    () => search.get('settings') !== '1' && sessionStorage.getItem(storageKey) === 'yes',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tariff, setTariff] = useState(state.preview_tariff || 'hyperdrive');
  const date = state.today;
  const update = async (
    subscription: SubscriptionScenario,
    newDate: string,
    extra: Record<string, unknown> = {},
  ) => {
    if (!state.preview_id || busy) return;
    setBusy(true);
    setError('');
    try {
      await snowApi.scenario(state.preview_id, subscription, newDate, { tariff, ...extra });
      await client.invalidateQueries({ queryKey: ['snow-event', state.preview_id] });
      onChange();
    } catch (e) {
      setError(snowError(e));
    } finally {
      setBusy(false);
    }
  };
  const visibility = (value: boolean) => {
    setHidden(value);
    sessionStorage.setItem(storageKey, value ? 'yes' : 'no');
  };
  return (
    <div className="sw-preview-container">
      <div className="sw-preview-indicator">
        <span>
          🧪 Тестовый предпросмотр · {subscriptionLabels[state.subscription]} · {state.today}
        </span>
        <button type="button" onClick={() => visibility(!hidden)}>
          {hidden ? 'Открыть настройки' : 'Скрыть настройки'}
        </button>
      </div>
      {!hidden && (
        <section className="sw-preview-controls" aria-label="Управление тестовым предпросмотром">
          <div className="se-section-heading">
            <div>
              <strong>Предпросмотр глазами пользователя</strong>
              <p>
                {subscriptionLabels[state.subscription]} ·{' '}
                {tariff === 'orbita' ? 'Орбита' : 'Гипердрайв'}
              </p>
            </div>
            <button
              type="button"
              className="sw-close"
              aria-label="Полностью скрыть настройки предпросмотра"
              onClick={() => visibility(true)}
            >
              ×
            </button>
          </div>
          <p className="sw-fine-print">
            Подписка, снежинки, станция и подарки изолированы. Тестовый личный вклад не входит в
            настоящий общий счётчик.
          </p>
          <div className="sw-preview-fields">
            <label>
              Состояние подписки
              <select
                disabled={busy}
                value={state.subscription}
                onChange={(e) => void update(e.target.value as SubscriptionScenario, date)}
              >
                {Object.entries(subscriptionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Тариф
              <select
                value={tariff}
                disabled={busy}
                onChange={(e) => {
                  setTariff(e.target.value);
                  void update(state.subscription, date, { tariff: e.target.value });
                }}
              >
                <option value="hyperdrive">Гипердрайв</option>
                <option value="orbita">Орбита — безлимитные серверы</option>
              </select>
            </label>
            <label>
              Тестовая дата
              <input
                type="date"
                disabled={busy}
                value={date}
                min="2026-11-01"
                max="2027-01-31"
                onChange={(e) => {
                  if (e.target.value) void update(state.subscription, e.target.value);
                }}
              />
            </label>
            <label>
              Готовых игровых дней
              <select
                value={state.completed_days || 0}
                disabled={busy}
                onChange={(e) => {
                  const count = Number(e.target.value);
                  void update(state.subscription, count > 0 ? '2026-12-31' : date, {
                    completed_days: count,
                  });
                }}
              >
                {Array.from({ length: 32 }, (_, i) => (
                  <option value={i} key={i}>
                    {i} / 31
                  </option>
                ))}
              </select>
            </label>
            <label>
              Этап общей станции
              <select
                value={state.world?.total || 0}
                disabled={busy}
                onChange={(e) =>
                  void update(state.subscription, date, { global_earned: Number(e.target.value) })
                }
              >
                <option value="0">0 · начало</option>
                {state.world?.stages.map((stage) => (
                  <option key={stage.id} value={stage.threshold}>
                    {stage.threshold} · {stage.name}
                  </option>
                ))}
                {!state.world?.stages.some((s) => s.threshold === state.world?.total) &&
                  !!state.world?.total && (
                    <option value={state.world.total}>
                      {state.world.total} · текущий прогресс
                    </option>
                  )}
              </select>
            </label>
          </div>
          <div className="sw-preview-actions">
            <button
              type="button"
              className="se-secondary"
              disabled={busy}
              onClick={() => void update(state.subscription, date, { balance_delta: 800 })}
            >
              Добавить 800 тестовых ❄
            </button>
            <button
              type="button"
              className="sw-small-button"
              disabled={busy}
              onClick={async () => {
                if (await dialog.confirm('Сбросить только ваш тестовый мир, игры и подарки?'))
                  void update(state.subscription, date, { reset: true });
              }}
            >
              Сбросить тестовый прогресс
            </button>
            <Link to="/admin/snow-event">Вернуться в админку ↗</Link>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="se-error">
          {error}
        </p>
      )}
    </div>
  );
}
