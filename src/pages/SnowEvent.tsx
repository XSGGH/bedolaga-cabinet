import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  snowApi,
  snowDates,
  snowError,
  subscriptionLabels,
  type SnowGame as Game,
  type SnowReward,
  type SnowState,
  type SubscriptionScenario,
} from '@/api/snowEvent';
import { timeUntil, useServerNow, useSnowEvent } from '@/components/snow-event/useSnowEvent';
import SnowGame from '@/components/snow-event/SnowGame';
import { useNativeDialog } from '@/platform';
import '@/components/snow-event/snow-event.css';

export default function SnowEvent() {
  const { previewId } = useParams();
  const query = useSnowEvent(previewId);
  const now = useServerNow(query.data?.server_now, query.dataUpdatedAt);
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reward, setReward] = useState<SnowReward | null>(null);
  const previousScenario = useRef('');
  const refresh = () => query.refetch();
  const state = query.data;
  const signature = `${state?.today}/${state?.subscription}/${state?.phase}`;
  useEffect(() => {
    if (previousScenario.current && previousScenario.current !== signature) setGame(null);
    previousScenario.current = signature;
  }, [signature]);
  const boundary =
    state?.phase === 'upcoming'
      ? state.starts_at
      : state?.phase === 'active'
        ? state.shop_at
        : state?.ends_at;
  // A page left open overnight must ask the server at the boundary itself.
  const boundaryFetched = useRef('');
  useEffect(() => {
    if (
      !previewId &&
      boundary &&
      now >= Date.parse(boundary) &&
      boundaryFetched.current !== boundary
    ) {
      boundaryFetched.current = boundary;
      void query.refetch();
    }
  }, [boundary, now, previewId, query]);
  const act = async (action: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await snowApi.action<Game>(action, {}, previewId);
      if (action === 'start') setGame(result);
      await refresh();
    } catch (e) {
      setError(snowError(e));
    } finally {
      setBusy(false);
    }
  };
  if (!state)
    return (
      <div className="snow-page snow-card">
        <h1>Снежный переполох</h1>
        <p role="status">
          {query.isError ? 'Не удалось загрузить событие.' : 'Готовим зимнее приключение…'}
        </p>
        {query.isError && (
          <button type="button" className="snow-button" onClick={() => refresh()}>
            Попробовать снова
          </button>
        )}
      </div>
    );
  const canPlay = ['active', 'renewed'].includes(state.subscription) && state.phase === 'active';
  const today = state.progress.days[state.today] || {};
  const count = timeUntil(state.starts_at, previewId ? Date.parse(state.server_now) : now);
  const completed = Object.values(state.progress.days).filter((day) => day.game).length;
  const globalPercent = Math.min(100, Math.floor((state.global_earned / state.goal) * 100));
  const scene = state.phase === 'upcoming' ? 4 : Math.floor(globalPercent / 25);
  return (
    <div className="snow-page">
      {previewId && (
        <PreviewBar
          state={state}
          onChange={() => {
            setGame(null);
            void refresh();
          }}
        />
      )}
      <div className="snow-page-heading">
        <Link to={previewId ? '/admin/snow-event' : '/'} className="snow-back">
          ← {previewId ? 'К управлению событием' : 'На главную'}
        </Link>
        <span className="snow-eyebrow">ЗИМА НА ОРБИТЕ · 2026 / 27</span>
      </div>
      <section className={`snow-hero snow-scene-${scene}`}>
        <img
          src="/xsg-snow-assets/winter-base.webp"
          alt="Белый кот-космонавт XSG в фиолетовом шлеме собирает снежинки у праздничного дата-центра"
          width="1536"
          height="1024"
          fetchPriority="high"
        />
        {scene >= 1 && (
          <img
            className="snow-decoration snow-decoration-lights"
            src="/xsg-snow-assets/winter-hero.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        {scene >= 2 && (
          <img
            className="snow-decoration snow-decoration-tree"
            src="/xsg-snow-assets/winter-hero.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        {scene >= 3 && (
          <img
            className="snow-decoration snow-decoration-gifts"
            src="/xsg-snow-assets/winter-hero.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        {scene >= 4 && (
          <img
            className="snow-decoration snow-decoration-finale"
            src="/xsg-snow-assets/winter-hero.webp"
            alt=""
            aria-hidden="true"
          />
        )}
        <div className="snow-flurry" aria-hidden="true" />
        <div className="snow-hero-copy">
          <span className="snow-season-label">❄ Зимнее событие XSG VPN</span>
          <h1>
            Снежный
            <br />
            переполох
          </h1>
          <p>
            {state.phase === 'finished'
              ? 'Праздник завершён. Спасибо, что зажигали эту зиму вместе с нами!'
              : 'Поможем коту XSG зажечь праздник: ловите снежинки, украшайте дата-центр и забирайте подарки.'}
          </p>
          {state.phase === 'upcoming' ? (
            <div className="snow-countdown" aria-label="До начала события">
              {[
                ['дней', count.days],
                ['часов', count.hours],
                ['минут', count.minutes],
                ['секунд', count.seconds],
              ].map(([label, n]) => (
                <span key={label}>
                  <strong>{String(n).padStart(2, '0')}</strong>
                  <small>{label}</small>
                </span>
              ))}
            </div>
          ) : (
            <span className="snow-hero-date">
              {state.phase === 'active'
                ? 'Игры открыты до 31 декабря включительно'
                : state.phase === 'shop_only'
                  ? 'Магазин открыт до 7 января включительно'
                  : 'До встречи в следующем приключении'}
            </span>
          )}
          {state.phase === 'upcoming' && (
            <small>Старт 1 декабря, 00:00 МСК · Игры каждый день</small>
          )}
        </div>
      </section>
      {state.subscription === 'none' || state.subscription === 'expired' ? (
        <section className="snow-access snow-card">
          <span className="snow-access-icon" aria-hidden="true">
            {state.subscription === 'expired' ? '◷' : '✧'}
          </span>
          <div>
            <h2>
              {state.subscription === 'expired'
                ? 'Ваше приключение подождёт'
                : 'В праздник — с подпиской XSG'}
            </h2>
            <p>
              {state.subscription === 'expired'
                ? `Прогресс сохранён: ${state.progress.balance} снежинок. Продлите подписку, чтобы снова играть и получать подарки в период события.`
                : 'Участвовать можно с действующей подпиской любого тарифа. Выберите свою — и присоединяйтесь к зимнему приключению.'}
            </p>
          </div>
          <Link className="snow-button" to="/subscription/purchase">
            {state.subscription === 'expired' ? 'Продлить подписку' : 'Выбрать подписку'}
          </Link>
        </section>
      ) : null}
      {state.phase !== 'upcoming' && (
        <div className="snow-stats">
          <div>
            <small>Можно потратить</small>
            <strong>❄ {state.progress.balance}</strong>
          </div>
          <div>
            <small>Собрано за событие</small>
            <strong>
              {state.progress.earned}
              <span> / 545</span>
            </strong>
          </div>
          <div>
            <small>Дней с заданием</small>
            <strong>
              {completed}
              <span> / 31</span>
            </strong>
          </div>
        </div>
      )}
      {error && (
        <p className="snow-error" role="alert">
          {error}
        </p>
      )}
      {state.phase === 'active' && (
        <section className="snow-daily-grid">
          <div className="snow-card snow-daily">
            <p className="snow-eyebrow">ЕЖЕДНЕВНЫЙ ПРИВЕТ</p>
            <h2>Согрейте орбиту</h2>
            <p className="snow-muted">
              Заходите каждый день — кот XSG приготовил для вас 5 снежинок.
            </p>
            <button
              type="button"
              disabled={!canPlay || today.checkin || busy}
              className="snow-button snow-secondary"
              onClick={() => act('checkin')}
            >
              {today.checkin ? '✓ Сегодня уже получено' : 'Забрать 5 снежинок'}
            </button>
          </div>
          <div className="snow-card snow-daily snow-daily-game">
            <p className="snow-eyebrow">МИНИ-ИГРА · 20 СЕКУНД</p>
            <h2>
              Снежный сбор <span aria-hidden="true">✧</span>
            </h2>
            <p className="snow-muted">
              Поймайте 7 снежинок и принесите празднику ещё 10. Пять игр за неделю — бонус 20!
            </p>
            <button
              type="button"
              disabled={!canPlay || today.game || busy || !!game}
              className="snow-button"
              onClick={() => act('start')}
            >
              {today.game ? '✓ Задание выполнено' : busy ? 'Готовимся…' : 'Играть · +10 снежинок'}
            </button>
          </div>
        </section>
      )}
      {game && canPlay && (
        <SnowGame
          key={game.id}
          game={game}
          preview={previewId}
          onComplete={() => {
            void refresh();
          }}
          onClose={() => {
            setGame(null);
            void refresh();
          }}
        />
      )}
      {state.phase === 'shop_only' && (
        <p className="snow-note">
          Ежедневные игры завершились. Ваши снежинки ждут в магазине до 7 января — выберите подарок!
        </p>
      )}
      <div className="snow-main-grid">
        <section className="snow-card snow-community">
          <p className="snow-eyebrow">ПРАЗДНИК СОЗДАЁМ ВМЕСТЕ</p>
          <h2>{globalPercent >= 100 ? 'Дата-центр сияет!' : 'Зажжём зимнюю орбиту'}</h2>
          <p className="snow-muted">
            Каждая заработанная снежинка приближает общую цель. Покупки не уменьшают вклад.
          </p>
          <div className="snow-goal-numbers">
            <strong>{state.global_earned.toLocaleString('ru-RU')} ❄</strong>
            <span>из {state.goal.toLocaleString('ru-RU')}</span>
          </div>
          <progress max="100" value={globalPercent} aria-label="Общая цель события" />
          <div className="snow-milestones">
            {[
              ['25', 'Гирлянды'],
              ['50', 'Ёлка'],
              ['75', 'Подарки'],
              ['100', 'Праздник!'],
            ].map(([p, label]) => (
              <span className={globalPercent >= Number(p) ? 'is-lit' : ''} key={p}>
                <i aria-hidden="true">{globalPercent >= Number(p) ? '✦' : '◇'}</i>
                {p}%<small>{label}</small>
              </span>
            ))}
          </div>
          <p className="snow-muted">
            {globalPercent >= 100
              ? 'Общая цель достигнута — все огни праздника зажжены. Вы часть этой истории.'
              : globalPercent >= 75
                ? 'Подарки уже под ёлкой. Ещё немного до праздничного финала!'
                : globalPercent >= 50
                  ? 'Ёлка готова! Продолжаем собирать снежинки для подарков.'
                  : globalPercent >= 25
                    ? 'Гирлянды загорелись. Следующая остановка — праздничная ёлка.'
                    : 'Начнём с первой гирлянды. Вместе получится ярче.'}
          </p>
        </section>
        <section className="snow-card snow-calendar">
          <div className="snow-section-title">
            <div>
              <p className="snow-eyebrow">31 ДЕНЬ ПРИКЛЮЧЕНИЙ</p>
              <h2>Декабрь</h2>
            </div>
            <span className="snow-muted">{state.progress.weeks.length} / 4 бонуса</span>
          </div>
          <div className="snow-calendar-grid">
            {Array.from({ length: 31 }, (_, i) => {
              const key = `2026-12-${String(i + 1).padStart(2, '0')}`;
              const day = state.progress.days[key];
              const status = day?.game
                ? 'done'
                : key === state.today
                  ? 'today'
                  : key > state.today
                    ? 'future'
                    : 'missed';
              const text =
                status === 'done'
                  ? 'Задание выполнено'
                  : status === 'today'
                    ? 'Сегодня'
                    : status === 'future'
                      ? 'Впереди'
                      : 'День прошёл';
              return (
                <span
                  key={key}
                  className={`snow-calendar-day ${status}`}
                  aria-label={`${i + 1} декабря: ${text}${day?.checkin ? ', ежедневный подарок получен' : ''}`}
                  title={`${text}${day?.checkin ? ' · +5 получено' : ''}`}
                >
                  {status === 'done' ? '✓' : i + 1}
                  {day?.checkin && <i aria-hidden="true" />}
                </span>
              );
            })}
          </div>
          <div className="snow-calendar-legend">
            <span>◌ Впереди</span>
            <span>◉ Сегодня</span>
            <span>✓ Выполнено</span>
            <span>— Пропущено</span>
          </div>
          <p className="snow-muted">
            Бонус +20 за 5 игр: 1–7, 8–14, 15–21 и 22–28 декабря. Пропущенные дни не обнуляют
            прогресс.
          </p>
        </section>
      </div>
      <section className="snow-shop" aria-labelledby="snow-shop-title">
        <div className="snow-section-title">
          <div>
            <p className="snow-eyebrow">СНЕЖИНКИ ПРЕВРАЩАЮТСЯ В ПОДАРКИ</p>
            <h2 id="snow-shop-title">Магазин зимних находок</h2>
          </div>
          <span className="snow-muted">Каждая награда — один раз</span>
        </div>
        <div className="snow-shop-grid">
          {state.rewards.map((item) => {
            const owned = state.progress.receipts.some((r) => r.reward_id === item.id);
            const unavailable =
              (state.phase !== 'active' && state.phase !== 'shop_only') ||
              !['active', 'renewed'].includes(state.subscription);
            const incompatible =
              item.kind === 'days'
                ? !state.subscriptions.some((s) => !s.daily)
                : item.kind === 'traffic' && !state.subscriptions.some((s) => s.traffic);
            return (
              <article className="snow-card snow-reward" key={item.id}>
                <div className={`snow-reward-art snow-art-${item.kind}`} aria-hidden="true">
                  {item.kind === 'badge'
                    ? '✦'
                    : item.kind === 'decoration'
                      ? '◌'
                      : item.kind === 'traffic'
                        ? '↟'
                        : `+${item.value}`}
                </div>
                <h3>{item.name}</h3>
                <p className="snow-muted">{item.description}</p>
                <strong>{item.cost} ❄</strong>
                <button
                  type="button"
                  className="snow-button snow-secondary"
                  disabled={
                    owned || unavailable || incompatible || state.progress.balance < item.cost
                  }
                  onClick={() => setReward(item)}
                >
                  {owned
                    ? '✓ Получено'
                    : state.phase === 'upcoming'
                      ? 'С 1 декабря'
                      : state.phase === 'finished'
                        ? 'Событие завершено'
                        : unavailable
                          ? 'Нужна подписка'
                          : incompatible
                            ? item.kind === 'days'
                              ? 'Для подписки со сроком'
                              : 'Для тарифа с лимитом'
                            : state.progress.balance < item.cost
                              ? `Не хватает ${item.cost - state.progress.balance} ❄`
                              : 'Обменять'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      {state.progress.receipts.length > 0 && (
        <section className="snow-card">
          <h2>Ваши зимние подарки</h2>
          <div className="snow-history">
            {state.progress.receipts.map((r) => (
              <div key={r.id}>
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {new Intl.DateTimeFormat('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      timeZone: 'Europe/Moscow',
                    }).format(new Date(r.at))}
                    {r.test
                      ? ' · Тестовая выдача'
                      : r.status === 'sync_pending'
                        ? ' · Добавлено к подписке; синхронизация с VPN'
                        : ' · Получено'}
                  </small>
                </span>
                <span>−{r.cost} ❄</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <details className="snow-card snow-rules">
        <summary>
          Как устроен снежный праздник <span aria-hidden="true">＋</span>
        </summary>
        <div>
          <p>
            Игры идут с 1 по 31 декабря по московскому времени. За ежедневный вход — 5 снежинок, за
            игру — 10. Награда выдаётся один раз в день; неудачную игру можно повторить.
          </p>
          <p>
            За пять выполненных игр в каждой из первых четырёх недель — ещё 20 снежинок. Максимум за
            событие — 545. Покупки уменьшают баланс, но сохраняют ваш общий вклад.
          </p>
          <p>
            Участие доступно с действующей подпиской любого тарифа. Если она закончится, прогресс
            сохранится. После продления можно продолжать до завершения соответствующего этапа.
          </p>
          <p>
            С 1 по 7 января работает только магазин. 8 января событие завершается, неиспользованные
            снежинки больше нельзя обменять. Награды нельзя обменять на деньги. Трафик действует 30
            дней; дни добавляются к подписке с фиксированным сроком. Подписки с безлимитом и
            суточной оплатой могут выбирать подходящие им награды.
          </p>
        </div>
      </details>
      <PurchaseDialog
        reward={reward}
        state={state}
        preview={previewId}
        onClose={() => setReward(null)}
        onSuccess={() => {
          void refresh();
        }}
      />
    </div>
  );
}

function PurchaseDialog({
  reward,
  state,
  preview,
  onClose,
  onSuccess,
}: {
  reward: SnowReward | null;
  state: SnowState;
  preview?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionId, setSubscriptionId] = useState<number>(state.subscriptions[0]?.id ?? 0);
  const requestId = useRef('');
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    setError('');
    setSubscriptionId(
      state.subscriptions.find((s) =>
        reward?.kind === 'days' ? !s.daily : reward?.kind === 'traffic' ? s.traffic : true,
      )?.id ?? 0,
    );
  }, [reward, state.subscriptions]);
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
        <Dialog.Overlay className="snow-dialog-overlay" />
        <Dialog.Content
          className="snow-dialog snow-card"
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
              if (!reward) return;
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

function PreviewBar({ state, onChange }: { state: SnowState; onChange: () => void }) {
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
