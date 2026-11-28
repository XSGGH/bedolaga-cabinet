import { useEffect, useRef, useState, type MouseEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link, useLocation, useSearchParams } from 'react-router';
import type { SnowChapter, SnowState } from '@/api/snowEvent';
import { PreviewBar } from './SnowEventControls';
import SnowMosaicPicture from './SnowMosaicPicture';
import SnowPairs from './SnowPairs';
import SnowWorldRewards from './SnowWorldRewards';
import { hasSubscription } from './snowPresentation';
import { useSnowPairs } from './useSnowPairs';

const tabs = [
  ['mosaics', 'Мозаики'],
  ['play', 'Играть'],
  ['gifts', 'Подарки'],
  ['mine', 'Мой путь'],
] as const;

function fragments(count: number) {
  const form = new Intl.PluralRules('ru').select(count);
  return form === 'one' ? 'фрагмент' : form === 'few' ? 'фрагмента' : 'фрагментов';
}

export default function SnowMosaics({
  state,
  preview,
  refresh,
  stale,
  previewOpen,
  setPreviewOpen,
}: {
  state: SnowState & { mosaics: NonNullable<SnowState['mosaics']> };
  preview?: string;
  refresh: () => Promise<SnowState | undefined>;
  stale: boolean;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
}) {
  const data = state.mosaics;
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab =
    tabs.find(([key]) => key === requestedTab)?.[0] ??
    (state.phase === 'shop_only' ? 'gifts' : 'mosaics');
  const view =
    params.get('view') === 'received'
      ? 'received'
      : params.get('view') === 'personal'
        ? 'personal'
        : 'shop';
  const selected = params.get('planet');
  const planets = data.chapters.filter((chapter) => chapter.kind === 'main');
  const bonuses = data.chapters.filter((chapter) => chapter.kind === 'bonus' && chapter.unlocked);
  const target = data.chapters.find((chapter) => chapter.id === data.target_id && chapter.unlocked);
  const defaultChapter =
    (preview &&
      data.chapters.find((chapter) => chapter.id === state.preview_planet && chapter.unlocked)) ||
    target ||
    planets.filter((chapter) => chapter.unlocked).slice(-1)[0];
  const chosen = data.chapters.find((chapter) => chapter.id === selected && chapter.unlocked);
  const chapter = chosen ?? defaultChapter;
  const completed = planets.filter((item) => item.story);
  const home = completed.length === 7;
  const subscribed = hasSubscription(state);
  const canPlay = state.phase === 'active' && subscribed && !!data.session_version;
  const unavailable = !data.session_version
    ? 'Игра временно недоступна. Обнови страницу чуть позже.'
    : state.phase === 'upcoming'
      ? 'Игры откроются 1 декабря в 00:00 МСК.'
      : state.phase !== 'active'
        ? 'Ежедневные игры завершены. Истории и результаты сохранены.'
        : !subscribed
          ? 'Для игры нужна активная подписка.'
          : '';
  const game = useSnowPairs(state, data, preview, tab === 'play', canPlay, refresh);
  const [story, setStory] = useState<SnowChapter | null>(null);
  const [arrival, setArrival] = useState('');
  const [routeOpen, setRouteOpen] = useState(false);
  const seen = useRef(new Set(data.chapters.filter((item) => item.story).map((item) => item.id)));
  const root = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const illustration = useRef<HTMLDivElement>(null);
  const storyTrigger = useRef<HTMLButtonElement | null>(null);
  const previousLocation = useRef({ tab, selected });

  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = { tab, selected };
    if (tab !== previous.tab) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    if (selected && selected !== previous.selected)
      illustration.current?.scrollIntoView({ block: 'start' });
  }, [tab, selected]);

  useEffect(() => {
    if ((requestedTab && !tabs.some(([key]) => key === requestedTab)) || (selected && !chosen)) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('tab', tab);
          if (!chosen) next.delete('planet');
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    }
  }, [requestedTab, selected, chosen, tab, setParams]);

  useEffect(() => {
    const header = root.current;
    const menu = nav.current;
    if (!header || !menu) return;
    const previewBar = header.querySelector<HTMLElement>('.sw-preview-container');
    const measure = () => {
      header.style.setProperty('--sm-menu-height', `${menu.offsetHeight}px`);
      header.style.setProperty(
        '--sm-preview-height',
        previewBar ? `${previewBar.offsetHeight + 8}px` : '0px',
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    if (previewBar) observer.observe(previewBar);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const item of data.chapters) {
      if (!item.story || seen.current.has(item.id)) continue;
      seen.current.add(item.id);
      setArrival(item.id);
    }
  }, [data.chapters]);
  const currentStory = data.chapters.find((item) => item.id === story?.id && item.story);

  function link(nextTab: typeof tab, options?: { planet?: string; view?: string }) {
    const next = new URLSearchParams();
    next.set('tab', nextTab);
    if (options?.planet) next.set('planet', options.planet);
    if (options?.view) next.set('view', options.view);
    return `${pathname}?${next}`;
  }

  function read(item: SnowChapter, event: MouseEvent<HTMLButtonElement>) {
    if (!item.story) return;
    storyTrigger.current = event.currentTarget;
    setStory(item);
    if (arrival === item.id) setArrival('');
  }

  const freshArrival = data.chapters.find((item) => item.id === arrival && item.story);
  const saved = !!game.saved;
  const best = Math.max(data.best, game.move?.best ?? 0);
  const canStart = canPlay && (saved || (best < 30 && data.attempts_used < 3));
  const subscriptionLabel =
    state.subscription === 'expired' ? 'Продлить подписку' : 'Оформить подписку';
  const subscriptionAction = preview ? (
    <button type="button" className="se-button" onClick={() => setPreviewOpen(true)}>
      {subscriptionLabel}
    </button>
  ) : (
    <Link className="se-button" to="/subscriptions">
      {subscriptionLabel}
    </Link>
  );
  const route = (
    <ol className="sm-route-list">
      {planets.map((item, i) => (
        <li key={item.id}>
          {item.unlocked ? (
            <Link
              to={link('mosaics', { planet: item.id })}
              aria-current={item.id === chapter?.id ? 'location' : undefined}
            >
              <span className="sm-step">{i + 1}</span>
              <span>
                <strong>{item.planet}</strong>
                <small>
                  {item.story ? 'Открыта' : item.id === target?.id ? 'Текущая' : 'Доступна'}
                </small>
              </span>
              <span className="sm-step-mark" aria-hidden="true">
                {item.story ? '✓' : '›'}
              </span>
            </Link>
          ) : (
            <div className="sm-route-locked">
              <span className="sm-step">{i + 1}</span>
              <span>
                <strong>Планета {i + 1}</strong>
                <small>{i ? `Закрыта · после главы ${i}` : 'Закрыта до старта'}</small>
              </span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <section ref={root} className="snow-page snow-experience snow-village sm-event">
      {preview && (
        <PreviewBar
          state={state}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onChange={() => {
            setStory(null);
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.delete('planet');
                return next;
              },
              { replace: true, preventScrollReset: true },
            );
          }}
        />
      )}
      <header className="sm-heading">
        <Link
          to={preview ? '/admin/snow-event' : '/'}
          aria-label={preview ? 'Вернуться в админку' : 'Вернуться в кабинет'}
        >
          ←
        </Link>
        <h1>Снежный переполох</h1>
      </header>
      <nav ref={nav} className="sm-nav" aria-label="Зимнее событие">
        {tabs.map(([key, label]) => (
          <Link key={key} to={link(key)} aria-current={tab === key ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {stale && (
        <div className="sm-note sm-update" role="status">
          <span>Не удалось обновить данные. Показан сохранённый прогресс.</span>
          <button type="button" className="se-secondary" onClick={() => void refresh()}>
            Повторить
          </button>
        </div>
      )}

      {tab === 'mosaics' && (
        <div className="sm-layout">
          <div className="sm-intro">
            <p className="sm-kicker">
              {state.phase === 'finished' ? 'Архив события' : 'Мозаики зимнего путешествия'}
            </p>
            <h2>{home ? 'Дорога домой' : (target?.planet ?? 'Путешествие Снежка')}</h2>
            <p>
              {home ? 'Уголёк найден. Наш путь отмечен огнями.' : 'Поможем Снежку найти Уголька.'}
            </p>
            {target && (
              <div className="sm-progress">
                {state.phase === 'active' && (
                  <p>
                    <strong>
                      Ещё {target.total - target.count} {fragments(target.total - target.count)}
                    </strong>{' '}
                    до открытия {target.kind === 'bonus' ? 'дополнительной истории' : 'главы'}
                  </p>
                )}
                <progress
                  max={target.total}
                  value={target.count}
                  aria-label={`Мозаика ${target.planet}`}
                />
                <small>
                  {target.count} из {target.total} открыто
                </small>
              </div>
            )}
            {canStart ? (
              <div className="sm-primary">
                <button
                  type="button"
                  className="se-button"
                  onClick={() => {
                    setParams({ tab: 'play' });
                    void game.start();
                  }}
                >
                  {saved ? 'Продолжить игру' : best > 0 ? 'Улучшить результат' : 'Играть сегодня'}
                </button>
                <p>
                  {best
                    ? 'Сегодняшний вклад учтён. Можно улучшить личный результат.'
                    : home && !target
                      ? 'Первая партия дня пополнит общий резерв. За игру можно заработать 10–30 снежинок.'
                      : 'Заверши первую игру дня и открой общий фрагмент. За игру можно заработать 10–30 снежинок и обменять их на время VPN или трафик.'}
                </p>
              </div>
            ) : !subscribed && ['active', 'shop_only'].includes(state.phase) ? (
              <div className="sm-primary">
                {subscriptionAction}
                <p>
                  {state.subscription === 'expired'
                    ? 'Твой прогресс сохранён. Подписка откроет доступ к участию.'
                    : 'Истории доступны всем. Для участия нужна подписка.'}
                </p>
              </div>
            ) : state.phase === 'active' || state.phase === 'shop_only' ? (
              <Link className="se-button" to={link('gifts')}>
                Посмотреть подарки
              </Link>
            ) : null}
          </div>

          <div className="sm-illustration" ref={illustration}>
            {freshArrival && (
              <div className="sm-arrival">
                <span role="status">Открылась история планеты {freshArrival.planet}</span>
                <button
                  type="button"
                  className="se-secondary"
                  onClick={(event) => read(freshArrival, event)}
                >
                  Читать
                </button>
              </div>
            )}
            {chapter ? (
              <>
                <div className="sm-chapter-heading">
                  <div>
                    <h3>
                      {chapter.title === target?.planet
                        ? 'Иллюстрация'
                        : chapter.title || chapter.planet}
                    </h3>
                    {chapter.caption && <p>{chapter.caption}</p>}
                    {chapter.id !== target?.id && !chapter.story && (
                      <p>
                        {chapter.count} из {chapter.total} открыто
                      </p>
                    )}
                  </div>
                  {chapter.story && (
                    <button
                      type="button"
                      className="se-secondary"
                      onClick={(event) => read(chapter, event)}
                    >
                      Прочитать историю
                    </button>
                  )}
                </div>
                <SnowMosaicPicture key={chapter.id} chapter={chapter} preview={preview} />
              </>
            ) : (
              <p className="sm-note">Первая планета откроется 1 декабря в 00:00 МСК.</p>
            )}
            {home && (
              <section className="sm-home-lights">
                <h3>Огни дороги домой</h3>
                <p>
                  Зажгли огней: <strong>{data.home_lights}</strong>. Каждый следующий огонь — пять
                  общих вкладов после финала.
                </p>
                <div aria-hidden="true">
                  {Array.from({ length: Math.min(24, data.home_lights) }, (_, i) => (
                    <span key={i}>✦</span>
                  ))}
                </div>
                {data.epilogue && (
                  <p>С Новым годом! Пусть надёжные маршруты всегда приводят туда, где тебя ждут.</p>
                )}
              </section>
            )}
          </div>

          <aside className="sm-route" aria-label="Маршрут семи планет">
            <h3 className="sm-route-desktop">Маршрут · {completed.length} из 7 открыты</h3>
            <button
              className="sm-route-toggle se-secondary"
              type="button"
              aria-expanded={routeOpen}
              aria-controls="sm-route-list"
              onClick={() => setRouteOpen(!routeOpen)}
            >
              Маршрут · {completed.length} из 7 открыты{' '}
              <span aria-hidden="true">{routeOpen ? '−' : '+'}</span>
            </button>
            <div id="sm-route-list" className="sm-route-content" data-expanded={routeOpen}>
              {route}
              {bonuses.length > 0 && (
                <details className="sm-rules">
                  <summary>Дополнительные истории</summary>
                  <ul>
                    {bonuses.map((item) => (
                      <li key={item.id}>
                        <Link to={link('mosaics', { planet: item.id })}>{item.title}</Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </aside>
          <details className="sm-prologue sm-rules">
            <summary>Как началось путешествие</summary>
            <p>
              В конце ноября Уголёк полетел помочь далёкой планете и обещал вернуться к празднику.
              Но после космической бури связь оборвалась. «Снежок, если задержусь, не переживай. Я
              обязательно вернусь. Ты только…» — и тишина.
            </p>
            <p>
              Дома остались наряженная ёлка, две чашки какао и подарок для друга. Снежок сел в
              маленький корабль XSG VPN и отправился на поиски. Поможем ему восстановить сигналы и
              собрать семь глав этой истории. Расстояние не имеет значения, когда тебя ждут.
            </p>
          </details>
        </div>
      )}
      {tab === 'play' && <SnowPairs game={game} data={data} unavailable={unavailable} />}
      {tab === 'gifts' && (
        <>
          {!subscribed && ['active', 'shop_only'].includes(state.phase) && (
            <div className="sm-note sm-update">
              <p>Для обмена снежинок нужна активная подписка.</p>
              {subscriptionAction}
            </div>
          )}
          <SnowWorldRewards
            state={state}
            preview={preview}
            refresh={() => void refresh()}
            view={view}
            changeView={(next) =>
              setParams(next === 'shop' ? { tab: 'gifts' } : { tab: 'gifts', view: next })
            }
          />
        </>
      )}
      {tab === 'mine' && (
        <section className="sm-timeline">
          <h2>Мой путь</h2>
          <dl className="sm-personal">
            <div>
              <dt>Игровых дней</dt>
              <dd>{data.personal_days.filter((day) => day.best > 0).length}</dd>
            </div>
            <div>
              <dt>Общих вкладов</dt>
              <dd>{data.personal_contributions}</dd>
            </div>
            <div>
              <dt>Снежинок заработано в игре</dt>
              <dd>{data.personal_earned}</dd>
            </div>
            <div>
              <dt>Подарков оформлено</dt>
              <dd>{state.progress.receipts.length}</dd>
            </div>
          </dl>
          {data.personal_contributions === 0 && (
            <p>Заверши первую игру, чтобы добавить вклад и начать свою историю.</p>
          )}
          {data.chapters.some((item) => data.personal_chapters[item.id] > 0 && item.unlocked) && (
            <ul className="sm-my-chapters">
              {data.chapters
                .filter((item) => data.personal_chapters[item.id] > 0 && item.unlocked)
                .map((item) => (
                  <li key={item.id}>
                    {item.planet} · {data.personal_chapters[item.id]}{' '}
                    {fragments(data.personal_chapters[item.id])}
                  </li>
                ))}
            </ul>
          )}
          {data.personal_days.length > 0 && (
            <details className="sm-rules">
              <summary>Игры по датам</summary>
              <ul>
                {data.personal_days
                  .slice()
                  .reverse()
                  .map((day) => (
                    <li key={day.date}>
                      <time dateTime={day.date}>{day.date.split('-').reverse().join('.')}</time>
                      {' · '}
                      {day.best > 0
                        ? `Лучший результат: ${day.best} ❄`
                        : day.date === state.today && saved
                          ? 'Партия сохранена'
                          : 'Игра не завершена'}
                    </li>
                  ))}
              </ul>
            </details>
          )}
          <Link className="se-secondary" to={link('gifts', { view: 'received' })}>
            Полученные подарки
          </Link>
        </section>
      )}

      <Dialog.Root
        open={!!currentStory && tab === 'mosaics' && !previewOpen}
        onOpenChange={(value) => {
          if (!value) setStory(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content
            className="snow-dialog snow-event-dialog sm-story"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (storyTrigger.current?.isConnected) storyTrigger.current.focus();
              else nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
            }}
          >
            <div className="sm-story-heading">
              <Dialog.Title>{currentStory?.title}</Dialog.Title>
              <Dialog.Close className="sw-close" aria-label="Закрыть рассказ">
                ×
              </Dialog.Close>
            </div>
            <div className="sm-story-text">
              {currentStory?.story?.split('\n\n').map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <Dialog.Close className="se-secondary">Закрыть рассказ</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
