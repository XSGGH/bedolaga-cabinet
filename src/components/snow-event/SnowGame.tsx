import { useEffect, useRef, useState } from 'react';
import { snowApi, snowError, type SnowGame as Game } from '@/api/snowEvent';

export default function SnowGame({
  game,
  preview,
  onComplete,
  onClose,
}: {
  game: Game;
  preview?: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const start = useRef(performance.now());
  const mounted = useRef(true);
  const container = useRef<HTMLElement>(null);
  const hits = useRef(new Set<string>());
  const inFlight = useRef(new Set<string>());
  const [elapsed, setElapsed] = useState(0);
  const [caught, setCaught] = useState(0);
  const [message, setMessage] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [won, setWon] = useState(false);
  useEffect(() => {
    mounted.current = true;
    container.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    const timer = window.setInterval(
      () => setElapsed((performance.now() - start.current) / 1000),
      50,
    );
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const hit = async (id: string) => {
    if (hits.current.has(id) || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    try {
      const result = await snowApi.action<{ caught: number }>(
        'hit',
        { attempt_id: game.id, target_id: id },
        preview,
      );
      hits.current.add(id);
      if (mounted.current) {
        setCaught(result.caught);
        setMessage('');
      }
    } catch (error) {
      if (mounted.current) setMessage(snowError(error));
    } finally {
      inFlight.current.delete(id);
    }
  };
  const finish = async () => {
    setFinishing(true);
    try {
      const result = await snowApi.action<{ earned: number }>(
        'finish',
        { attempt_id: game.id },
        preview,
      );
      setMessage(
        `Отличная работа! +${result.earned} снежинок зачислено${preview ? ' в тестовый прогресс' : ''}.`,
      );
      setWon(true);
      onComplete();
    } catch (error) {
      setMessage(snowError(error));
    } finally {
      setFinishing(false);
    }
  };
  return (
    <section ref={container} className="snow-game snow-card" aria-label="Игра: снежный сбор">
      <div className="snow-section-title">
        <div>
          <p className="snow-eyebrow">ЗАДАНИЕ ДНЯ</p>
          <h2>Снежный сбор</h2>
        </div>
        <button
          type="button"
          className="snow-icon-button"
          onClick={onClose}
          aria-label="Закрыть игру"
        >
          ×
        </button>
      </div>
      <p className="snow-muted">
        Коснитесь 7 снежинок за 20 секунд. На клавиатуре — клавиши 1–5 по колонкам. Не получилось?
        Можно попробовать снова.
      </p>
      <div className="snow-game-stats">
        <strong>
          {caught} / {game.required} поймано
        </strong>
        <span>{Math.max(0, Math.ceil(game.duration - elapsed))} сек.</span>
      </div>
      <GameBoard game={game} elapsed={elapsed} hit={hit} hits={hits.current} />
      <p role="status" className={won ? 'snow-success' : 'snow-muted'}>
        {message ||
          (elapsed >= game.duration
            ? caught >= game.required
              ? 'Все снежинки собраны. Заберите награду!'
              : 'Не хватило снежинок — закройте игру и попробуйте снова через полминуты.'
            : 'Ловите светящиеся снежинки — каждая приближает праздник.')}
      </p>
      {!won && elapsed >= game.duration && caught >= game.required && (
        <button type="button" className="snow-button" disabled={finishing} onClick={finish}>
          {finishing ? 'Проверяем…' : 'Забрать 10 снежинок'}
        </button>
      )}
      {won && (
        <button type="button" className="snow-button" onClick={onClose}>
          Вернуться к празднику
        </button>
      )}
    </section>
  );
}

function GameBoard({
  game,
  elapsed,
  hit,
  hits,
}: {
  game: Game;
  elapsed: number;
  hit: (id: string) => void;
  hits: Set<string>;
}) {
  const live = game.targets.filter(
    (t) => elapsed >= t.at && elapsed <= t.at + 2 && !hits.has(t.id),
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = live.find((t) => t.lane === Number(event.key) - 1);
      if (target) {
        event.preventDefault();
        hit(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, hit]);
  return (
    <div className="snow-game-board">
      <div className="snow-lanes" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      {live.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => hit(t.id)}
          className="snow-target"
          style={{
            left: `${t.lane * 20 + 1}%`,
            top: `${18 + Math.min(1, (elapsed - t.at) / 2) * 57}%`,
          }}
          aria-label={`Поймать снежинку, колонка ${t.lane + 1}`}
        >
          ❄
        </button>
      ))}
      {elapsed >= game.duration && (
        <div className="snow-game-end" aria-hidden="true">
          ✧
        </div>
      )}
      <div className="snow-ground" aria-hidden="true" />
    </div>
  );
}
