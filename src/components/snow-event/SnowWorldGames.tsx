import { useCallback, useEffect, useRef, useState } from 'react';
import { snowApi, snowError, type SnowGame } from '@/api/snowEvent';
import { StationSprite } from './SnowWorldScene';

interface MoveResult {
  correct: boolean;
  caught: number;
  required: number;
  complete: boolean;
  face?: number;
  pair?: boolean;
  previous?: string;
  matched?: string[];
  position?: number;
}
const names: Record<string, string> = {
  catch: 'Лови снежинки',
  find: 'Найди подарок',
  lights: 'Почини гирлянду',
  tree: 'Укрась ёлку',
  help: 'Помоги коту',
  stars: 'Зажги созвездие',
  pairs: 'Найди пару',
  parcel: 'Собери посылку',
  delivery: 'Доставь подарок',
  clean: 'Снежная уборка',
};
const instructions: Record<string, string> = {
  catch: 'Поймай 7 падающих снежинок. На клавиатуре — 1–5 по колонкам.',
  find: 'Кот спрятал коробку под одним из сугробов. Найди её, заглядывая под снег.',
  lights:
    'Запомни последовательность цветов. Повтори её на гирлянде. Если ошибёшься — начни последовательность сначала.',
  tree: 'Развесь игрушки по цветам. Перетащи игрушку на ветку или выбери её и коснись места того же цвета.',
  help: 'Отнеси все коробки к мастерской: выбери коробку, затем нажми на тележку. Можно перетаскивать.',
  stars: 'Зажги созвездие: соедини звёзды по порядку от 1 до 6.',
  pairs: 'Найди шесть пар зимних предметов. Открывай по две карточки и запоминай картинки.',
  parcel: 'Собери коробку по списку кота. Добавляй предметы в указанном порядке.',
  delivery: 'Проведи сани по светлой дорожке к подарку. Нажимай соседнюю клетку или стрелки.',
  clean: 'Протри 12 заснеженных стёкол. Проводи пальцем по окнам или нажимай на них.',
};
const colours = ['#bca0e9', '#efcf94', '#a8dcec', '#96d4b8', '#dfa7c3'];
const objects = ['🔔', '🧤', '⭐', '🧣', '🎁', '❄', '🧦', '🍪', '🎀'];

export default function SnowWorldGames({
  game,
  preview,
  onClose,
  onComplete,
  onRetry,
}: {
  game: SnowGame;
  preview?: string;
  onClose: () => void;
  onComplete: () => void;
  onRetry: () => void;
}) {
  const kind = game.kind || 'catch';
  const cards = game.cards || [];
  const start = useRef(performance.now());
  const live = useRef(true);
  const queue = useRef(Promise.resolve());
  const inFlight = useRef(new Set<string>());
  const finishing = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MoveResult>({
    correct: true,
    caught: 0,
    required: game.required,
    complete: false,
  });
  const [done, setDone] = useState(new Set<string>());
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [faces, setFaces] = useState<Record<string, number>>({});
  const [showPattern, setShowPattern] = useState(kind === 'lights');
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);
  const cleanupTimers = useRef<number[]>([]);
  const tickTimer = useRef(0);
  const paired = useRef(new Set<string>());
  const [searched, setSearched] = useState(new Set<string>());
  useEffect(() => {
    live.current = true;
    const timer = window.setInterval(() => {
      const value = (performance.now() - start.current) / 1000;
      setElapsed(value);
      if (value >= 120) window.clearInterval(timer);
    }, 80);
    tickTimer.current = timer;
    return () => {
      live.current = false;
      window.clearInterval(timer);
      for (const id of cleanupTimers.current) window.clearTimeout(id);
    };
  }, []);
  useEffect(() => {
    if (kind !== 'lights') return;
    const timer = window.setTimeout(() => setShowPattern(false), 4500);
    return () => clearTimeout(timer);
  }, [kind]);
  const move = useCallback(
    (id: string, slot = '') => {
      if (!live.current || finishing.current || inFlight.current.has(id)) return;
      inFlight.current.add(id);
      // Pointer swipes and double taps are serialized: no concurrent CAS requests.
      queue.current = queue.current.then(async () => {
        if (!live.current) return;
        try {
          const next = await snowApi.action<MoveResult>(
            'hit',
            { attempt_id: game.id, target_id: id, slot },
            preview,
          );
          if (!live.current) return;
          setResult(next);
          if (kind === 'find') setSearched((previous) => new Set([...previous, id]));
          if (next.correct && !['pairs', 'delivery', 'lights', 'stars', 'parcel'].includes(kind))
            setDone((previous) => new Set([...previous, id]));
          if (kind === 'pairs' && next.face !== undefined) {
            setFaces((previous) => ({ ...previous, [id]: next.face as number }));
            if (next.pair) {
              paired.current = new Set(next.matched || []);
              setDone(paired.current);
            } else if (next.previous)
              cleanupTimers.current.push(
                window.setTimeout(() => {
                  if (live.current)
                    setFaces((previous) => {
                      const copy = { ...previous };
                      if (!paired.current.has(id)) delete copy[id];
                      if (!paired.current.has(next.previous as string))
                        delete copy[next.previous as string];
                      return copy;
                    });
                }, 900),
              );
          }
          setMessage(
            next.correct
              ? next.complete
                ? 'Задание готово! Кот уже считает снежинки.'
                : ''
              : kind === 'lights'
                ? 'Огоньки перепутались. Давай ещё раз с первого цвета.'
                : 'Попробуй другой предмет — кот подскажет.',
          );
        } catch (error) {
          if (live.current) setMessage(snowError(error));
        } finally {
          inFlight.current.delete(id);
        }
      });
    },
    [game.id, preview, kind],
  );
  const keyboard = useRef({ elapsed, move, done, result });
  keyboard.current = { elapsed, move, done, result };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement).closest('input,select,textarea')
      )
        return;
      const current = keyboard.current;
      if (kind === 'catch') {
        const target = game.targets.find(
          (t) =>
            t.lane === Number(event.key) - 1 &&
            current.elapsed >= t.at &&
            current.elapsed <= t.at + 2 &&
            !current.done.has(t.id),
        );
        if (target) {
          event.preventDefault();
          current.move(target.id);
        }
      } else if (kind === 'delivery') {
        const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -5, ArrowDown: 5 }[event.key];
        const position = current.result.position || 0;
        const target = cards.find((c) => c.index === position + (offset ?? 999));
        if (target) {
          event.preventDefault();
          current.move(target.id);
        }
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [game, kind, cards]);
  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    setMessage('');
    try {
      await queue.current;
      const reward = await snowApi.action<{ earned: number }>(
        'finish',
        { attempt_id: game.id },
        preview,
      );
      if (!live.current) return;
      setWon(true);
      window.clearInterval(tickTimer.current);
      setMessage(
        `+${reward.earned} снежинок в копилке. ${reward.earned > 15 ? 'В том числе бонус за пять игр недели!' : 'Станция стала ещё чуточку уютнее.'}`,
      );
      onComplete();
    } catch (error) {
      if (live.current) setMessage(snowError(error));
    } finally {
      finishing.current = false;
      if (live.current) setBusy(false);
    }
  };
  const take = (id: string, slot = '') => {
    move(id, slot);
    setSelected('');
  };
  const remaining = Math.max(0, Math.ceil((kind === 'catch' ? 20 : 15) - elapsed));
  return (
    <section className={`sw-game sw-game-${kind}`} aria-label={`Игра: ${names[kind]}`}>
      <div className="sw-game-heading">
        <div>
          <p className="se-kicker">
            {game.final ? 'Финальное приключение · 31 декабря' : 'Сегодня помогаем коту'}
          </p>
          <h2>{names[kind]}</h2>
        </div>
        <button type="button" className="sw-close" onClick={onClose} aria-label="Закрыть игру">
          ×
        </button>
      </div>
      {!won && <details className="sv3-game-help"><summary>Как играть</summary><p className="sw-game-instructions">{instructions[kind]}</p></details>}
      <div className="sw-game-stats">
        <strong>
          {result.caught} / {game.required}
        </strong>
        <span>
          {result.complete
            ? 'Задание выполнено'
            : kind === 'catch'
              ? `${Math.max(0, Math.ceil(20 - elapsed))} сек.`
              : `Время: ${Math.floor(elapsed)} сек.`}
        </span>
      </div>
      {won ? (
        <div className="sw-game-victory"><div className="sv3-earned-flakes" aria-hidden="true">{[0,1,2,3,4,5,6].map(n=><span key={n} style={{animationDelay:`${n*80}ms`,left:`${10+n*13}%`}}>❄</span>)}</div>
          <StationSprite index={15} />
          <h3>{game.final ? 'Спасибо за весь этот декабрь!' : 'МЯУ! Отличная работа!'}</h3>
        </div>
      ) : (
        <div className="sw-game-playfield">
          {kind === 'catch' && (
            <div className="sw-catching-board">
              <div className="sw-catching-lanes" aria-hidden="true">
                1　　2　　3　　4　　5
              </div>
              {game.targets
                .filter((t) => elapsed >= t.at && elapsed <= t.at + 2 && !done.has(t.id))
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="sw-catching-flake"
                    style={{ left: `${t.lane * 20}%`, top: `${8 + (elapsed - t.at) * 28}%` }}
                    aria-label={`Поймать снежинку, колонка ${t.lane + 1}`}
                    onClick={() => take(t.id)}
                  >
                    ❄
                  </button>
                ))}
            </div>
          )}
          {kind === 'find' && (
            <div className="sw-find-board">
              {cards.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  disabled={result.complete || searched.has(c.id)}
                  aria-label={`Проверить сугроб ${c.index + 1}`}
                  onClick={() => {
                    setSelected(c.id);
                    take(c.id);
                  }}
                  className={done.has(c.id) ? 'is-complete' : ''}
                >
                  {done.has(c.id) ? (
                    <StationSprite index={2} />
                  ) : (
                    <>
                      <span aria-hidden="true">{searched.has(c.id) ? '·' : '❄'}</span>
                      <small>{searched.has(c.id) ? 'Пусто' : c.index + 1}</small>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
          {kind === 'lights' && (
            <>
              <div className="sw-light-pattern" aria-label="Образец последовательности">
                {(game.order || []).map((id, i) => (
                  <span
                    key={id}
                    style={{
                      background:
                        showPattern || i < result.caught
                          ? colours[cards.findIndex((c) => c.id === id)]
                          : '#4c465c',
                    }}
                  >
                    {showPattern || i < result.caught ? i + 1 : '·'}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="sw-small-button"
                onClick={() => {
                  setShowPattern(true);
                  cleanupTimers.current.push(window.setTimeout(() => setShowPattern(false), 4500));
                }}
              >
                Повторить образец
              </button>
              <div className="sw-light-buttons">
                {cards.map((c, i) => (
                  <button
                    type="button"
                    key={c.id}
                    disabled={showPattern || result.complete}
                    style={{ background: colours[i] }}
                    aria-label={`Огонёк ${i + 1}`}
                    onClick={() => take(c.id)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
          {kind === 'tree' && (
            <div className="sw-tree-game">
              <StationSprite index={1} />
              <div className="sw-tree-slots">
                {cards.map((c, i) => (
                  <button
                    type="button"
                    key={c.id}
                    className={done.has(c.id) ? 'is-complete' : ''}
                    style={{ borderColor: colours[i] }}
                    aria-label={`Ветка ${i + 1}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      take(e.dataTransfer.getData('text/plain'), String(i));
                    }}
                    onClick={() => {
                      if (selected) take(selected, String(i));
                    }}
                  >
                    {done.has(c.id) ? '●' : i + 1}
                  </button>
                ))}
              </div>
              <div className="sw-ornament-tray">
                {cards.map((c, i) => (
                  <button
                    type="button"
                    key={c.id}
                    draggable
                    disabled={done.has(c.id)}
                    style={{ color: colours[i] }}
                    aria-pressed={selected === c.id}
                    aria-label={`Игрушка ${i + 1}`}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                    onClick={() => setSelected(c.id)}
                  >
                    ●
                  </button>
                ))}
              </div>
            </div>
          )}
          {kind === 'help' && (
            <>
              <div className="sw-crate-tray">
                {cards.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    draggable
                    disabled={done.has(c.id)}
                    aria-pressed={selected === c.id}
                    aria-label={`Коробка ${c.index + 1}`}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                    onClick={() => setSelected(c.id)}
                  >
                    <StationSprite index={4} />
                    <small>{done.has(c.id) ? '✓' : c.index + 1}</small>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="sw-workshop-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  take(e.dataTransfer.getData('text/plain'));
                }}
                onClick={() => {
                  if (selected) take(selected);
                }}
              >
                <StationSprite index={5} />
                <span>{selected ? 'Положить коробку в тележку' : 'Тележка у мастерской'}</span>
              </button>
            </>
          )}
          {kind === 'stars' && (
            <div className="sw-connect-stars">
              <svg viewBox="0 0 300 180" aria-hidden="true">
                <polyline
                  points={cards
                    .slice(0, result.caught)
                    .map((_, i) => `${30 + i * 45},${40 + (i % 2) * 70}`)
                    .join(' ')}
                />
              </svg>
              {cards.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  aria-label={`Звезда ${i + 1}`}
                  className={i < result.caught ? 'is-complete' : ''}
                  style={{ left: `${5 + i * 16}%`, top: `${15 + (i % 2) * 40}%` }}
                  onClick={() => take(c.id)}
                >
                  ✦<span>{i + 1}</span>
                </button>
              ))}
            </div>
          )}
          {kind === 'pairs' && (
            <div className="sw-pair-board">
              {cards.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  disabled={done.has(c.id)}
                  aria-label={`Карточка ${c.index + 1}${faces[c.id] !== undefined ? `: ${objects[faces[c.id]]}` : ''}`}
                  className={done.has(c.id) ? 'is-complete' : ''}
                  onClick={() => take(c.id)}
                >
                  {faces[c.id] !== undefined ? objects[faces[c.id]] : '❄'}
                </button>
              ))}
            </div>
          )}
          {kind === 'parcel' && (
            <>
              <div className="sw-parcel-recipe" aria-label="Список предметов">
                {(game.order || []).map((id, i) => (
                  <span key={id} className={i < result.caught ? 'is-complete' : ''}>
                    {objects[cards.findIndex((c) => c.id === id) % objects.length]}
                    <small>{i + 1}</small>
                  </span>
                ))}
              </div>
              <div className="sw-parcel-box">
                <StationSprite index={2} />
                <span>
                  В коробке: {result.caught} из {game.required}
                </span>
              </div>
              <div className="sw-parcel-shelf">
                {cards.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    aria-label={`Предмет ${c.index + 1}`}
                    onClick={() => take(c.id)}
                  >
                    {objects[c.index % objects.length]}
                    <small>{c.index + 1}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {kind === 'delivery' && (
            <div className="sw-delivery-grid">
              {cards.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={(game.path || []).includes(c.index) ? 'sw-road' : 'sw-obstacle'}
                  aria-label={`Клетка ${c.index + 1}`}
                  disabled={!(game.path || []).includes(c.index)}
                  onClick={() => take(c.id)}
                >
                  {(result.position || 0) === c.index
                    ? '🛷'
                    : c.index === 14
                      ? '🎁'
                      : (game.path || []).includes(c.index)
                        ? '·'
                        : '❄'}
                </button>
              ))}
            </div>
          )}
          {kind === 'clean' && (
            <div className="sw-cleaning-grid">
              {cards.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={done.has(c.id) ? 'is-complete' : ''}
                  disabled={done.has(c.id)}
                  aria-label={`Протереть стекло ${c.index + 1}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    take(c.id);
                  }}
                  onPointerEnter={(e) => {
                    if (e.buttons) take(c.id);
                  }}
                  onClick={() => take(c.id)}
                >
                  {done.has(c.id) ? '✧' : '❄'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className={`sw-game-message ${won ? 'se-success' : ''}`} role="status">
        {message ||
          (result.complete && remaining
            ? `Праздничная проверка… ещё ${remaining} сек.`
            : 'Каждая маленькая помощь приближает большой праздник.')}
      </p>
      {won ? (
        <button type="button" className="se-button" onClick={onClose}>
          К нашей станции
        </button>
      ) : result.complete ? (
        <button
          type="button"
          className="se-button"
          disabled={remaining > 0 || busy}
          onClick={() => void finish()}
        >
          {busy
            ? 'Сохраняем награду…'
            : remaining > 0
              ? `Снежинки через ${remaining} сек.`
              : 'Забрать 15 снежинок'}
        </button>
      ) : elapsed >= (kind === 'catch' ? 20 : 60) ? (
        <button type="button" className="se-secondary" disabled={elapsed < 30} onClick={onRetry}>
          {elapsed < 30
            ? `Ещё попытка через ${Math.ceil(30 - elapsed)} сек.`
            : 'Попробовать заново'}
        </button>
      ) : null}
    </section>
  );
}
