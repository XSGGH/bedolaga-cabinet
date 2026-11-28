import type { MosaicState } from '@/api/snowEvent';
import type { useSnowPairs } from './useSnowPairs';

const cards: Record<string, [string, string]> = {
  scarf: ['🧣', 'Шарф'],
  mitten: ['🧤', 'Варежка'],
  ornament: ['🔴', 'Ёлочная игрушка'],
  snowflake: ['❄️', 'Снежинка'],
  cocoa: ['☕', 'Какао'],
  star: ['⭐', 'Звезда'],
};

export default function SnowPairs({
  game,
  data,
  unavailable,
}: {
  game: ReturnType<typeof useSnowPairs>;
  data: MosaicState;
  unavailable: string;
}) {
  const { attempt, saved, elapsed, busy, retry, move } = game;
  const playing = attempt && !attempt.finished && ['ready', 'active'].includes(attempt.status);
  const used = Math.max(data.attempts_used, Number(attempt?.status === 'active'));
  const status = attempt?.status ?? data.attempt_end;
  return (
    <div className="sm-play">
      <h2>Найди пару</h2>
      <div className="sm-game-stats">
        <span>
          Попыток осталось: <strong>{3 - used}</strong>
        </span>
        <span>
          Лучший результат сегодня: <strong>{Math.max(data.best, move?.best ?? 0)} ❄</strong>
        </span>
      </div>
      {unavailable ? (
        <p className="sm-note">{unavailable}</p>
      ) : playing ? (
        <>
          <div className="sm-game-stats">
            <span role="timer" aria-live="off">
              {Math.floor(elapsed)} / 180 сек.
            </span>
            <span>Пары: {attempt.matched.length / 2} / 6</span>
            <span>Ошибки: {attempt.errors}</span>
          </div>
          <div className="sm-board" aria-busy={busy}>
            {attempt.cards.map((card, i) => {
              const value = card ?? game.mismatch?.[i];
              const symbol = value ? cards[value] : undefined;
              return (
                <button
                  type="button"
                  key={i}
                  className={symbol ? 'sm-card sm-card-open' : 'sm-card'}
                  aria-disabled={!!(busy || retry || symbol || game.mismatch)}
                  aria-label={
                    symbol
                      ? `${symbol[1]}${attempt.matched.includes(i) ? ', пара найдена' : ''}`
                      : `Открыть карточку ${i + 1}`
                  }
                  onClick={() => {
                    if (!symbol && !busy && !retry && !game.mismatch) void game.flip(i);
                  }}
                >
                  <span aria-hidden="true">{symbol?.[0] ?? '✦'}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="se-secondary" onClick={game.pause}>
            Приостановить и сохранить
          </button>
        </>
      ) : (
        <>
          {status === 'timeout' && (
            <p className="sm-note" role="status">
              Активное время попытки закончилось.
            </p>
          )}
          {data.best >= 30 && <p>Сегодня уже набран максимум снежинок.</p>}
          <button
            type="button"
            className="se-button"
            disabled={busy || (!saved && !retry && used >= 3)}
            onClick={() => void game.start()}
          >
            {busy
              ? 'Загружаем партию…'
              : saved
                ? 'Продолжить игру'
                : retry
                  ? 'Проверить результат'
                  : used >= 3
                    ? 'Попытки закончились'
                    : data.best > 0
                      ? 'Сыграть ещё'
                      : 'Играть сегодня'}
          </button>
        </>
      )}
      {move && status !== 'timeout' && (
        <section className="sm-success sm-result" role="status">
          <strong>{move.earned ? `+${move.earned} снежинок` : 'Лучший результат сохранён'}</strong>
          <p>
            {move.destination?.kind === 'reserve'
              ? 'Твой вклад пополнил резерв дороги домой.'
              : move.destination?.kind === 'bonus'
                ? 'Ты открыл фрагмент дополнительной мозаики.'
                : move.destination?.kind === 'main'
                  ? 'Ты открыл один общий фрагмент.'
                  : 'Общий вклад за сегодня уже учтён.'}
          </p>
        </section>
      )}
      {game.error && (
        <p role="alert" className="snow-error">
          {game.error}
        </p>
      )}
      {retry && playing && (
        <button
          type="button"
          className="se-secondary"
          disabled={busy}
          onClick={() => void game.flip()}
        >
          Повторить ход
        </button>
      )}
      <details className="sm-rules">
        <summary>Правила и награды</summary>
        <p>
          Открой шесть пар за 180 секунд активной игры. Попытка начинается с первого хода. В день по
          Москве доступны три попытки.
        </p>
        <p>
          До 40 секунд и двух ошибок — 30 снежинок. До 75 секунд и шести ошибок — 20. Остальные
          завершённые партии — 10.
        </p>
        <p>
          При улучшении начисляем разницу. Первая завершённая партия за день добавляет один общий
          вклад.
        </p>
      </details>
    </div>
  );
}
