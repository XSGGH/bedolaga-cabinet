import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { snowApi, snowError, type SnowReward, type SnowState } from '@/api/snowEvent';
import { hasSubscription } from './snowPresentation';
import { giftNames } from './snowGiftNames';
import { gameDays } from './snowGrammar';

const giftArtByCost: Record<number, number> = {
  20: 0,
  35: 1,
  45: 2,
  80: 3,
  115: 4,
  190: 5,
  275: 6,
  490: 7,
  720: 8,
};
function GiftVisual({
  rewardId,
  cost,
  variant = 0,
  className = '',
}: {
  rewardId?: string;
  cost?: number;
  variant?: number;
  className?: string;
}) {
  const index =
    (cost === undefined ? undefined : giftArtByCost[cost]) ??
    (rewardId ? [...rewardId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9 : variant) % 9;
  return (
    <span
      aria-hidden="true"
      className={`sv4-gift-emblem ${className}`}
      style={{ backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` }}
    />
  );
}

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
  const [tab, setTab] = useState<'shop' | 'personal' | 'community' | 'received'>('shop');
  const [selected, setSelected] = useState<SnowReward | null>(null);
  const [opened, setOpened] = useState<{ reward: SnowReward; option: string } | null>(null);
  const awardedOption = opened?.reward.options?.find((option) => option.kind === opened.option);
  const rewards =
    tab === 'shop'
      ? state.rewards
      : tab === 'personal'
        ? state.personal_rewards || []
        : state.community_rewards || [];
  const tabs = [
    ['shop', 'За снежинки'],
    ['personal', 'За приключения'],
    ['received', 'Полученные'],
  ] as const;
  return (
    <section className="se-panel sw-gift-shop" aria-labelledby="sw-gifts-title">
      <div className="se-section-heading">
        <div>
          <p className="se-kicker">Выбирай маленькие зимние чудеса</p>
          <h2 id="sw-gifts-title">Лавка кота</h2>
        </div>
        <GiftVisual variant={3} className="sv4-shop-sign" />
      </div>
      <p className="sv3-shop-intro">
        Меняй снежинки на подарки. Каждый набор можно получить один раз. Время добавляется к сроку
        подписки, а бонусный трафик действует 30 дней.
      </p>
      <nav className="sw-tabs sv3-gift-tabs" aria-label="Подарки события">
        {tabs.map(([key, name]) => (
          <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {name}
            {key === 'received' ? ` · ${state.progress.receipts.length}` : ''}
          </button>
        ))}
      </nav>
      {tab === 'community' && (
        <p className="sw-fine-print">
          Нужно заработать 100 личных снежинок. Уже открытые общие подарки доступны и поздним
          участникам до 8 января. Бонусы не продвигают станцию повторно.
        </p>
      )}
      {tab === 'received' ? (
        <div className="sv3-receipts">
          {state.progress.receipts.length ? (
            state.progress.receipts
              .slice()
              .reverse()
              .map((receipt) => (
                <article key={receipt.id}>
                  <GiftVisual rewardId={receipt.reward_id} cost={receipt.cost} />
                  <div>
                    <h3>{giftNames[receipt.reward_id] || receipt.name}</h3>
                    <p>
                      {new Date(receipt.at).toLocaleString('ru-RU', {
                        timeZone: 'Europe/Moscow',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      МСК
                    </p>
                    <small>
                      {receipt.status === 'sync_pending'
                        ? 'Подарок оформлен · доставляем'
                        : receipt.after_end
                          ? `Новый срок: ${new Date(receipt.after_end).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}`
                          : 'Подарок получен'}
                    </small>
                  </div>
                  <strong>{receipt.cost ? `${receipt.cost} ❄` : 'Подарок'}</strong>
                </article>
              ))
          ) : (
            <div className="sv3-empty-gifts">
              <GiftVisual />
              <h3>Первый сюрприз ещё впереди</h3>
              <p>Здесь кот сохранит всё, что ты получил в лавке.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="sw-gift-list">
          {rewards.map((reward, index) => {
            const status = giftState(state, reward),
              name = giftNames[reward.id] || reward.name;
            const labels: Record<string, string> = {
              available: 'Получить награду',
              delivery: 'Оформлено · доставляем',
              owned: '✓ Уже получено',
              closed: state.phase === 'finished' ? 'Обмен завершён' : 'Откроется 1 декабря',
              subscription: 'Нужна активная подписка',
              personal: `После ${gameDays(reward.threshold || 0)}`,
              community:
                (state.world?.total || 0) < (reward.threshold || 0)
                  ? `Общая цель: ${reward.threshold?.toLocaleString('ru')} ❄`
                  : 'Нужно 100 личных снежинок',
              ineligible: 'Нет подходящей подписки',
              insufficient: `Ещё ${reward.cost - state.progress.balance} ❄`,
            };
            const options = (reward.options || []).filter(
              (o) =>
                o.kind !== 'traffic' ||
                state.subscriptions.some((sub) => sub.traffic) ||
                !hasSubscription(state),
            );
            return (
              <article
                className={`sw-gift sw-gift-${status} ${reward.cost >= 720 ? 'sv3-gift-grand' : reward.cost >= 275 ? 'sv3-gift-rare' : ''}`}
                key={reward.id}
                data-reward={reward.id}
              >
                <button
                  type="button"
                  className="sv3-gift-open"
                  aria-label={`${name} · ${labels[status]}`}
                  onClick={() => setSelected({ ...reward, name })}
                >
                  <span className={`sv3-gift-art sv3-gift-art-${index % 3}`}>
                    <GiftVisual rewardId={reward.id} cost={reward.cost} />
                  </span>
                  <h3>
                    {name}
                    {reward.cost >= 720 && (
                      <small className="sv3-gift-rarity">Главный сундук</small>
                    )}
                    {reward.cost >= 275 && reward.cost < 720 && (
                      <small className="sv3-gift-rarity">Особенный подарок</small>
                    )}
                  </h3>
                </button>
                <div className="sw-gift-copy">
                  <p>
                    {options.map((o) => o.name).join(' или ')}
                    {reward.snow ? `${options.length ? ' + ' : ''}${reward.snow} снежинок` : ''}
                  </p>
                </div>
                <div className="sw-gift-footer">
                  <strong>{reward.cost ? `${reward.cost} ❄` : 'Подарок'}</strong>
                  <button
                    type="button"
                    className={status === 'owned' ? 'se-success' : ''}
                    onClick={() => setSelected({ ...reward, name })}
                  >
                    {labels[status]}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {selected && (
        <GiftDialog
          key={selected.id}
          reward={selected}
          state={state}
          preview={preview}
          onClose={() => setSelected(null)}
          onSuccess={(option) => {
            setOpened({ reward: selected, option });
            refresh();
          }}
        />
      )}
      <Dialog.Root
        open={!!opened}
        onOpenChange={(value) => {
          if (!value) setOpened(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-dialog snow-event-dialog sv3-gift-unboxing">
            <p className="sv3-unbox-kicker">✦ Сюрприз оформлен ✦</p>
            <Dialog.Title>Маленькое чудо уже рядом!</Dialog.Title>
            <Dialog.Description>
              Кот бережно оформил подарок. Статус доставки появится в «Полученных».
            </Dialog.Description>
            <div className="sv4-unbox-art">
              <GiftVisual rewardId={opened?.reward.id} cost={opened?.reward.cost} />
            </div>
            <h3>{opened?.reward.name}</h3>
            {awardedOption && <p className="sv3-unbox-reward">{awardedOption.name}</p>}
            <p className="sv3-unbox-quote">
              «Мур! Наш праздник стал чуточку волшебнее. Спасибо тебе!»
            </p>
            <Dialog.Close className="se-button">Ура!</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
  onSuccess: (option: string) => void;
}) {
  const suitable = state.subscriptions.filter((sub) =>
    reward.options?.some((o) => (o.kind === 'hours' ? !sub.daily : sub.traffic)),
  );
  const [subscriptionId, setSubscriptionId] = useState(suitable[0]?.id ?? 0);
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
          <GiftVisual rewardId={reward.id} cost={reward.cost} className="sv4-gift-dialog-art" />
          <Dialog.Description>Один подарок на выбор. {reward.description}</Dialog.Description>
          {suitable.length > 1 && (
            <label className="snow-field">
              К какой подписке добавить
              <select
                value={subscriptionId}
                disabled={busy}
                onChange={(e) => {
                  setSubscriptionId(Number(e.target.value));
                  setOption('hours');
                }}
              >
                {suitable.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!!reward.options?.length && (
            <>
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
              Трафик действует 30 дней. При смене тарифа неиспользованный остаток сгорит.
            </p>
          )}
          {option === 'hours' && <p>Время прибавится к сроку подписки. Деньги не спишутся.</p>}
          {!!reward.snow && (
            <p>Ещё +{reward.snow} снежинок в кошелёк. Общая цель от этого бонуса не увеличится.</p>
          )}
          <p className="snow-purchase-total">
            <span>Спишем снежинок</span>
            <strong>{reward.cost} ❄</strong>
          </p>
          {giftState(state, reward) !== 'available' && (
            <p className="sw-fine-print">
              {giftState(state, reward) === 'insufficient'
                ? `Не хватает ${Math.max(0, reward.cost - state.progress.balance)} снежинок.`
                : giftState(state, reward) === 'subscription'
                  ? 'Для получения нужна активная подписка.'
                  : giftState(state, reward) === 'owned'
                    ? 'Этот подарок уже получен. Его можно найти в истории.'
                    : giftState(state, reward) === 'delivery'
                      ? 'Этот подарок уже оформлен и доставляется.'
                      : giftState(state, reward) === 'personal'
                        ? `Откроется после ${gameDays(reward.threshold || 0)}.`
                        : giftState(state, reward) === 'community'
                          ? `Общая цель: ${reward.threshold} ❄. Нужно заработать 100 личных снежинок.`
                          : giftState(state, reward) === 'closed'
                            ? state.phase === 'finished'
                              ? 'Обмен подарков завершён.'
                              : 'Лавка откроется 1 декабря.'
                            : 'Для этой подписки нет подходящего варианта.'}
            </p>
          )}
          {error && (
            <p role="alert" className="snow-error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="se-button"
            disabled={busy || !valid || giftState(state, reward) !== 'available'}
            onClick={async () => {
              if (lock.current || giftState(state, reward) !== 'available') return;
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
                onSuccess(option);
                onClose();
              } catch (e) {
                setError(snowError(e));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? 'Выдаём подарок…' : 'Подтвердить получение'}
          </button>
          <button type="button" className="sw-small-button" disabled={busy} onClick={onClose}>
            Отмена
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
