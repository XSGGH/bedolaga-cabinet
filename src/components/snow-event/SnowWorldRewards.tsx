import { useRef, useState } from 'react';
import { Link } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { snowApi, snowError, type SnowReward, type SnowState } from '@/api/snowEvent';
import { hasSubscription } from './snowPresentation';
import { StationSprite } from './SnowWorldScene';

function eligible(state: SnowState, reward: SnowReward) {
  return state.subscriptions.some((sub) =>
    reward.options?.some((o) => (o.kind === 'hours' ? !sub.daily : sub.traffic)),
  );
}
export function giftState(state: SnowState, reward: SnowReward) {
  const receipt = state.progress.receipts.find((r) => r.reward_id === reward.id);
  if (receipt) return receipt.status === 'sync_pending' ? 'delivery' : 'owned';
  if (state.phase === 'upcoming' || state.phase === 'finished') return 'closed';
  if (!hasSubscription(state)) return 'subscription';
  if (reward.id.startsWith('days_') && (state.completed_days || 0) < (reward.threshold || 0))
    return 'personal';
  if (
    reward.id.startsWith('community_') &&
    ((state.world?.total || 0) < (reward.threshold || 0) || state.progress.earned < 100)
  )
    return 'community';
  if (reward.options?.length && !eligible(state, reward)) return 'ineligible';
  return state.progress.balance < reward.cost ? 'insufficient' : 'available';
}

export default function SnowWorldRewards({
  state,
  preview,
  refresh,
}: {
  state: SnowState;
  preview?: string;
  refresh: () => void;
}) {
  const [tab, setTab] = useState<'shop' | 'personal' | 'community'>('shop');
  const [selected, setSelected] = useState<SnowReward | null>(null);
  const rewards =
    tab === 'shop'
      ? state.rewards
      : tab === 'personal'
        ? state.personal_rewards || []
        : state.community_rewards || [];
  return (
    <section className="se-panel sw-gift-shop" aria-labelledby="sw-gifts-title">
      <div className="se-section-heading">
        <div>
          <p className="se-kicker">Полезные подарки для каждого тарифа</p>
          <h2 id="sw-gifts-title">Мастерская подарков</h2>
        </div>
        <span className="se-pill">{state.progress.balance.toLocaleString('ru')} ❄</span>
      </div>
      <p>
        В каждом наборе выбираешь один подарок. Для «Орбиты» — время, для специальных серверов можно
        выбрать гигабайты.
      </p>
      <nav className="sw-tabs" aria-label="Подарки события">
        {[
          ['shop', 'За снежинки'],
          ['personal', 'За приключения'],
          ['community', 'Общие подарки'],
        ].map(([id, name]) => (
          <button
            type="button"
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id as typeof tab)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'community' && (
        <p className="sw-fine-print">
          Нужно заработать 100 личных снежинок. Поздние участники тоже могут получить уже открытые
          подарки до 8 января. Бонусные снежинки не продвигают станцию повторно.
        </p>
      )}
      <div className="sw-gift-list">
        {rewards.map((reward, index) => {
          const status = giftState(state, reward);
          const labels = {
            delivery: 'Оформлено · доставляем',
            owned: '✓ Уже получено',
            closed: state.phase === 'finished' ? 'Обмен завершён' : 'Откроется 1 декабря',
            subscription: 'Нужна активная подписка',
            personal: `После ${reward.threshold} игровых дней`,
            community:
              (state.world?.total || 0) < (reward.threshold || 0)
                ? `Общая цель: ${reward.threshold?.toLocaleString('ru')} ❄`
                : 'Нужно 100 личных снежинок',
            ineligible: 'Нужна подписка с фиксированным сроком',
            insufficient: `Ещё ${reward.cost - state.progress.balance} ❄`,
          };
          const options = (reward.options || []).filter(
            (o) =>
              o.kind !== 'traffic' ||
              state.subscriptions.some((s) => s.traffic) ||
              !hasSubscription(state),
          );
          return (
            <article
              className={`sw-gift sw-gift-${status}`}
              key={reward.id}
              data-reward={reward.id}
            >
              <StationSprite index={index % 3 === 0 ? 2 : index % 3 === 1 ? 4 : 7} />
              <div className="sw-gift-copy">
                <h3>{reward.name}</h3>
                <p>
                  {options.map((o) => o.name).join(' или ')}
                  {reward.snow ? `${options.length ? ' + ' : ''}${reward.snow} снежинок` : ''}
                </p>
                <small>
                  {options.some((o) => o.kind === 'traffic')
                    ? 'Бонусный трафик — на 30 дней'
                    : 'Время добавляется к сроку подписки'}
                </small>
              </div>
              <div className="sw-gift-footer">
                <strong>{reward.cost ? `${reward.cost} ❄` : 'Подарок'}</strong>
                {status === 'available' ? (
                  <button
                    type="button"
                    className="se-secondary"
                    onClick={() => setSelected(reward)}
                  >
                    Получить
                  </button>
                ) : (
                  <span className={status === 'owned' ? 'se-success' : ''}>{labels[status]}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {selected && (
        <GiftDialog
          key={selected.id}
          reward={selected}
          state={state}
          preview={preview}
          onClose={() => setSelected(null)}
          onSuccess={refresh}
        />
      )}
    </section>
  );
}

function GiftDialog({
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
  const [subscriptionId, setSubscriptionId] = useState(
    state.subscriptions.find((s) =>
      reward.options?.some((o) => (o.kind === 'hours' ? !s.daily : s.traffic)),
    )?.id ?? 0,
  );
  const sub = state.subscriptions.find((s) => s.id === subscriptionId);
  const available = (reward.options || []).filter((o) =>
    o.kind === 'hours' ? !sub?.daily : sub?.traffic,
  );
  const [option, setOption] = useState<string>(
    available.find((o) => o.kind === 'hours')?.kind || available[0]?.kind || '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const valid = !reward.options?.length || available.some((o) => o.kind === option);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="snow-event-overlay" />
        <Dialog.Content
          className="snow-dialog snow-event-dialog sw-gift-dialog"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Dialog.Title>{reward.name}</Dialog.Title>
          <Dialog.Description>
            {preview
              ? '🧪 Тестовая выдача в изолированном мире. Реальные данные не изменятся.'
              : 'Один набор — один подарок на выбор. Повторно выбрать второй вариант нельзя.'}
          </Dialog.Description>
          {!!reward.options?.length && (
            <>
              <label className="snow-field">
                К какой подписке добавить
                <select
                  value={subscriptionId}
                  disabled={busy}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSubscriptionId(id);
                    const target = state.subscriptions.find((s) => s.id === id);
                    setOption(target && !target.daily ? 'hours' : target?.traffic ? 'traffic' : '');
                  }}
                >
                  {state.subscriptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="sw-gift-choice">
                <legend>Выбери подарок</legend>
                {available.map((o) => (
                  <label key={o.kind}>
                    <input
                      type="radio"
                      name="snow-gift-option"
                      value={o.kind}
                      checked={option === o.kind}
                      disabled={busy}
                      onChange={() => setOption(o.kind)}
                    />
                    <span>{o.name}</span>
                  </label>
                ))}
              </fieldset>
              {!available.length && (
                <p className="snow-error">Для этой подписки нет подходящего варианта.</p>
              )}
            </>
          )}
          {option === 'traffic' && (
            <p className="sw-traffic-policy">
              Трафик действует 30 дней на специальных серверах этой подписки. По действующим
              правилам при смене тарифа неиспользованные пакеты сгорают. Если планируешь переход —
              можно выбрать время.
            </p>
          )}
          {option === 'hours' && (
            <p>
              Время добавится точно к текущей дате окончания. Оплаченные дни сохранятся. Денежный
              баланс не изменится.
            </p>
          )}
          {!!reward.snow && (
            <p>Ещё +{reward.snow} снежинок в кошелёк. Общая цель от этого бонуса не увеличится.</p>
          )}
          <p className="snow-purchase-total">
            <span>Спишем снежинок</span>
            <strong>{reward.cost} ❄</strong>
          </p>
          {error && (
            <p role="alert" className="snow-error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="se-button"
            disabled={busy || !valid}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError('');
              try {
                await snowApi.action(
                  'claim',
                  {
                    reward_id: reward.id,
                    request_id: requestId.current,
                    subscription_id: subscriptionId,
                    option,
                  },
                  preview,
                );
                onSuccess();
                onClose();
              } catch (e) {
                setError(snowError(e));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {busy
              ? 'Выдаём подарок…'
              : preview
                ? 'Получить тестовый подарок'
                : 'Подтвердить получение'}
          </button>
          <button type="button" className="sw-small-button" disabled={busy} onClick={onClose}>
            Отмена
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function QuazarJourney({
  state,
  preview,
  refresh,
}: {
  state: SnowState;
  preview?: string;
  refresh: () => void;
}) {
  const count = state.completed_days || 0;
  const [quote, setQuote] = useState<{
    cost_kopeks: number;
    before_end: string;
    after_end: string;
    already_switched?: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section
      className={`se-panel sw-quazar ${count >= 26 ? 'sw-quazar-earned' : ''}`}
      aria-labelledby="sw-quazar-title"
    >
      <p className="se-kicker">Долгосрочный подарок за участие</p>
      <h2 id="sw-quazar-title">Путь к Квазару</h2>
      <div className="sw-quazar-count">
        <strong>
          {count}
          <small> / 31</small>
        </strong>
        <span>
          {count >= 26
            ? 'Ты заслужил постоянное право на тариф 💜'
            : `Ещё ${26 - count} приключений до главного подарка`}
        </span>
      </div>
      <progress max="26" value={Math.min(26, count)} aria-label="Прогресс к Квазару" />
      <p>26 разных игровых дней. Можно пропустить пять — непрерывная серия не нужна.</p>
      <div className="sw-quazar-spec">
        <strong>180 ₽ / 30 дней</strong>
        <span>5 устройств</span>
        <span>250 ГБ на специальных серверах</span>
        <span>Безлимитные серверы сохраняются</span>
      </div>
      <p className="sw-fine-print">
        Право остаётся навсегда. Разблокировка не меняет текущую подписку и не списывает деньги.
        Оформить тариф можно с 31 декабря.
      </p>
      {state.quazar?.available ? (
        preview ? (
          <button
            type="button"
            className="se-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                setQuote(await snowApi.action('quazar_preview_quote', {}, preview));
              } catch (e) {
                setError(snowError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Проверить тестовый переход
          </button>
        ) : (
          <Link className="se-button" to="/subscription/purchase">
            Открыть тарифы и выбрать Квазар
          </Link>
        )
      ) : count >= 26 ? (
        <p className="se-success">
          {state.today < '2026-12-31'
            ? 'Заслужено! Оформление откроется 31 декабря.'
            : !state.quazar?.configured
              ? 'Право сохранено. Администратор ещё проверяет настройки тарифа.'
              : 'Право на Квазар сохранено.'}
        </p>
      ) : null}
      {count === 31 && (
        <p className="se-success">
          Все 31 приключение! Кот приготовил ещё 5 дней — забери в подарках за приключения.
        </p>
      )}
      {error && (
        <p role="alert" className="snow-error">
          {error}
        </p>
      )}
      <Dialog.Root
        open={!!quote}
        onOpenChange={(open) => {
          if (!open && !busy) setQuote(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-dialog snow-event-dialog">
            <Dialog.Title>🧪 Переход на Квазар</Dialog.Title>
            <Dialog.Description>
              Изолированная подписка и тестовый баланс. Расчёт использует штатные правила
              переключения тарифов.
            </Dialog.Description>
            {quote?.already_switched ? (
              <p>Тестовая подписка уже на Квазаре.</p>
            ) : (
              <>
                <p>Дата до перехода: {quote?.before_end}</p>
                <p>Дата после: {quote?.after_end}</p>
                <p>Тестовая доплата: {((quote?.cost_kopeks || 0) / 100).toLocaleString('ru')} ₽</p>
                <button
                  type="button"
                  className="se-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await snowApi.action('quazar_preview_switch', {}, preview);
                      refresh();
                      setQuote(null);
                    } catch (e) {
                      setError(snowError(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Выполнить тестовый переход
                </button>
              </>
            )}
            <button
              type="button"
              className="sw-small-button"
              disabled={busy}
              onClick={() => setQuote(null)}
            >
              Закрыть
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
