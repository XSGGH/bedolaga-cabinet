import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { SnowState } from '@/api/snowEvent';

const zones = [
  {
    id: 'data',
    name: 'Дата-центр XSG',
    x: 23,
    y: 40,
    text: 'Серверная просыпается: окна, въезд и фасад постепенно наполняются тёплым светом.',
  },
  {
    id: 'plaza',
    name: 'Центральная площадь',
    x: 49,
    y: 69,
    text: 'Здесь вырастет большая ёлка, появятся подарки, фотозона и ледяные скульптуры.',
  },
  {
    id: 'workshop',
    name: 'Мастерская кота',
    x: 83,
    y: 48,
    text: 'Упаковка, украшения и сани. Котам-помощникам всегда найдётся дело.',
  },
  {
    id: 'orbit',
    name: 'Звёздная орбита',
    x: 64,
    y: 13,
    text: 'Впереди спутники, созвездия, северное сияние и большое небесное представление.',
  },
];
const props = [
  {
    at: 100,
    sprite: 0,
    x: 32,
    y: 76,
    size: 11,
    label: 'Большой фонарь',
    reaction: 'Фонарь подмигивает. Здесь стало чуточку теплее.',
  },
  {
    at: 400,
    sprite: 3,
    x: 34,
    y: 55,
    size: 12,
    label: 'Праздничный въезд',
    reaction: 'Вход в зимнюю сказку открыт!',
  },
  {
    at: 600,
    sprite: 4,
    x: 77,
    y: 62,
    size: 14,
    label: 'Ящики с украшениями',
    reaction: 'Мяу! В этом ящике только небьющиеся игрушки. Надеюсь…',
  },
  {
    at: 700,
    sprite: 1,
    x: 50,
    y: 80,
    size: 35,
    label: 'Большая ёлка',
    reaction: 'Ёлка для всей орбиты. Настоящая красавица!',
  },
  {
    at: 1200,
    sprite: 2,
    x: 56,
    y: 83,
    size: 13,
    label: 'Подарки под ёлкой',
    reaction: 'Каждая коробка — чья-то маленькая радость. Загляни в магазин подарков.',
  },
  {
    at: 1300,
    sprite: 6,
    x: 87,
    y: 64,
    size: 16,
    label: 'Коты-помощники',
    reaction: 'Мы уже тут! Куда нести гирлянду?',
  },
  {
    at: 2000,
    sprite: 9,
    x: 24,
    y: 88,
    size: 22,
    label: 'Фотозона',
    reaction: 'Улыбнись! Этот кадр останется в нашей зимней истории.',
  },
  {
    at: 2250,
    sprite: 3,
    x: 79,
    y: 91,
    size: 25,
    label: 'Световая арка',
    reaction: 'Арка сияет золотом — кажется, даже космос улыбается.',
  },
  {
    at: 2500,
    sprite: 8,
    x: 37,
    y: 88,
    size: 21,
    label: 'Ледяная скульптура',
    reaction: 'Не облизывать. Кот проверял — очень холодная!',
  },
  {
    at: 2750,
    sprite: 7,
    x: 87,
    y: 76,
    size: 23,
    label: 'Праздничные сани',
    reaction: 'Доставка подарков готова. Только без резких поворотов!',
  },
  {
    at: 3000,
    sprite: 11,
    x: 18,
    y: 70,
    size: 20,
    label: 'Коты-гости',
    reaction: 'Мы прилетели посмотреть на станцию, которую вы построили вместе.',
  },
  {
    at: 3500,
    sprite: 10,
    x: 72,
    y: 22,
    size: 17,
    label: 'Праздничный спутник',
    reaction: 'Передаю с орбиты: у вас там невероятно красиво!',
  },
];
const decorSprites: Record<string, number> = {
  lantern: 0,
  bauble: 12,
  star: 14,
  gift: 2,
  crystal: 13,
};
export function StationSprite({
  index,
  className = '',
  style,
}: {
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`sw-sprite ${className}`}
      style={{
        ...style,
        backgroundPosition: `${((index % 4) * 100) / 3}% ${(Math.floor(index / 4) * 100) / 3}%`,
      }}
    />
  );
}

export default function SnowWorldScene({
  state,
  onSeen,
}: {
  state: SnowState;
  onSeen: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [zone, setZone] = useState('all');
  const [before, setBefore] = useState(false);
  const [playback, setPlayback] = useState<number | null>(null);
  const [reaction, setReaction] = useState('');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const initialNew = useRef(state.world?.new_events || []);
  const events = state.world?.events || [];
  const total = state.world?.total ?? 0;
  const visibleTotal = before ? 0 : playback !== null ? (events[playback]?.threshold ?? 0) : total;
  const target = zones.find((z) => z.id === zone);
  const next = state.world?.stages.find((stage) => stage.threshold > total);
  useEffect(() => {
    if (playback === null) return;
    const timer = window.setTimeout(
      () => {
        if (playback >= events.length - 1) setPlayback(null);
        else setPlayback(playback + 1);
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1600 : 1100,
    );
    return () => clearTimeout(timer);
  }, [playback, events.length]);
  useEffect(() => {
    if (!reaction) return;
    const timer = window.setTimeout(() => setReaction(''), 5000);
    return () => clearTimeout(timer);
  }, [reaction]);
  const showZone = (id: string) => {
    setPan({ x: 0, y: 0 });
    setZone(id);
    setFullscreen(true);
  };
  const replay = () => {
    setBefore(false);
    setPlayback(-1);
    setFullscreen(true);
    setZone('all');
    onSeen();
  };
  const scene = (large: boolean) => (
    <div className={`sw-map ${large ? 'sw-map-full' : ''} ${target ? 'sw-map-zoomed' : ''}`}>
      <div
        className="sw-camera"
        onPointerDown={(event) => {
          if (!target || (event.target as HTMLElement).closest('button')) return;
          dragging.current = { x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragging.current;
          if (drag)
            setPan({
              x: Math.max(-160, Math.min(160, drag.startX + event.clientX - drag.x)),
              y: Math.max(-120, Math.min(120, drag.startY + event.clientY - drag.y)),
            });
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <div
          className={`sw-world ${visibleTotal >= 1500 ? 'sw-world-celebrating' : ''}`}
          style={{
            transformOrigin: target ? `${target.x}% ${target.y}%` : '50% 50%',
            transform: `translate(${pan.x}px,${pan.y}px) scale(${target ? 1.85 : 1})`,
          }}
        >
          <img
            className="sw-background"
            src="/xsg-snow-assets/station-v2.webp"
            width="1536"
            height="1024"
            alt="Единая зимняя станция: современный дата-центр XSG слева, большая площадь, мастерская кота справа и звёздная орбита над ними"
            style={{ filter: `brightness(${0.58 + Math.min(1, visibleTotal / 1500) * 0.38})` }}
          />
          {visibleTotal >= 1750 && (
            <div
              className={`sw-aurora ${visibleTotal >= 4500 ? 'sw-aurora-bright' : ''}`}
              aria-hidden="true"
            />
          )}
          <svg className="sw-light-layer" viewBox="0 0 1536 1024" aria-hidden="true">
            {visibleTotal >= 200 && (
              <g className="sw-windows">
                {Array.from({ length: 18 }, (_, i) => (
                  <rect
                    key={i}
                    x={52 + (i % 6) * 62}
                    y={376 + Math.floor(i / 6) * 47}
                    width="20"
                    height="28"
                    rx="3"
                  />
                ))}
              </g>
            )}
            {visibleTotal >= 300 && (
              <path
                className="sw-path-light"
                d="M540 970Q620 850 1030 775Q1260 660 1030 550M340 790Q250 630 470 570"
              />
            )}
            {visibleTotal >= 500 && (
              <text x="456" y="265" className="sw-sign" transform="rotate(12 456 265)">
                XSG
              </text>
            )}
            {visibleTotal >= 900 && (
              <path
                className="sw-garland"
                d="M30 330Q200 450 360 350Q470 430 600 350M1090 442Q1230 525 1390 425"
              />
            )}
            {visibleTotal >= 1100 && (
              <path
                className="sw-facade"
                d="M3 328Q160 215 300 265L302 570M526 245L525 500M1090 443Q1240 290 1400 440"
              />
            )}
            {Array.from({ length: Math.min(100, Math.floor(visibleTotal / 20)) }, (_, i) => (
              <circle
                className="sw-little-light"
                key={i}
                cx={270 + ((i * 67) % 1000)}
                cy={610 + Math.sin(i * 1.13) * 110 + (i % 3) * 15}
                r="3"
              />
            ))}
            {Array.from(
              { length: Math.min(70, Math.max(0, Math.floor((visibleTotal - 1500) / 50))) },
              (_, i) => (
                <circle
                  key={`orbit-detail-${i}`}
                  cx={150 + ((i * 157) % 1250)}
                  cy={50 + ((i * 41) % 210)}
                  r="2.5"
                  fill="#f8e6c3"
                  opacity="0.8"
                />
              ),
            )}
            {visibleTotal >= 1400 &&
              Array.from({ length: 14 }, (_, i) => (
                <path
                  key={i}
                  className="sw-star-light"
                  transform={`translate(${150 + ((i * 97) % 1200)} ${35 + ((i * 41) % 200)})`}
                  d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z"
                />
              ))}
            {visibleTotal >= 4000 && (
              <path
                className="sw-constellation"
                d="m440 150 115-80 90 80 120-30 110 90 130-130 140 60"
              />
            )}
            {visibleTotal >= 5000 && (
              <g className="sw-finale">
                <path d="M790 20v120m-60-60h120m-102-42 84 84m0-84-84 84" />
                <path d="M1120 80v100m-50-50h100m-85-35 70 70m0-70-70 70" />
              </g>
            )}
          </svg>
          {props
            .filter((prop) => prop.at <= visibleTotal)
            .map((prop) => (
              <button
                key={prop.at}
                type="button"
                className={`sw-object sw-object-${prop.at}`}
                style={{ left: `${prop.x}%`, top: `${prop.y}%`, width: `${prop.size}%` }}
                aria-label={prop.label}
                onClick={() => {
                  setReaction(prop.reaction);
                  if (prop.at === 700) showZone('plaza');
                }}
              >
                <StationSprite index={prop.sprite} />
              </button>
            ))}
          {visibleTotal >= 800 && (
            <div
              className={`sw-tree-jewels ${visibleTotal >= 1000 ? 'sw-tree-lit' : ''}`}
              aria-hidden="true"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${37 + (i % 3) * 6 + (i % 2)}%`,
                    top: `${45 + Math.floor(i / 3) * 7}%`,
                  }}
                />
              ))}
              {visibleTotal >= 1000 && <StationSprite index={14} className="sw-tree-topper" />}
            </div>
          )}
          <button
            type="button"
            className="sw-object sw-cat"
            style={{ left: '65%', top: '91%', width: '20%' }}
            aria-label="Поговорить с котом XSG"
            onClick={() =>
              setReaction(
                visibleTotal >= 1500
                  ? 'МЯУ! Вы сами построили этот праздник. Спасибо каждому 💜'
                  : 'Ой, привет! Одному мне эту огромную станцию не украсить. Поможешь? 💜',
              )
            }
          >
            <StationSprite index={visibleTotal >= 600 && visibleTotal < 1300 ? 5 : 15} />
          </button>
          {(state.world?.vote.results || []).map((result) => (
            <div
              key={result.week}
              className={`sw-vote-decoration sw-vote-${result.choice}`}
              style={{ '--sw-week': result.week } as CSSProperties}
              aria-label={`Выбор недели ${result.week + 1}: ${result.choice}`}
            >
              <StationSprite
                index={result.choice === 'orbit' ? 10 : result.choice === 'data' ? 0 : 14}
              />
            </div>
          ))}
          {(state.world?.decorations || []).map((decoration) => (
            <button
              type="button"
              className="sw-personal-decoration"
              key={decoration.id}
              style={{
                left: `${6 + (decoration.slot % 16) * 5.8}%`,
                top: `${90 + Math.floor(decoration.slot / 16) * 2}%`,
              }}
              aria-label={decoration.own ? 'Твоё украшение на станции' : 'Украшение участника'}
              onClick={() =>
                setReaction(
                  decoration.own
                    ? 'Это твой маленький огонёк в нашем большом празднике 💜'
                    : decoration.name
                      ? `${decoration.name} тоже помог построить праздник.`
                      : 'Ещё один участник оставил здесь частичку тепла.',
                )
              }
            >
              <StationSprite index={decorSprites[decoration.kind] ?? 14} />
            </button>
          ))}
          {!target &&
            zones.map((item) => (
              <button
                type="button"
                className={`sw-hotspot sw-hotspot-${item.id}`}
                key={item.id}
                aria-label={`Рассмотреть: ${item.name}`}
                title={item.name}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onClick={() => showZone(item.id)}
              >
                <span aria-hidden="true">⌕</span>
                <span>{item.name}</span>
              </button>
            ))}
        </div>
      </div>
      {before && <div className="sw-view-label">Было · до украшения станции</div>}
      {playback !== null && (
        <div className="sw-view-label" role="status">
          {playback < 0 ? 'Всё начиналось с одной заснеженной станции…' : events[playback]?.name}
        </div>
      )}
      {reaction && (
        <div className="sw-reaction" role="status">
          <span>{reaction}</span>
          <button type="button" onClick={() => setReaction('')} aria-label="Закрыть реплику кота">
            ×
          </button>
        </div>
      )}
    </div>
  );
  return (
    <section className="se-panel sw-station-panel" aria-labelledby="sw-station-title">
      <div className="se-section-heading">
        <div>
          <p className="se-kicker">Мы сами строим этот праздник</p>
          <h2 id="sw-station-title">Зимняя станция XSG</h2>
        </div>
        <button
          type="button"
          className="sw-small-button"
          onClick={() => {
            setZone('all');
            setFullscreen(true);
          }}
        >
          На весь экран ↗
        </button>
      </div>
      <p className="sw-map-hint">
        Нажми на зону, чтобы приблизить. Кот, фонари и подарки тоже откликаются.
      </p>
      {scene(false)}
      <div className="sw-station-controls">
        <button type="button" onClick={replay} disabled={!events.length}>
          Как мы всё построили
        </button>
        <button
          type="button"
          aria-pressed={before}
          onClick={() => {
            setPlayback(null);
            setBefore(!before);
          }}
        >
          {before ? 'Показать сейчас' : 'Было / Стало'}
        </button>
      </div>
      <div className="sw-station-progress">
        <strong>{total.toLocaleString('ru-RU')} ❄</strong>
        <span>
          {total < 1500
            ? 'Основная цель · 1 500'
            : total < 5000
              ? 'Дополнительная цель · 5 000'
              : 'Вся станция сияет!'}
        </span>
        <progress
          value={Math.min(total, total < 1500 ? 1500 : 5000)}
          max={total < 1500 ? 1500 : 5000}
          aria-label="Снежинки сообщества"
        />
        <p>
          {next
            ? `Дальше: ${next.name.toLocaleLowerCase('ru')} · ещё ${(next.threshold - total).toLocaleString('ru')} ❄`
            : 'Все 25 этапов открыты. Это наш общий зимний мир.'}
        </p>
      </div>
      {initialNew.current.length > 0 && (
        <div className="sw-return-story">
          <strong>Пока тебя не было…</strong>
          <p>
            {initialNew.current
              .slice(-3)
              .map((event) => event.name)
              .join(' · ')}
          </p>
          <button type="button" className="sw-small-button" onClick={replay}>
            Посмотреть изменения
          </button>
        </div>
      )}
      <details className="se-details">
        <summary>Что мы сегодня построили · история станции</summary>
        <ol className="sw-history">
          {events.length ? (
            [...events].reverse().map((event) => (
              <li key={event.id}>
                <strong>{event.name}</strong>
                <span>
                  {event.threshold.toLocaleString('ru')} ❄ ·{' '}
                  {new Intl.DateTimeFormat('ru', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow',
                  }).format(new Date(event.at))}{' '}
                  МСК
                </span>
              </li>
            ))
          ) : (
            <li>Первые огоньки зажгутся на 100 снежинках. Пока история только начинается.</li>
          )}
        </ol>
      </details>
      <details className="se-details">
        <summary>Все 25 целей известны заранее</summary>
        <ol className="sw-history">
          {state.world?.stages.map((stage) => (
            <li key={stage.id}>
              <strong>
                {stage.threshold <= total ? '✓ ' : ''}
                {stage.name}
              </strong>
              <span>{stage.threshold.toLocaleString('ru')} ❄</span>
            </li>
          ))}
        </ol>
      </details>
      <Dialog.Root open={fullscreen} onOpenChange={setFullscreen}>
        <Dialog.Portal>
          <Dialog.Overlay className="snow-event-overlay" />
          <Dialog.Content className="sw-world-dialog">
            <header>
              <div>
                <Dialog.Title>Зимняя станция XSG</Dialog.Title>
                <Dialog.Description>
                  {state.preview
                    ? '🧪 Изолированный тестовый мир'
                    : 'Твой мир, построенный вместе с другими участниками'}
                </Dialog.Description>
              </div>
              <Dialog.Close className="sw-close" aria-label="Закрыть панораму">
                ×
              </Dialog.Close>
            </header>
            <nav aria-label="Зоны станции">
              <button
                type="button"
                aria-pressed={zone === 'all'}
                onClick={() => {
                  setPan({ x: 0, y: 0 });
                  setZone('all');
                }}
              >
                Вся станция
              </button>
              {zones.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={zone === item.id}
                  onClick={() => {
                    setPan({ x: 0, y: 0 });
                    setZone(item.id);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </nav>
            {scene(true)}
            <footer>
              <p>
                {target?.text ||
                  'Приближай зоны кнопками. В приближении панораму можно перемещать пальцем.'}
              </p>
              <div className="sw-station-controls">
                <button type="button" onClick={() => setBefore(!before)}>
                  {before ? 'Вернуть текущее состояние' : 'Было / Стало'}
                </button>
                {playback !== null ? (
                  <button type="button" onClick={() => setPlayback(null)}>
                    Пропустить показ
                  </button>
                ) : (
                  <button type="button" onClick={replay} disabled={!events.length}>
                    Повторить историю
                  </button>
                )}
              </div>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
