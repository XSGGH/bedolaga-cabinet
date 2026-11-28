import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import client from '@/api/client';
import { snowError, type SnowState } from '@/api/snowEvent';
import { PreviewBar } from './SnowEventControls';
import SnowWorldRewards from './SnowWorldRewards';
import { hasSubscription } from './snowPresentation';
import './snow-mosaics.css';

type Chapter = {
  planet: string;
  climate: string;
  colors: string[];
  image_width: number;
  image_height: number;
  id: string;
  title: string;
  caption: string;
  start: string;
  finale: string;
  count: number;
  total: number;
  columns: number;
  rows: number;
  tiles: number[];
  story: string | null;
  unlocked: boolean;
};
type Attempt = {
  elapsed?: number;
  id: string;
  cards: (string | null)[];
  matched: number[];
  finished: boolean;
  errors: number;
};
export type MosaicState = {
  chapters: Chapter[];
  home_lights: number;
  epilogue: boolean;
  personal_days: { date: string; best: number; attempts: number }[];
  personal_earned: number;
  reserve: number;
  unique_players: number;
  today_players: number;
  personal_contributions: number;
  personal_reserve: number;
  personal_chapters: Record<string, number>;
  best: number;
  attempts_used: number;
  attempt: Attempt | null;
  today: string;
  server_now: string;
};
const symbols: Record<string, string> = {
  scarf: '🧣',
  mitten: '🧤',
  ornament: '🔴',
  snowflake: '❄️',
  cocoa: '☕',
  star: '⭐',
};
const names: Record<string, string> = {
  scarf: 'Шарф',
  mitten: 'Варежка',
  ornament: 'Ёлочная игрушка',
  snowflake: 'Снежинка',
  cocoa: 'Какао',
  star: 'Звезда',
};
const base = (preview?: string) =>
  preview ? `/cabinet/admin/snow-event/previews/${preview}` : '/cabinet/snow-event';
function Piece({ chapter, index, preview }: { chapter: Chapter; index: number; preview?: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    let blob = '';
    setUrl('');
    setFailed(false);
    void client
      .get(`${base(preview)}/mosaics/${chapter.id}/tiles/${index}`, {
        responseType: 'blob',
        params: { retry },
      })
      .then((r) => {
        blob = URL.createObjectURL(r.data);
        if (live) setUrl(blob);
        else URL.revokeObjectURL(blob);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [chapter.id, index, preview, retry]);
  return url ? (
    <img src={url} alt="" draggable={false} />
  ) : failed ? (
    <button
      type="button"
      aria-label="Загрузить фрагмент повторно"
      onClick={() => setRetry((n) => n + 1)}
    >
      ↻
    </button>
  ) : (
    <span aria-hidden="true" />
  );
}
function Mosaic({ chapter, preview }: { chapter: Chapter; preview?: string }) {
  const tiles = new Set(chapter.tiles);
  return (
    <div
      className="sm-picture"
      role="img"
      aria-label={`${chapter.title}: открыто ${chapter.count} из ${chapter.total} частей`}
      style={{
        aspectRatio: `${chapter.image_width}/${chapter.image_height}`,
        gridTemplateColumns: `repeat(${chapter.columns},1fr)`,
        gridTemplateRows: `repeat(${chapter.rows},1fr)`,
      }}
    >
      {Array.from({ length: chapter.total }, (_, i) => (
        <div key={i} className={tiles.has(i) ? 'sm-piece sm-revealed' : 'sm-piece'}>
          {tiles.has(i) ? (
            <Piece chapter={chapter} index={i} preview={preview} />
          ) : (
            <span aria-hidden="true">✦</span>
          )}
        </div>
      ))}
    </div>
  );
}
export default function SnowMosaics({
  state,
  preview,
  refresh,
}: {
  state: SnowState;
  preview?: string;
  refresh: () => void;
}) {
  const data = state.mosaics;
  const [tab, setTab] = useState('mosaics');
  const [selected, setSelected] = useState(state.preview_planet || '');
  const [story, setStory] = useState<Chapter | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(data?.attempt || null);
  const [show, setShow] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState<{ action: string; body: Record<string, unknown> } | null>(
    null,
  );
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!lock.current && !retry) {
      setAttempt(data?.attempt || null);
      setShow({});
    }
  }, [data?.attempt, retry]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (state.preview_planet) setSelected(state.preview_planet);
  }, [state.preview_planet]);
  const observed = useRef(data?.chapters.filter((c) => c.story).map((c) => c.id) || []);
  const [arrival, setArrival] = useState('');
  useEffect(() => {
    const completed = data?.chapters.filter((c) => c.story) || [];
    const newly = completed.find((c) => !observed.current.includes(c.id));
    if (newly) {
      setArrival(newly.planet);
      setStory(newly);
    }
    observed.current = completed.map((c) => c.id);
  }, [data?.chapters]);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const base = attempt?.elapsed || 0,
      start = performance.now();
    setElapsed(base);
    if (!attempt || attempt.finished) return;
    const ticker = window.setInterval(
      () => setElapsed(base + (performance.now() - start) / 1000),
      250,
    );
    return () => clearInterval(ticker);
  }, [attempt]);
  const call = async (action: string, body: Record<string, unknown> = {}) => {
    if (lock.current) return;
    let delayed = false;
    lock.current = true;
    const requestStarted = performance.now();
    setBusy(true);
    setError('');
    try {
      const r = await client.post(`${base(preview)}/mosaics/actions`, { action, ...body });
      const result = r.data.result;
      setRetry(null);
      if (action === 'start') {
        setAttempt(result);
        setShow({});
        setMessage('');
      } else {
        setAttempt(result.attempt);
        setShow((previous) => ({ ...previous, [result.index]: result.symbol }));
        if (result.first !== undefined && !result.match) {
          delayed = true;
          timer.current = setTimeout(() => {
            setShow({});
            timer.current = null;
            setBusy(false);
            lock.current = false;
          }, 850);
          refresh();
          return;
        }
        if (result.attempt.finished) {
          setMessage(
            `Твой лучший результат: ${result.best} ❄. ${result.earned ? `Добавлено ${result.earned} личных снежинок.` : 'Сегодняшний рекорд сохранён.'} ${result.contribution ? 'Ты открыл один общий фрагмент!' : 'Общий вклад за этот день уже учтён.'}`,
          );
        }
      }
      refresh();
    } catch (e) {
      setError(snowError(e));
      setRetry({ action, body });
    } finally {
      if (!delayed) {
        const wait = Math.max(0, 300 - (performance.now() - requestStarted));
        if (wait > 0) {
          timer.current = setTimeout(() => {
            timer.current = null;
            lock.current = false;
            setBusy(false);
          }, wait);
        } else {
          lock.current = false;
          setBusy(false);
        }
      }
    }
  };
  // A mismatch delay owns the lock until its timer completes.
  useEffect(() => {
    if (!busy && timer.current) {
      timer.current = null;
    }
  }, [busy]);
  if (!data)
    return (
      <section className="se-panel">
        <h1>Снежный переполох</h1>
        <p>Истории готовятся. Обнови страницу после установки нового API.</p>
        <button type="button" onClick={refresh}>
          Обновить
        </button>
      </section>
    );
  const chapter =
    data.chapters.find((c) => c.id === selected) ||
    data.chapters.filter((c) => c.unlocked).find((c) => c.count < c.total) ||
    data.chapters.filter((c) => c.unlocked).slice(-1)[0] ||
    data.chapters[0];
  const play = state.phase === 'active' && hasSubscription(state);
  return (
    <main className="snow-page snow-experience snow-village sm-event">
      <header className="sm-heading">
        <Link to={preview ? '/admin/snow-event' : '/'} aria-label="Назад">
          ←
        </Link>
        <div>
          <h1>Снежный переполох</h1>
          <p>Семь планет. Один пропавший друг. Найдём Уголька вместе.</p>
        </div>
      </header>
      {preview && <PreviewBar state={state} onChange={refresh} />}
      {!hasSubscription(state) && (
        <aside className="sm-note">
          <p>
            {state.subscription === 'expired'
              ? 'Прогресс сохранён. Продли подписку, чтобы снова играть и получать подарки.'
              : 'Рассматривать истории можно всем. Для игры и подарков нужна активная подписка.'}
          </p>
          <Link to="/subscription">
            {state.subscription === 'expired' ? 'Продлить' : 'Выбрать подписку'} ↗
          </Link>
        </aside>
      )}
      {arrival && (
        <div className="sm-arrival" role="status">
          <span>✦</span> {arrival}: связь восстановлена
          <button type="button" aria-label="Скрыть завершение главы" onClick={() => setArrival('')}>
            ×
          </button>
        </div>
      )}
      <section
        id={`sm-${tab}`}
        aria-label={{ mosaics: 'Мозаики', play: 'Играть', gifts: 'Подарки', mine: 'Мой путь' }[tab]}
      >
        {tab === 'mosaics' && (
          <nav className="sm-orbit" aria-label="Маршрут к Угольку">
            {data.chapters
              .filter((c) => c.id !== 'bonus')
              .slice(0, 7)
              .map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  className={
                    c.count === c.total ? 'is-done' : c.unlocked ? 'is-current' : 'is-locked'
                  }
                  aria-label={`${i + 1}. ${c.planet}: ${c.count === c.total ? 'исследована' : c.unlocked ? 'исследуем' : 'закрыта'}`}
                  aria-pressed={selected === c.id}
                  onClick={() => setSelected(c.id)}
                  style={{ '--planet-color': c.colors[0] } as CSSProperties}
                >
                  <span>{c.count === c.total ? '✓' : i + 1}</span>
                  <small>{c.planet}</small>
                </button>
              ))}
          </nav>
        )}
        {tab === 'mosaics' && (
          <details className="sm-prologue">
            <summary>Как началось наше путешествие</summary>
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
        )}
        {tab === 'mosaics' && data.chapters.length > 7 && (
          <details className="sm-gallery">
            <summary>Дополнительные истории</summary>
            {data.chapters.slice(7).map((c) => (
              <button type="button" key={c.id} onClick={() => setSelected(c.id)}>
                {c.title}
              </button>
            ))}
          </details>
        )}
        {tab === 'mosaics' && chapter && (
          <>
            <div className="sm-chapter-heading">
              <div>
                <p className="sm-eyebrow">{chapter.climate}</p>
                <p className="sm-planet-name">{chapter.planet}</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.caption}</p>
              </div>
              <span>
                {chapter.unlocked
                  ? chapter.count === chapter.total
                    ? 'Собрана'
                    : 'Собираем'
                  : 'Следующая остановка'}
              </span>
            </div>
            <div className="sm-main">
              <Mosaic chapter={chapter} preview={preview} />
              <div className="sm-sidebar">
                <strong>
                  {chapter.count} <small>из {chapter.total} частей</small>
                </strong>
                <progress max={chapter.total} value={chapter.count} />
                <p>
                  {Math.floor((chapter.count / chapter.total) * 100)}% · Сегодня помогли{' '}
                  {data.today_players}
                </p>
                <button
                  type="button"
                  className="se-button"
                  disabled={!hasSubscription(state)}
                  onClick={() => setTab('play')}
                >
                  {hasSubscription(state) ? 'Помочь Снежку сегодня' : 'Нужна активная подписка'}
                </button>
                {chapter.story && (
                  <button type="button" className="se-secondary" onClick={() => setStory(chapter)}>
                    Прочитать нашу историю
                  </button>
                )}
                <p>
                  Твои фрагменты этой истории: {data.personal_chapters[chapter.id] || 0}. Личные
                  снежинки за него не списываются.
                </p>
              </div>
            </div>
          </>
        )}
        {tab === 'mosaics' && (
          <>
            <details className="sm-gallery">
              <summary>
                Наши открытые истории · {data.chapters.filter((c) => c.story).length}
              </summary>
              {data.chapters
                .filter((c) => c.story)
                .map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setStory(c);
                    }}
                  >
                    {c.planet} · {c.title} ↗
                  </button>
                ))}
            </details>
            {data.chapters.slice(0, 7).every((c) => c.count === c.total) && (
              <section className="sm-home-lights">
                <h2>Зажжём огни по дороге домой</h2>
                <p>
                  Друг найден. Каждые пять новых общих вкладов зажигают ещё один огонёк:{' '}
                  {data.home_lights}.
                </p>
                <div aria-label={`${data.home_lights} огоньков`}>
                  {Array.from({ length: Math.min(40, data.home_lights) }, (_, i) => (
                    <span key={i}>✦</span>
                  ))}
                </div>
                {data.epilogue && (
                  <p>С Новым годом! Пусть надёжные маршруты всегда приводят туда, где тебя ждут.</p>
                )}
              </section>
            )}
          </>
        )}
        {tab === 'play' && (
          <div className="sm-play">
            <div className="sm-mentor">
              <img src="/login-cat.webp" alt="Снежок" width="52" height="52" />
              <div>
                <h2>Найди пару</h2>
                <small>Восстановим ещё один сигнал вместе.</small>
              </div>
            </div>
            <p>
              «Ещё одна пара — и сигнал станет чуть яснее. Спасибо, что помогаешь мне искать друга».
            </p>
            {attempt && !attempt.finished && (
              <p role="timer">
                Время: {Math.floor(elapsed)} сек. · Пары: {attempt.matched.length / 2} / 6 · Ошибки:{' '}
                {attempt.errors}
              </p>
            )}
            <div className="sm-game-stats">
              <span>Попытки: {data.attempts_used} / 3</span>
              <span>Лучший результат: {data.best} ❄</span>
            </div>
            {!play ? (
              <p className="sm-note">
                {state.phase === 'upcoming'
                  ? 'Начинаем 1 декабря.'
                  : state.phase === 'active'
                    ? 'Для участия нужна активная подписка.'
                    : 'Ежедневные игры декабря завершены. Твои подарки и истории сохранены.'}
              </p>
            ) : (
              <>
                {(!attempt || attempt.finished) && (
                  <button
                    type="button"
                    className="se-button"
                    disabled={busy || data.attempts_used >= 3}
                    onClick={() => void call('start')}
                  >
                    {data.attempts_used >= 3
                      ? 'До завтра — попытки закончились'
                      : data.attempts_used
                        ? 'Попробовать улучшить'
                        : 'Начать игру'}
                  </button>
                )}
                {attempt && !attempt.finished && (
                  <div className="sm-board">
                    {attempt.cards.map((card, i) => {
                      const value = card || show[i];
                      return (
                        <button
                          type="button"
                          key={i}
                          className={value ? 'sm-card sm-card-open' : 'sm-card'}
                          disabled={busy || !!retry || !!card || !!show[i]}
                          aria-label={value ? names[value] : `Открыть карточку ${i + 1}`}
                          onClick={() =>
                            void call('flip', {
                              attempt_id: attempt.id,
                              index: i,
                              request_id: crypto.randomUUID(),
                            })
                          }
                        >
                          <span>{value ? symbols[value] : '✦'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {message && (
              <section role="status" className="sm-success sm-result">
                <img src="/login-cat.webp" alt="Снежок радуется" width="64" height="64" />
                <div>
                  <h3>{attempt?.finished ? 'Сигнал стал яснее!' : 'Отправляемся на поиски'}</h3>
                  <p>{message}</p>
                </div>
              </section>
            )}
            {error && (
              <p role="alert" className="snow-error">
                {error}
              </p>
            )}
            {retry && (
              <button
                type="button"
                className="se-secondary"
                disabled={busy}
                onClick={() => void call(retry.action, retry.body)}
              >
                Повторить ход
              </button>
            )}
            {retry && (
              <button
                type="button"
                className="se-secondary"
                onClick={() => {
                  setRetry(null);
                  setError('');
                  setShow({});
                  refresh();
                }}
              >
                Обновить партию
              </button>
            )}
            <details>
              <summary>Как играем и получаем снежинки</summary>
              <p>
                Открой шесть пар. До трёх попыток в день по Москве. Отлично: до 40 секунд и не
                больше двух ошибок — 30 ❄. Хорошо: до 75 секунд и не больше шести ошибок — 20 ❄.
                Остальные завершённые партии — 10 ❄. На игру есть три минуты.
              </p>
              <p>
                Получаешь только лучший результат дня: при улучшении начисляем разницу. Первая
                успешная игра за день открывает один общий фрагмент; повторные попытки общий вклад
                не увеличивают.
              </p>
            </details>
          </div>
        )}
        {tab === 'gifts' && (
          <>
            <div className="sm-wallet">
              Твои снежинки <strong>{state.progress.balance} ❄</strong>
            </div>
            <SnowWorldRewards state={state} preview={preview} refresh={refresh} />
          </>
        )}
        {tab === 'mine' && (
          <section className="sm-timeline">
            <p>
              Благодаря тебе Снежок стал ближе к другу. Заработано в игре: {data.personal_earned} ❄.
            </p>
            <p>
              Помогал дней: {data.personal_days.filter((day) => day.best > 0).length}. Получено
              подарков: {state.progress.receipts.length}.
            </p>
            {data.chapters
              .filter((c) => data.personal_chapters[c.id] > 0)
              .map((c) => (
                <p key={c.id}>
                  Ты помог исследовать {c.planet}: {data.personal_chapters[c.id]} фрагментов.
                </p>
              ))}
            <details>
              <summary>Мои приключения по датам</summary>
              {data.personal_days.map((day) => (
                <p key={day.date}>
                  {day.date.split('-').reverse().join('.')} ·{' '}
                  {day.best > 0
                    ? `Помощь Снежку · ${day.best} ❄`
                    : 'Попытка начата — можно продолжить сегодня'}
                </p>
              ))}
            </details>
          </section>
        )}
        {tab === 'mine' && (
          <div className="sm-play">
            <h2>Мой путь к Угольку</h2>
            <div className="sm-personal">
              <p>
                Твой вклад <strong>{data.personal_contributions} вкладов</strong>
              </p>
              <p>
                Сегодня <strong>{data.best} личных ❄</strong>
              </p>
              <p>
                Вместе с нами <strong>{data.unique_players} игроков</strong>
              </p>
              <p>
                Общий резерв для будущих историй <strong>{data.reserve} вкладов</strong>
              </p>
            </div>
            <p>
              Следующая планета открывается сразу после завершения предыдущей. Когда найдём Уголька,
              новые вклады будут зажигать огни по дороге домой.
            </p>
            <button type="button" className="se-secondary" onClick={() => setTab('gifts')}>
              Мои подарки и история наград ↗
            </button>
          </div>
        )}
      </section>
      <nav className="sm-nav" aria-label="Зимнее событие">
        {[
          ['mosaics', '▦', 'Мозаики'],
          ['play', '✦', 'Играть'],
          ['gifts', '♧', 'Подарки'],
          ['mine', '♡', 'Мой путь'],
        ].map(([key, icon, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <Dialog.Root
        open={!!story}
        onOpenChange={(value) => {
          if (!value) setStory(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="snow-dialog snow-event-dialog sm-story">
            <div className="sm-story-heading">
              <Dialog.Title>{story?.title}</Dialog.Title>
              <Dialog.Close className="sw-close" aria-label="Закрыть рассказ">
                ×
              </Dialog.Close>
            </div>
            <Dialog.Description asChild>
              <div className="sm-story-text">
                {story?.story?.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </Dialog.Description>
            <Dialog.Close className="se-button">Сохраню это тепло</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
