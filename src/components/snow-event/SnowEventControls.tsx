import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  snowApi,
  snowDates,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const date = state.today;
  const update = async (subscription: SubscriptionScenario, newDate: string, extra = {}) => {
    if (!state.preview_id) return;
    setBusy(true);
    setError('');
    try {
      await snowApi.scenario(state.preview_id, subscription, newDate, extra);
      await client.invalidateQueries({ queryKey: ['snow-event', state.preview_id] });
      onChange();
    } catch (e) {
      setError(snowError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="snow-preview-bar" aria-label="Управление тестовым предпросмотром">
      <div>
        <strong>🧪 Тестовый предпросмотр</strong>
        <p>
          Сценарий: {subscriptionLabels[state.subscription].toLocaleLowerCase('ru')} ·{' '}
          {new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'long',
            timeZone: 'Europe/Moscow',
          }).format(new Date(state.server_now))}
        </p>
      </div>
      <details className="snow-preview-settings">
        <summary>Изменить сценарий / тестовый прогресс</summary>
        <div className="snow-preview-controls">
          <label>
            Подписка
            <select
              disabled={busy}
              value={state.subscription}
              onChange={(e) => update(e.target.value as SubscriptionScenario, date)}
            >
              {Object.entries(subscriptionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
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
              list="snow-preview-dates"
            />
            <datalist id="snow-preview-dates">
              {snowDates.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </datalist>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await dialog.confirm('Сбросить только ваш тестовый прогресс?'))
                void update(state.subscription, date, { reset: true });
            }}
          >
            Сбросить прогресс
          </button>
          <Link to="/admin/snow-event">В админку ↗</Link>
        </div>
        <details>
          <summary>Тестовый баланс и общая цель</summary>
          <div className="snow-preview-extras">
            <button
              type="button"
              disabled={busy}
              onClick={() => update(state.subscription, date, { balance_delta: 545 })}
            >
              +545 ❄
            </button>
            <button
              type="button"
              disabled={busy || state.progress.balance < 30}
              onClick={() => update(state.subscription, date, { balance_delta: -30 })}
            >
              −30 ❄
            </button>
            {[0, 25, 50, 75, 100].map((percent) => (
              <button
                type="button"
                disabled={busy}
                key={percent}
                onClick={() =>
                  update(state.subscription, date, {
                    global_earned: Math.ceil((state.goal * percent) / 100),
                  })
                }
              >
                Цель {percent}%
              </button>
            ))}
          </div>
        </details>
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
