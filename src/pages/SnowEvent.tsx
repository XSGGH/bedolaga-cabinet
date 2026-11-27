import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { snowApi, snowError, type SnowGame as Game } from '@/api/snowEvent';
import { useServerNow, useSnowEvent, timeUntil } from '@/components/snow-event/useSnowEvent';
import { nextBoundary, hasSubscription } from '@/components/snow-event/snowPresentation';
import { PreviewBar } from '@/components/snow-event/SnowEventControls';
import {
  SnowCalendar,
  SnowSubscription,
  SnowWallet,
} from '@/components/snow-event/SnowEventSections';
import SnowWorldScene, { StationSprite } from '@/components/snow-event/SnowWorldScene';
import SnowWorldGames from '@/components/snow-event/SnowWorldGames';
import SnowWorldRewards, { QuazarJourney } from '@/components/snow-event/SnowWorldRewards';
import SnowWorldCelebration from '@/components/snow-event/SnowWorldCelebration';
import SnowWorldParticipation from '@/components/snow-event/SnowWorldParticipation';
import { catSays, snowChapters } from '@/components/snow-event/snowDialogue';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';
import '@/components/snow-event/snow-world.css';

export default function SnowEvent() {
  const { previewId } = useParams();
  const query = useSnowEvent(previewId);
  const now = useServerNow(query.data?.server_now, query.dataUpdatedAt);
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const acting = useRef(false);
  const previous = useRef('');
  const boundaryFetched = useRef('');
  const visitRequested = useRef('');
  const state = query.data;
  const signature = `${previewId}/${state?.today}/${state?.subscription}/${state?.phase}`;
  const { refetch } = query;
  useEffect(() => {
    if (previous.current !== signature) {
      setGame(null);
      setError('');
    }
    previous.current = signature;
  }, [signature]);
  const boundary = state ? nextBoundary(state) : undefined;
  useEffect(() => {
    if (
      !previewId &&
      boundary &&
      now >= Date.parse(boundary) &&
      boundaryFetched.current !== boundary
    ) {
      boundaryFetched.current = boundary;
      void refetch();
    }
  }, [boundary, now, previewId, refetch]);
  const act = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      if (acting.current) return;
      acting.current = true;
      setBusy(true);
      setError('');
      try {
        const result = await snowApi.action<Game>(action, body, previewId);
        if (action === 'start') setGame(result);
        await refetch();
      } catch (e) {
        setError(snowError(e));
      } finally {
        acting.current = false;
        setBusy(false);
      }
    },
    [previewId, refetch],
  );
  useEffect(() => {
    if (
      !state?.world ||
      state.phase !== 'active' ||
      !hasSubscription(state) ||
      state.progress.days[state.today]?.checkin
    )
      return;
    const key = `${previewId || 'real'}/${state.today}/${state.subscription}`;
    if (visitRequested.current === key) return;
    visitRequested.current = key;
    void act('visit');
  }, [state, previewId, act]);
  if (!state)
    return (
      <div className="snow-page snow-experience snow-world-experience">
        <section className="se-panel">
          <h1>Снежный переполох</h1>
          <p role="status">
            {query.isError ? 'Не удалось связаться со станцией.' : 'Приближаемся к зимней станции…'}
          </p>
          {query.isError && (
            <button type="button" className="se-button" onClick={() => refetch()}>
              Попробовать снова
            </button>
          )}
        </section>
      </div>
    );
  if (!state.world || !state.rules)
    return (
      <div className="snow-page snow-experience">
        <section className="se-panel">
          <h1>Снежный переполох</h1>
          <p role="alert">
            Сервер мероприятия ещё не обновлён до совместной станции. Нужен совместный деплой API и
            кабинета; текущие подписки сохранены.
          </p>
        </section>
      </div>
    );
  const today = state.progress.days[state.today] || {};
  const active = state.phase === 'active';
  const upcoming = state.phase === 'upcoming';
  const time = timeUntil(
    upcoming ? state.starts_at : state.day_ends_at || state.shop_at,
    previewId ? Date.parse(state.server_now) : now,
  );
  const chapter = Math.min(3, Math.max(0, Math.floor((Number(state.today.slice(-2)) - 1) / 7)));
  const daily = (
    <section className="se-panel sw-daily-card">
      <p className="se-kicker">
        {today.game ? 'Сегодня мы уже помогли коту' : 'Маленькое приключение на сегодня'}
      </p>
      <h2>{today.game ? 'Задание выполнено' : state.game?.name || 'Задание дня'}</h2>
      <p>
        {today.game
          ? 'Снежинки сохранены. Можно рассмотреть станцию, поставить украшение или выбрать подарок.'
          : 'Короткая игра на 15–30 секунд. За успешный раунд — гарантированные 15 снежинок.'}
      </p>
      {!hasSubscription(state) ? (
        <SnowSubscription state={state} />
      ) : today.game ? (
        <div className="sw-done-line">
          <StationSprite index={15} />
          <span>✓ Декабрь стал чуточку уютнее</span>
        </div>
      ) : (
        <button
          type="button"
          className="se-button"
          disabled={busy}
          onClick={() => void act('start')}
        >
          {busy ? 'Готовим приключение…' : 'Помочь коту · +15 снежинок'}
        </button>
      )}
      <p className="sw-fine-print">
        {today.checkin
          ? '✓ +5 снежинок за сегодняшний визит уже в копилке.'
          : hasSubscription(state)
            ? 'За первый визит дня кот добавит ещё 5 снежинок.'
            : 'Просматривать станцию, подарки и правила можно без подписки.'}
      </p>
      <p className="sw-day-timer">
        До конца игрового дня: {time.hours} ч {time.minutes} мин · МСК
      </p>
    </section>
  );
  return (
    <div className={`snow-page snow-experience snow-world-experience sw-phase-${state.phase}`}>
      {previewId && (
        <PreviewBar
          state={state}
          onChange={() => {
            setGame(null);
            visitRequested.current = '';
            void refetch();
          }}
        />
      )}
      <div className="se-page-top">
        <Link to={previewId ? '/admin/snow-event' : '/'}>
          ← {previewId ? 'Управление мероприятием' : 'На главную'}
        </Link>
        <span>1 декабря — 7 января · 2026 / 27</span>
      </div>
      <header className="sw-page-heading">
        <div>
          <p className="se-kicker">
            {active
              ? `Глава ${chapter + 1} · ${snowChapters[chapter]}`
              : upcoming
                ? 'Совсем скоро — наша общая зимняя история'
                : state.phase === 'finished'
                  ? 'Праздник, который мы построили вместе'
                  : 'Ещё немного времени для подарков'}
          </p>
          <h1>
            <span>Снежный</span> <span>переполох</span>
          </h1>
          <p>{catSays(state)}</p>
        </div>
        <StationSprite index={15} />
      </header>
      {upcoming && (
        <div className="sw-announcement-date">
          <strong>Начнём 1 декабря · 00:00 МСК</strong>
          <div
            role="timer"
            aria-label={`До старта ${time.days} дней ${time.hours} часов ${time.minutes} минут`}
          >
            <b>{String(time.days).padStart(2, '0')}</b>
            <span>дн.</span>
            <i>:</i>
            <b>{String(time.hours).padStart(2, '0')}</b>
            <span>ч.</span>
            <i>:</i>
            <b>{String(time.minutes).padStart(2, '0')}</b>
            <span>мин.</span>
            <i>:</i>
            <b>{String(time.seconds).padStart(2, '0')}</b>
            <span>сек.</span>
          </div>
        </div>
      )}
      {(error || query.isError) && (
        <p className="se-error" role="alert">
          {error || 'Не удалось обновить станцию. Показываем последнее сохранённое состояние.'}
          <button type="button" onClick={() => refetch()}>
            Обновить
          </button>
        </p>
      )}
      <div className={active ? 'sw-station-and-game' : ''}>
        <SnowWorldScene
          state={state}
          onSeen={() => {
            if (active && hasSubscription(state)) void act('visit');
          }}
        />
        {active && (
          <aside className="sw-player-sidebar">
            {daily}
            <SnowWallet state={state} />
          </aside>
        )}
      </div>
      {!upcoming && <SnowWorldCelebration state={state} />}
      {upcoming ? (
        <>
          <section className="se-panel sw-about-adventure">
            <p className="se-kicker">Маленькие дела — большой праздник</p>
            <h2>В декабре построим целую зимнюю станцию</h2>
            <div className="se-features">
              {[
                ['10 разных игр', 'Каждый день — новое короткое задание. Без случайной награды.'],
                [
                  '25 общих этапов',
                  'Зажжём огни, поставим ёлку, встретим котов-гостей и раскрасим небо.',
                ],
                [
                  'Твоё украшение',
                  'За личный вклад можно оставить на станции фонарик, звезду или подарок.',
                ],
                ['Путь к Квазару', '26 игровых дней откроют постоянное право на особый тариф.'],
              ].map(([name, text]) => (
                <div key={name}>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </section>
          <SnowSubscription state={state} />
          <QuazarJourney state={state} preview={previewId} refresh={() => void refetch()} />
        </>
      ) : (
        <>
          {!active && <SnowWallet state={state} />}
          <div className="sw-personal-grid">
            <QuazarJourney state={state} preview={previewId} refresh={() => void refetch()} />
            <SnowCalendar state={state} />
          </div>
          <SnowWorldParticipation
            state={state}
            busy={busy}
            act={(action, body) => void act(action, body)}
          />
        </>
      )}
      {upcoming ? (
        <details className="se-panel se-details">
          <summary>Какие подарки подготовил кот?</summary>
          <SnowWorldRewards state={state} preview={previewId} refresh={() => void refetch()} />
        </details>
      ) : (
        <SnowWorldRewards state={state} preview={previewId} refresh={() => void refetch()} />
      )}
      {state.progress.receipts.length > 0 && (
        <details className="se-panel se-details">
          <summary>Мои полученные подарки · {state.progress.receipts.length}</summary>
          <ul className="sw-history">
            {state.progress.receipts.map((receipt) => (
              <li key={receipt.id}>
                <strong>{receipt.name}</strong>
                <span>
                  {receipt.test
                    ? 'Тестовый подарок'
                    : receipt.status === 'sync_pending'
                      ? 'Доставляем'
                      : 'Получено'}{' '}
                  · {receipt.cost} ❄
                </span>
                {receipt.test && receipt.after_end && (
                  <span>
                    Тестовый срок до{' '}
                    {new Date(receipt.after_end).toLocaleString('ru-RU', {
                      timeZone: 'Europe/Moscow',
                    })}{' '}
                    МСК
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="se-panel se-details sw-rules">
        <summary>Правила и честная экономика праздника</summary>
        <h3>Когда играем</h3>
        <p>
          1–31 декабря — ежедневные задания. 1–7 января — магазин без новых игр. С 8 января — итоги
          и созданная станция. Время определяет сервер, часовой пояс — Москва.
        </p>
        <h3>Снежинки</h3>
        <p>
          5 за ежедневный визит, 15 за успешную игру. Пять игр за неделю 1–7, 8–14, 15–21 или 22–28
          декабря — ещё 25. Базовый максимум — 720. Награды гарантированы, не случайны.
        </p>
        <h3>Совместная станция</h3>
        <p>
          Основная цель — 1 500, дополнительные этапы до 5 000. Все 25 целей опубликованы заранее.
          Покупки не уменьшают вклад, коллективные бонусы не запускают повторное продвижение.
          Нажатия на декорации снежинок не дают.
        </p>
        <h3>Квазар</h3>
        <p>
          Нужно выполнить 26 уникальных игровых дней из 31. Пять пропусков допустимы; купить
          пропущенный день нельзя. Постоянное право на тариф закрепляется за аккаунтом. Оформление —
          с 31 декабря: 180 ₽ за 30 дней, 5 устройств, 250 ГБ на специальных серверах и сохранённый
          доступ к безлимитным. Текущая подписка автоматически не меняется.
        </p>
        <h3>Подарки и подписка</h3>
        <p>
          Для игр и получения подарков нужна активная подписка любого тарифа. После её окончания
          прогресс сохраняется. Каждый набор и промежуточный подарок выдаётся один раз, выбирается
          только один вариант. Время добавляется к уже оплаченному сроку без списания денег.
          Бонусный трафик — тарифам со специальными серверами с лимитом, на 30 дней. При смене
          тарифа пакеты трафика сгорают по действующим правилам — это также указано перед выбором.
          Снежинки нельзя вывести деньгами.
        </p>
        <h3>Если сломался сервис</h3>
        <p>
          Неудачную попытку можно повторить. При подтверждённом инциденте администратор может
          восстановить конкретный игровой день с записью в аудит. Обычные пропуски не компенсируются
          автоматически.
        </p>
      </details>
      <Dialog.Root
        open={!!game}
        onOpenChange={(open) => {
          if (!open) setGame(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-game-modal sw-game-modal">
            <Dialog.Title className="se-sr-only">{game?.name || 'Приключение дня'}</Dialog.Title>
            <Dialog.Description className="se-sr-only">
              Мини-игра с проверкой действий и награды на сервере.
            </Dialog.Description>
            {previewId && <div className="se-game-preview">🧪 Тестовый мир · {state.today}</div>}
            {error && (
              <p role="alert" className="snow-error">
                {error}
              </p>
            )}
            {game && (
              <SnowWorldGames
                key={game.id}
                game={game}
                preview={previewId}
                onClose={() => setGame(null)}
                onComplete={() => void refetch()}
                onRetry={() => void act('start')}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
