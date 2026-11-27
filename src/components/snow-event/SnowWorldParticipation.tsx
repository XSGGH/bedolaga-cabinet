import { useState } from 'react';
import type { SnowState } from '@/api/snowEvent';
import { hasSubscription } from './snowPresentation';
import { StationSprite } from './SnowWorldScene';

const decorationNames = {
  lantern: 'Зимний фонарик',
  bauble: 'Ёлочная игрушка',
  star: 'Светящаяся звезда',
  gift: 'Подарок',
  crystal: 'Снежный кристалл',
};
const decorationSprites = [0, 12, 14, 2, 13];
const voteNames = {
  plaza: 'Центральная площадь',
  data: 'Дата-центр XSG',
  orbit: 'Звёздная орбита',
};
export default function SnowWorldParticipation({
  state,
  busy,
  act,
}: {
  state: SnowState;
  busy: boolean;
  act: (action: string, body?: Record<string, unknown>) => void;
}) {
  const [threshold, setThreshold] = useState(100);
  const [kind, setKind] = useState('lantern');
  const [slot, setSlot] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const access = hasSubscription(state) && state.phase === 'active';
  const used = state.world?.decorations.filter((d) => d.own).map((d) => d.threshold) || [];
  const available = [100, 300, 500].filter(
    (value) => state.progress.earned >= value && !used.includes(value),
  );
  const picked = available.includes(threshold) ? threshold : available[0];
  const vote = state.world?.vote;
  return (
    <div className="sw-participation-grid">
      <section className="se-panel">
        <p className="se-kicker">Твой огонёк на общей станции</p>
        <h2>Оставь частичку тепла</h2>
        <p>
          По одному украшению за 100, 300 и 500 личных снежинок. Их увидят все участники — покупки
          подарков не отнимают это право.
        </p>
        <div className="sw-decoration-rights">
          {[100, 300, 500].map((value) => (
            <span key={value} className={state.progress.earned >= value ? 'se-success' : ''}>
              {used.includes(value) ? '✓ Размещено' : `${value} ❄`}
            </span>
          ))}
        </div>
        {access && available.length ? (
          <>
            <label className="sw-field">
              Право на украшение
              <select value={picked} onChange={(e) => setThreshold(Number(e.target.value))}>
                {available.map((value) => (
                  <option key={value} value={value}>
                    За {value} снежинок
                  </option>
                ))}
              </select>
            </label>
            <div className="sw-decoration-picker">
              {Object.entries(decorationNames).map(([id, name], i) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={kind === id}
                  aria-label={name}
                  onClick={() => setKind(id)}
                >
                  <StationSprite index={decorationSprites[i]} />
                  <small>{name}</small>
                </button>
              ))}
            </div>
            <p>Выбери свободное место вдоль дорожек. Важные объекты останутся видны.</p>
            {slot !== null && (
              <div
                className="sw-slot-map"
                aria-label={`Выбрано место ${slot + 1}, на дорожке перед станцией`}
              >
                <img
                  src="/xsg-snow-assets/station-v2.webp"
                  alt="Положение будущего украшения на станции"
                />
                <span
                  style={{
                    left: `${6 + (slot % 16) * 5.8}%`,
                    top: `${90 + Math.floor(slot / 16) * 2}%`,
                  }}
                >
                  ✦
                </span>
              </div>
            )}
            <details className="sw-slot-choices">
              <summary>
                {slot === null
                  ? 'Выбрать место на станции'
                  : `Выбрано место ${slot + 1} · изменить`}
              </summary>
              <div className="sw-slot-picker" aria-label="Места для украшения">
                {Array.from({ length: 64 }, (_, value) => (
                  <button
                    type="button"
                    key={value}
                    disabled={state.world?.decorations.some((d) => d.slot === value)}
                    aria-pressed={slot === value}
                    aria-label={`Место ${value + 1}`}
                    onClick={() => setSlot(value)}
                  >
                    {state.world?.decorations.some((d) => d.slot === value) ? '✦' : value + 1}
                  </button>
                ))}
              </div>
            </details>
            <label className="sw-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Разрешаю показать моё имя у украшения
            </label>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || slot === null}
              onClick={() => {
                act('place', { threshold: picked, decoration: kind, slot: String(slot), consent });
                setSlot(null);
              }}
            >
              Поставить на станцию
            </button>
          </>
        ) : (
          <p className="sw-fine-print">
            {used.length === 3
              ? 'Все три твоих украшения уже на станции 💜'
              : !hasSubscription(state)
                ? 'Нужна активная подписка. Заработанные права сохраняются.'
                : state.phase !== 'active'
                  ? 'Размещение доступно в декабре.'
                  : `Первое украшение — ещё ${Math.max(0, 100 - state.progress.earned)} ❄.`}
          </p>
        )}
      </section>
      <section className="se-panel">
        <p className="se-kicker">Совместный выбор · неделя {(vote?.week || 0) + 1}</p>
        <h2>Куда отправим украшения?</h2>
        <p>
          Кот приготовил особую партию огоньков. Выберем зону вместе. Результат появится после
          завершения недели.
        </p>
        <div className="sw-vote-options">
          {Object.entries(voteNames).map(([id, name]) => (
            <button
              type="button"
              className="se-secondary"
              key={id}
              aria-pressed={vote?.own === id}
              disabled={!access || busy || !!vote?.own}
              onClick={() => act('vote', { choice: id })}
            >
              <span>
                {name}
                {vote?.own === id ? ' · твой голос' : ''}
              </span>
              <strong>{vote?.counts[id] || 0}</strong>
            </button>
          ))}
        </div>
        <p className="sw-fine-print">
          {vote?.own
            ? 'Твой голос сохранён. Один аккаунт — один голос за неделю.'
            : 'Каждый участник с активной подпиской может проголосовать один раз.'}
        </p>
        <p className="sw-fine-print">
          При ничьей или отсутствии голосов: площадь → дата-центр → орбита. Общие цели и цены от
          голосования не меняются.
        </p>
        {!!vote?.results.length && (
          <ul className="sw-history">
            {vote.results.map((result) => (
              <li key={result.week}>
                <strong>
                  Неделя {result.week + 1}: {voteNames[result.choice as keyof typeof voteNames]}
                </strong>
                <span>
                  {Object.values(result.counts).reduce((a, b) => a + b, 0)
                    ? 'Выбор участников'
                    : 'Голосов не было — заранее объявленный вариант'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
