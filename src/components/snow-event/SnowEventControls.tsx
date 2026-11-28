import { useRef, useState } from 'react';
import { Link } from 'react-router';
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
  // Keep the idempotency key for the whole dialog, including background state refreshes.
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const physical = reward && ['days', 'traffic'].includes(reward.kind);
  const eligible = state.subscriptions.filter((s) =>
    reward?.kind === 'days' ? !s.daily : reward?.kind === 'traffic' ? s.traffic : true,
  );
  const subscriptionId = eligible[0]?.id ?? 0;
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
            Обменяем снежинки на подарок. Эту награду можно получить один раз.
          </Dialog.Description>
          {physical && !eligible.length && (
            <p className="snow-error">Для текущего тарифа эта награда недоступна.</p>
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
            {busy ? 'Выдаём подарок…' : 'Подтвердить обмен'}
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
  const [open, setOpen] = useState(false);
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
  return (
    <div className="sw-preview-container">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="sw-preview-trigger" aria-label="Настройки предпросмотра" title="Настройки предпросмотра">⚙</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-dialog snow-event-dialog sw-preview-controls" aria-describedby="sw-preview-description">
          <div className="se-section-heading">
            <div>
              <Dialog.Title>Предпросмотр глазами пользователя</Dialog.Title>
              <p>
                {subscriptionLabels[state.subscription]} ·{' '}
                {tariff === 'orbita' ? 'Орбита' : 'Гипердрайв'}
              </p>
            </div>
            <Dialog.Close
              type="button"
              className="sw-close"
              aria-label="Полностью скрыть настройки предпросмотра"
            >
              ×
            </Dialog.Close>
          </div>
          <p className="sw-fine-print" id="sw-preview-description">
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {error && (
        <p role="alert" className="se-error">
          {error}
        </p>
      )}
    </div>
  );
}
