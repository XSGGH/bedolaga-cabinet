import { useEffect, useRef, useState, memo } from 'react';
import type { WheelPrize } from '../../api/wheel';
import { jackpotIds, prizeLabel, prizeTypeColor } from './wheelFaceModel';

/** Колесо рисуется в квадрате 620×620, сверху ещё 30 под указатель. */
const SIZE = 620;
const CENTER = SIZE / 2;
const SPIN_DURATION_MS = 5000;
/** Пять полных оборотов до целевого сектора. */
const SPIN_EXTRA_TURNS_DEG = 1800;

// Та же кривая, что раньше стояла в CSS-переходе: cubic-bezier(0.15, 0.6, 0.1, 1).
const [EASE_X1, EASE_Y1, EASE_X2, EASE_Y2] = [0.15, 0.6, 0.1, 1];

function bezierAxis(a1: number, a2: number, t: number): number {
  return (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
}

function bezierSlope(a1: number, a2: number, t: number): number {
  return 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
}

/** Доля пути по времени 0..1 → доля поворота 0..1. */
export function spinEasing(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const slope = bezierSlope(EASE_X1, EASE_X2, t);
    if (slope === 0) break;
    t -= (bezierAxis(EASE_X1, EASE_X2, t) - x) / slope;
  }
  return bezierAxis(EASE_Y1, EASE_Y2, Math.min(1, Math.max(0, t)));
}

function rotateAttr(angle: number): string {
  return `rotate(${angle} ${CENTER} ${CENTER})`;
}

interface FortuneWheelProps {
  prizes: WheelPrize[];
  isSpinning: boolean;
  targetRotation: number | null;
  onSpinComplete: () => void;
}

const FortuneWheel = memo(function FortuneWheel({
  prizes,
  isSpinning,
  targetRotation,
  onSpinComplete,
}: FortuneWheelProps) {
  const wheelRef = useRef<SVGGElement>(null);
  const accumulatedRotation = useRef(0);
  // Угол покоя: пока идёт спин, React рисует прежний угол и в DOM не лезет,
  // атрибут ведёт кадр за кадром сам спин; по его концу угол покоя догоняет.
  const [restAngle, setRestAngle] = useState(0);
  const latestOnComplete = useRef(onSpinComplete);
  latestOnComplete.current = onSpinComplete;

  useEffect(() => {
    if (!isSpinning || targetRotation === null) return;
    const group = wheelRef.current;
    if (!group) return;
    const from = accumulatedRotation.current;
    let delta = targetRotation - (from % 360);
    while (delta < 0) delta += 360;
    const to = from + SPIN_EXTRA_TURNS_DEG + delta;
    accumulatedRotation.current = to;

    // Крутим SVG-атрибутом по requestAnimationFrame, а не CSS-transform с переходом:
    // CSS-transform на <g> заводит отдельный композитный слой, и Android WebView на
    // части устройств (Xiaomi 12, 17.09.2026) рисует его плитки чёрными квадратами
    // поверх секторов. Атрибут рисуется вместе со всем SVG — компоновать нечего.
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / SPIN_DURATION_MS);
      group.setAttribute('transform', rotateAttr(from + (to - from) * spinEasing(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      setRestAngle(to);
      latestOnComplete.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isSpinning, targetRotation]);

  if (prizes.length === 0) {
    return (
      <div className="mx-auto flex aspect-square w-full max-w-md items-center justify-center">
        <p className="text-dark-400">No prizes configured</p>
      </div>
    );
  }

  const center = CENTER;
  const sectorAngle = 360 / prizes.length;
  const sectorRadius = 272;
  const hubRadius = 76;
  const jackpots = jackpotIds(prizes);
  const labelFont = prizes.length <= 12 ? 36 : prizes.length <= 16 ? 31 : 27;
  const rimInset = Math.min(3.5, sectorAngle * 0.2);

  const point = (angleDeg: number, radius: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  };

  const sectorPath = (index: number) => {
    const from = point(index * sectorAngle, sectorRadius);
    const to = point((index + 1) * sectorAngle, sectorRadius);
    const largeArc = sectorAngle > 180 ? 1 : 0;
    return `M ${center} ${center} L ${from.x} ${from.y} A ${sectorRadius} ${sectorRadius} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
  };

  const rimPath = (index: number) => {
    const from = point(index * sectorAngle + rimInset, 263);
    const to = point((index + 1) * sectorAngle - rimInset, 263);
    return `M ${from.x} ${from.y} A 263 263 0 0 1 ${to.x} ${to.y}`;
  };

  return (
    <div className="relative mx-auto w-full max-w-[560px] select-none">
      {/* Мягкое свечение за колесом: обычный div, не SVG-фильтр */}
      <div
        className={`absolute inset-[4%] rounded-full transition-all duration-500 ${
          isSpinning ? 'scale-105 opacity-100' : 'opacity-70'
        }`}
        style={{
          background:
            'radial-gradient(circle, rgba(163, 92, 255, 0.45) 0%, rgba(236, 72, 153, 0.18) 45%, transparent 72%)',
          filter: 'blur(28px)',
        }}
      />

      <div className="relative" style={{ aspectRatio: '620 / 650' }}>
        <svg viewBox={`0 -30 ${SIZE} 650`} className="h-full w-full" role="img">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C79BFF" />
              <stop offset="50%" stopColor="#A35CFF" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <linearGradient id="bezelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A2A80" />
              <stop offset="50%" stopColor="#150A2B" />
              <stop offset="100%" stopColor="#5A33A0" />
            </linearGradient>
            <linearGradient id="jackpotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A35CFF" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <radialGradient
              id="vignetteGrad"
              gradientUnits="userSpaceOnUse"
              cx={center}
              cy={center}
              r={sectorRadius}
            >
              <stop offset="15%" stopColor="#0C0718" stopOpacity="0.75" />
              <stop offset="60%" stopColor="#0C0718" stopOpacity="0" />
              <stop offset="100%" stopColor="#A35CFF" stopOpacity="0.1" />
            </radialGradient>
            <radialGradient id="hubGrad" cx="50%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#5B2BB8" />
              <stop offset="65%" stopColor="#22104A" />
              <stop offset="100%" stopColor="#0F0620" />
            </radialGradient>
            <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="55%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="faceClip">
              <circle cx={center} cy={center} r={sectorRadius} />
            </clipPath>
          </defs>

          {/* Подложка и обод */}
          <circle cx={center} cy={center + 8} r={309} fill="rgba(0,0,0,0.45)" />
          <circle cx={center} cy={center} r={309} fill="url(#bezelGrad)" />
          <circle cx={center} cy={center} r={302} fill="#0C0718" />
          <circle cx={center} cy={center} r={290} fill="#10081F" />

          {/* Вращающаяся группа — угол атрибутом, см. эффект спина выше */}
          <g ref={wheelRef} transform={rotateAttr(restAngle)}>
            {prizes.map((prize, index) => (
              <path
                key={`sector-${prize.id}`}
                d={sectorPath(index)}
                fill={
                  jackpots.has(prize.id)
                    ? 'url(#jackpotGrad)'
                    : index % 2 === 0
                      ? '#1B0F36'
                      : '#150A2B'
                }
              />
            ))}
            <circle cx={center} cy={center} r={sectorRadius} fill="url(#vignetteGrad)" />

            {prizes.map((prize, index) => {
              const edge = point(index * sectorAngle, sectorRadius);
              return (
                <line
                  key={`divider-${prize.id}`}
                  x1={center}
                  y1={center}
                  x2={edge.x}
                  y2={edge.y}
                  stroke="#2F1B57"
                  strokeWidth="1.6"
                />
              );
            })}

            {prizes.map((prize, index) => (
              <path
                key={`rim-${prize.id}`}
                d={rimPath(index)}
                fill="none"
                stroke={jackpots.has(prize.id) ? '#FFFFFF' : prizeTypeColor(prize.prize_type)}
                strokeWidth="5"
                strokeLinecap="round"
              />
            ))}

            {prizes.map((prize, index) => {
              const label = prizeLabel(prize);
              const jackpot = jackpots.has(prize.id);
              const rotation = index * sectorAngle + sectorAngle / 2;
              const dim = prize.prize_type === 'nothing';
              return (
                <g key={`label-${prize.id}`} transform={`rotate(${rotation} ${center} ${center})`}>
                  <text
                    x={center}
                    y={label.unit ? 106 : 114}
                    textAnchor="middle"
                    fontSize={labelFont}
                    fontWeight="800"
                    letterSpacing="-0.02em"
                    fill={dim ? '#6E5F8A' : '#FFFFFF'}
                  >
                    {label.main}
                  </text>
                  {label.unit && (
                    <text
                      x={center}
                      y={128}
                      textAnchor="middle"
                      fontSize={label.unit === '₽' ? 17 : 12}
                      fontWeight="700"
                      letterSpacing="0.12em"
                      fill={jackpot ? '#F3E8FF' : '#A896C4'}
                    >
                      {label.unit}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Обод, шкала и ступица рисуются ПОСЛЕ вращающейся группы. Они с ней не
              пересекаются, поэтому на вид порядок безразличен. Но у группы есть
              трансформация, и Android WebView на части устройств (Xiaomi 12,
              17.09.2026) выносит её в отдельный слой, чьи прозрачные пиксели
              «пробивают» всё, что нарисовано ниже, до подложки Telegram: обод
              пропадал везде, где его накрывал квадрат группы. Выше группы обод
              ничем не накрыт. Фильтров в SVG нет: свечение — широкие
              полупрозрачные штрихи. */}
          <g clipPath="url(#faceClip)" pointerEvents="none">
            <ellipse
              cx="240"
              cy="130"
              rx="260"
              ry="150"
              fill="url(#glossGrad)"
              transform="rotate(-18 240 130)"
            />
          </g>
          <circle
            cx={center}
            cy={center}
            r={297}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="9"
            opacity="0.25"
          />
          <circle
            cx={center}
            cy={center}
            r={297}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="3"
          />

          {/* Шкала по ободу; при спине бегущий отсвет — чистый CSS, без перерисовок React */}
          <style>
            {`
              @keyframes tickChase {
                0%, 100% { stroke: #3A2466; }
                10%, 30% { stroke: #C79BFF; }
              }
              .tick-dot { animation: tickChase 6s linear infinite; }
              .tick-spinning .tick-dot { animation-duration: 2s; }
            `}
          </style>
          <g className={isSpinning ? 'tick-spinning' : undefined}>
            {Array.from({ length: 80 }).map((_, i) => {
              const major = i % 4 === 0;
              const a = point(i * 4.5, major ? 278 : 281);
              const b = point(i * 4.5, 288);
              return (
                <line
                  key={`tick-${i}`}
                  className={major ? 'tick-dot' : undefined}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={major ? '#7A55B8' : '#3A2466'}
                  strokeWidth={major ? 1.6 : 1}
                  style={major ? { animationDelay: `${(i / 80) * 6}s` } : undefined}
                />
              );
            })}
          </g>

          {/* Ступица */}
          <circle cx={center} cy={center} r={hubRadius + 8} fill="rgba(163,92,255,0.18)" />
          <circle cx={center} cy={center} r={hubRadius} fill="#0C0718" />
          <circle
            cx={center}
            cy={center}
            r={72}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="3"
          />
          <circle cx={center} cy={center} r={66} fill="url(#hubGrad)" />
          <text
            x={center}
            y={center - 5}
            textAnchor="middle"
            fontSize="24"
            fontWeight="800"
            letterSpacing="0.04em"
            fill="#FFFFFF"
          >
            XSG
          </text>
          <text
            x={center}
            y={center + 17}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.34em"
            fill="#C79BFF"
          >
            {isSpinning ? '...' : 'SPIN'}
          </text>

          {/* Указатель */}
          <path
            d="M310 60 L292 26 Q286 8 296 2 Q310 -4 324 2 Q334 8 328 26 Z"
            fill="url(#ringGrad)"
          />
          <path
            d="M310 46 L298 24 Q295 12 301 8 Q310 5 319 8 Q325 12 322 24 Z"
            fill="#0C0718"
            opacity="0.55"
          />
          <circle cx="310" cy="14" r="5" fill="#FFFFFF" />
        </svg>
      </div>
    </div>
  );
});

export default FortuneWheel;
