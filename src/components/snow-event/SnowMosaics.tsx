import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import client from '@/api/client';
import { snowError, type SnowState } from '@/api/snowEvent';
import { PreviewBar } from './SnowEventControls';
import SnowWorldRewards from './SnowWorldRewards';
import { hasSubscription } from './snowPresentation';
import './snow-mosaics.css';

type Chapter = {
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
  const [selected, setSelected] = useState('');
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
        setMessage('Найди шесть пар. Можно ошибаться — это часть игры.');
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
          <p>Маленькие истории, которые мы открываем вместе.</p>
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
      <section
        id={`sm-${tab}`}
        aria-label={
          { mosaics: 'Мозаики', play: 'Играть', gifts: 'Подарки', mine: 'Мой вклад' }[tab]
        }
      >
        {tab === 'mosaics' && chapter && (
          <>
            <div className="sm-chapter-heading">
              <div>
                <p className="sm-eyebrow">Три маленькие истории</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.caption}</p>
              </div>
              <span>
                {chapter.unlocked
                  ? chapter.count === chapter.total
                    ? 'Собрана'
                    : 'Собираем'
                  : `С ${chapter.start.slice(8)} декабря`}
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
                {chapter.id === 'family' && state.today < '2026-12-31' && (
                  <p>Последние части и развязку откроем 31 декабря.</p>
                )}
                <button type="button" className="se-button" onClick={() => setTab('play')}>
                  Сыграть сегодня
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
                <div className="sm-chapters">
                  {data.chapters.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      aria-pressed={chapter.id === c.id}
                      onClick={() => setSelected(c.id)}
                    >
                      <strong>{c.title}</strong>
                      <small>
                        {c.unlocked
                          ? `${c.count} / ${c.total} · ${c.count === c.total ? 'собрана' : 'собираем'}`
                          : `Откроется ${c.start.slice(8)} декабря`}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        {tab === 'play' && (
          <div className="sm-play">
            <h2>Найди пару</h2>
            <p>
              «Я приготовил какао. Уголёк — карточки. Кажется, всё для хорошего вечера на месте».
            </p>
            {attempt && !attempt.finished && (
              <p role="timer">
                Время: {Math.floor(elapsed)} сек. · Пары: {attempt.matched.length / 2} / 6
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
              <p role="status" className="sm-success">
                {message}
              </p>
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
                Повторить тот же запрос
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
          <div className="sm-play">
            <h2>В этой истории есть твоё тепло</h2>
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
              Если глава собрана раньше срока, твой вклад остаётся в резерве для дополнительных
              историй. Следующая основная глава откроется в свою дату.
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
          ['mine', '♡', 'Мой вклад'],
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
            <Dialog.Title>{story?.title}</Dialog.Title>
            <Dialog.Description>{story?.story}</Dialog.Description>
            <Dialog.Close className="se-button">Сохраню это тепло</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
