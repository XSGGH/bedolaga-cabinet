import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { LuGift, LuGamepad2, LuHouse, LuRoute } from 'react-icons/lu';
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
import { catSays } from '@/components/snow-event/snowDialogue';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';
import '@/components/snow-event/snow-world.css';
import '@/components/snow-event/snow-village.css';

const winterTabs = [
  { id: 'station', label: 'Станция', Icon: LuHouse },
  { id: 'games', label: 'Игры', Icon: LuGamepad2 },
  { id: 'gifts', label: 'Подарки', Icon: LuGift },
  { id: 'journey', label: 'Мой путь', Icon: LuRoute },
] as const;
type WinterTab = (typeof winterTabs)[number]['id'];

export default function SnowEvent() {
  const { previewId } = useParams();
  const query = useSnowEvent(previewId);
  const now = useServerNow(query.data?.server_now, query.dataUpdatedAt);
  const [tab, setTab] = useState<WinterTab>('station');
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
      if (acting.current) return false;
      acting.current = true;
      setBusy(true);
      setError('');
      try {
        const result = await snowApi.action<Game>(action, body, previewId);
        if (action === 'start') setGame(result);
        await refetch();
        return true;
      } catch (e) {
        setError(snowError(e));
        return false;
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
            На станции идут приготовления. Загляни чуть позже — твоя подписка и прогресс сохранены.
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
  const daily = (
    <section className="se-panel sw-daily-card">
      <p className="se-kicker">
        {today.game ? 'Сегодня мы уже помогли коту' : 'Маленькое приключение на сегодня'}
      </p>
      <h2>{today.game ? 'Задание выполнено' : state.game?.name || 'Задание дня'}</h2>
      <p>
        {today.game
          ? 'Снежинки сохранены. Можно рассмотреть станцию, поставить украшение или выбрать подарок.'
          : catSays(state)}
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
          {busy ? 'Готовим приключение…' : 'Играть · +15 снежинок'}
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
  const changeTab = (next: WinterTab) => {
    setTab(next);
    document.getElementById('winter-tabs')?.scrollIntoView({ block: 'start' });
  };
  return (
    <div className={`snow-page snow-experience snow-world-experience snow-village sv3-phase-${state.phase}`}>
      {previewId&&<PreviewBar state={state} onChange={()=>{setGame(null);visitRequested.current='';void refetch();}}/>}
      <header className="sv3-page-header"><Link to={previewId?'/admin/snow-event':'/'} aria-label={previewId?'Вернуться в управление мероприятием':'Вернуться на главную'}>←</Link><div><h1>Снежный переполох</h1><p>{upcoming?'Вместе создадим маленькое зимнее чудо':state.phase==='finished'?'Праздник, который мы построили вместе':'Наша маленькая зимняя история'}</p></div><span className="sv3-header-season">XSG · 2026/27</span></header>
      <nav id="winter-tabs" className="sv3-tabs" role="tablist" aria-label="Разделы зимнего события">
        {winterTabs.map(({ id, label, Icon }, index) => (
          <button
            type="button"
            key={id}
            id={`winter-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`winter-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => changeTab(id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowRight') next = (index + 1) % winterTabs.length;
              else if (event.key === 'ArrowLeft') next = (index + winterTabs.length - 1) % winterTabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = winterTabs.length - 1;
              else return;
              event.preventDefault();
              setTab(winterTabs[next].id);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}
          >
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {(error||query.isError)&&<div className="se-error" role="alert">{error||'Не удалось обновить станцию. Показываем последнее сохранённое состояние.'}<button type="button" onClick={()=>{visitRequested.current='';void refetch();}}>Повторить</button></div>}
      {!hasSubscription(state)&&<div className="sv3-subscription-note"><p>{state.subscription==='expired'?'Подписка закончилась. Снежинки, подарки и весь твой путь сохранены.':'Станция открыта для прогулок. Для игр и подарков понадобится активная подписка.'}</p><Link to="/subscription">{state.subscription==='expired'?'Продлить подписку':'Выбрать подписку'} ↗</Link></div>}
      <section key={signature} className={`sv3-tab-panel sv3-panel-${tab}`} role="tabpanel" id={`winter-panel-${tab}`} aria-labelledby={`winter-tab-${tab}`} tabIndex={0}>
        {tab==='station'&&<>
          {upcoming&&<div className="sv3-countdown"><span>Начнём 1 декабря · 00:00 МСК</span><strong role="timer">{time.days} дн. {String(time.hours).padStart(2,'0')}:{String(time.minutes).padStart(2,'0')}:{String(time.seconds).padStart(2,'0')}</strong></div>}
          <SnowWorldScene state={state} busy={busy} act={act} onPlay={()=>changeTab('games')} onSeen={()=>{if(active&&hasSubscription(state))void act('visit');}}/>
          {!upcoming && <SnowWorldCelebration state={state} />}
        </>}
        {tab==='games'&&<div className="sv3-games-layout"><div>
          {active?daily:<section className="se-panel sv3-season-note"><StationSprite index={15}/><h2>{upcoming?'Начнём играть 1 декабря':state.phase==='shop_only'?'Игры декабря завершены':'Спасибо за нашу зимнюю историю'}</h2><p>{upcoming?'Каждый день — короткое приключение, 5 снежинок за визит и 15 за успешную игру.':state.phase==='shop_only'?'Новых ежедневных заданий уже нет. До 8 января можно выбрать подарки за собранные снежинки.':'Станция, календарь, подарки и твои достижения сохранились.'}</p>{upcoming&&<SnowSubscription state={state}/>}<button type="button" className="se-secondary" onClick={()=>changeTab(upcoming?'station':'gifts')}>{upcoming?'Вернуться на станцию':'В лавку кота'}</button></section>}
                <details className="se-panel se-details sw-rules">
        <summary>Как играть</summary>
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

        </div><SnowCalendar state={state}/></div>}
        {tab==='gifts'&&<><SnowWallet state={state}/><SnowWorldRewards state={state} preview={previewId} refresh={()=>void refetch()}/></>}
        {tab==='journey'&&<><div className="sv3-journey-layout"><QuazarJourney state={state} preview={previewId} refresh={()=>void refetch()}/><SnowCalendar state={state} showWeek={false}/></div><div className="sv3-personal-summary"><span>Твой вклад <strong>{state.progress.earned.toLocaleString('ru')} ❄</strong></span><span>Украшения <strong>{state.world.decorations.filter(d=>d.own).length} / 3</strong></span><span>Приключения <strong>{state.completed_days||0} / 31</strong></span><button type="button" onClick={()=>changeTab('station')}>К нашей станции ↗</button></div></>}
      </section>
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
