import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { snowApi, snowError, type SnowGame as Game, type SnowReward } from '@/api/snowEvent';
import { useServerNow, useSnowEvent } from '@/components/snow-event/useSnowEvent';
import { nextBoundary, number, hasSubscription } from '@/components/snow-event/snowPresentation';
import { PreviewBar, PurchaseDialog } from '@/components/snow-event/SnowEventControls';
import {
  SnowAnnouncement,
  SnowCalendar,
  SnowCommunity,
  SnowDailyActivity,
  SnowHero,
  SnowRewards,
  SnowRules,
  SnowSubscription,
  SnowWallet,
} from '@/components/snow-event/SnowEventSections';
import SnowGame from '@/components/snow-event/SnowGame';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';

export default function SnowEvent() {
  const { previewId } = useParams();
  const query = useSnowEvent(previewId);
  const now = useServerNow(query.data?.server_now, query.dataUpdatedAt);
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reward, setReward] = useState<SnowReward | null>(null);
  const previousScenario = useRef('');
  const boundaryFetched = useRef('');
  const state = query.data;
  const signature = `${previewId}/${state?.today}/${state?.subscription}/${state?.phase}`;
  useEffect(() => {
    if (previousScenario.current !== signature) {
      setGame(null);
      setReward(null);
      setError('');
      setNotice('');
    }
    previousScenario.current = signature;
  }, [signature]);
  const boundary = state ? nextBoundary(state) : undefined;
  const { refetch } = query;
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
  const act = async (action: string) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await snowApi.action<Game>(action, {}, previewId);
      if (action === 'start') setGame(result);
      if (action === 'checkin') setNotice('Кот рад тебя видеть! +5 снежинок в копилке ❄');
      await refetch();
    } catch (e) {
      setError(snowError(e));
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  if (!state)
    return (
      <div className="snow-page snow-experience">
        <section className="se-panel">
          <h1>Снежный переполох</h1>
          <p role="status">
            {query.isError ? 'Не удалось загрузить событие.' : 'Готовим зимнее приключение…'}
          </p>
          {query.isError && (
            <button type="button" className="se-button" onClick={() => refetch()}>
              Попробовать снова
            </button>
          )}
        </section>
      </div>
    );
  const calendarAndCommunity = (
    <div className="se-adventure-grid">
      <SnowCalendar state={state} />
      <SnowCommunity state={state} />
    </div>
  );
  const shop = (
    <section className="se-panel se-shop" aria-labelledby="se-shop-title">
      <div className="se-section-heading">
        <div>
          <p className="se-kicker">Выбирай с теплом</p>
          <h2 id="se-shop-title">Подарки под ёлкой</h2>
        </div>
        <span className="se-pill">{number(state.progress.balance)} ❄</span>
      </div>
      <p>
        {state.phase === 'finished'
          ? 'Обмен завершён. Полученные подарки сохранены в истории.'
          : 'Снежинки превращаются в приятные мелочи. Каждый подарок — один раз.'}
      </p>
      <SnowRewards state={state} onSelect={setReward} />
    </section>
  );
  return (
    <div className={`snow-page snow-experience se-phase-${state.phase}`}>
      {previewId && (
        <PreviewBar
          state={state}
          onChange={() => {
            setGame(null);
            setReward(null);
            void refetch();
          }}
        />
      )}
      <div className="se-page-top">
        <Link to={previewId ? '/admin/snow-event' : '/'}>
          ← {previewId ? 'К управлению событием' : 'На главную'}
        </Link>
        <span>Зима на орбите · 2026 / 27</span>
      </div>
      <SnowHero state={state} now={previewId ? Date.parse(state.server_now) : now} />
      {query.isError && (
        <p className="se-error" role="alert">
          Не удалось обновить данные. Показываем последний результат.{' '}
          <button type="button" onClick={() => refetch()}>
            Повторить
          </button>
        </p>
      )}
      {error && (
        <p className="se-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="se-notice" role="status">
          {notice}
        </p>
      )}
      {state.phase === 'upcoming' ? (
        <SnowAnnouncement state={state} />
      ) : (
        <>
          {state.phase === 'active' && (
            <SnowDailyActivity state={state} busy={busy} onAction={(action) => void act(action)} />
          )}
          {state.phase === 'shop_only' && !hasSubscription(state) && (
            <SnowSubscription state={state} />
          )}
          <SnowWallet state={state} />
          {state.phase === 'active' ? (
            <>
              {calendarAndCommunity}
              {shop}
            </>
          ) : (
            <>
              {shop}
              <details className="se-panel se-details">
                <summary>
                  {state.phase === 'finished'
                    ? 'Итоги приключения'
                    : 'Твой календарь и общий праздник'}
                </summary>
                {calendarAndCommunity}
              </details>
            </>
          )}
          {state.progress.receipts.length > 0 && (
            <details className="se-panel se-details">
              <summary>Мои подарки · {state.progress.receipts.length}</summary>
              <ul className="se-receipts">
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
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <SnowRules />
      {reward && (
        <PurchaseDialog
          key={reward.id}
          reward={reward}
          state={state}
          preview={previewId}
          onClose={() => setReward(null)}
          onSuccess={() => {
            setNotice('Подарок оформлен! Кот уже упаковывает его для тебя 💜');
            void refetch();
          }}
        />
      )}
      <Dialog.Root
        open={!!game}
        onOpenChange={(open) => {
          if (!open) setGame(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-game-modal">
            <Dialog.Title className="se-sr-only">Снежный сбор</Dialog.Title>
            <Dialog.Description className="se-sr-only">
              Поймай семь снежинок за двадцать секунд. Игра проверяется сервером.
            </Dialog.Description>
            {previewId && (
              <div className="se-game-preview">🧪 Тестовый предпросмотр · {state.today}</div>
            )}
            {error && (
              <p role="alert" className="snow-error">
                {error}
              </p>
            )}
            {game && (
              <SnowGame
                key={game.id}
                game={game}
                preview={previewId}
                onComplete={() => {
                  void refetch();
                }}
                onClose={() => setGame(null)}
                onRetry={() => void act('start')}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
