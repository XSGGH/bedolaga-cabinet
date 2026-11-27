import { useId } from 'react';
import type { SnowReward } from '@/api/snowEvent';

/** Small native illustrations, rather than a numeral used as the whole reward image. */
export default function SnowRewardArt({ reward }: { reward: SnowReward }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="snow-gift-art" viewBox="0 0 88 88" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ice`} x2="1" y2="1">
          <stop stopColor="#def6ff" />
          <stop offset=".55" stopColor="#bcacfa" />
          <stop offset="1" stopColor="#7560b6" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x2="1" y2="1">
          <stop stopColor="#ffe8b2" />
          <stop offset="1" stopColor="#c3995c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#a38bda" stopOpacity=".26" />
          <stop offset="1" stopColor="#a38bda" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="44" cy="44" r="43" fill={`url(#${id}-glow)`} />
      <g stroke="#c6b5ef" strokeWidth="1.4" strokeLinejoin="round">
        {reward.kind === 'badge' ? (
          <>
            <path d="m29 50-5 27 14-7 8 9 6-27" fill="#72559c" />
            <path d="m49 49 8 29 7-10 13 1-16-25" fill="#9874b8" />
            <path
              d="m44 9 9 5 10 1 4 9 7 8-3 10 1 10-9 6-6 8-10-1-10 3-8-7-9-4-1-10-5-9 5-9 3-10 11-2Z"
              fill={`url(#${id}-gold)`}
              stroke="#f5d69c"
            />
            <circle cx="44" cy="37" r="20" fill="#342f48" stroke="#fde4af" />
            <path d="M32 38V25l9 6h6l9-6v13c0 14-24 14-24 0Z" fill={`url(#${id}-ice)`} />
            <path d="M37 39h2m10 0h2m-9 6h4" stroke="#322844" strokeLinecap="round" />
            <path d="m72 13 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff0c7" stroke="none" />
          </>
        ) : reward.kind === 'decoration' ? (
          <>
            <ellipse
              cx="44"
              cy="46"
              rx="38"
              ry="15"
              transform="rotate(-32 44 46)"
              fill="none"
              stroke="#d9c4ff"
            />
            <circle cx="44" cy="43" r="27" fill="#363147" strokeWidth="3" />
            <circle cx="44" cy="43" r="21" fill="#242331" />
            <path d="M30 45V28l11 7h7l10-7v17c0 17-28 17-28 0Z" fill={`url(#${id}-ice)`} />
            <path
              d="M36 45h2m12 0h2m-10 6h4"
              stroke="#322844"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="m64 14 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill={`url(#${id}-gold)`} />
            <circle cx="17" cy="64" r="4" fill="#f5d69c" />
            <circle cx="73" cy="33" r="2" fill="#e4dcff" />
          </>
        ) : reward.kind === 'traffic' ? (
          <>
            <path
              d="m44 9 24 13 5 28-29 28-29-28 5-28Z"
              fill={`url(#${id}-ice)`}
              stroke="#d4ecff"
            />
            <path
              d="m20 22 24 19 24-19M15 50l29-9 29 9M44 9v69M20 22l24 56 24-56"
              fill="none"
              stroke="#edf6ff"
              opacity=".65"
            />
            <path d="M33 32h22v23H33Z" fill="#342e51" stroke="#e4d7ff" />
            <path d="M37 39h14m-14 5h14m-14 5h8" stroke="#e5d9ff" strokeLinecap="round" />
            <circle cx="69" cy="65" r="10" fill="#403648" stroke="#f5d69c" />
            <path d="M69 59v12m-6-6h12" stroke="#f5d69c" />
          </>
        ) : (
          <>
            <path d="M18 29h52v45H18Z" fill="#6b5792" />
            <path d="M14 23h60v15H14Z" fill={`url(#${id}-ice)`} />
            <path d="M39 23h11v51H39Z" fill={`url(#${id}-gold)`} stroke="#e9ce9d" />
            <path
              d="M43 24C16 24 27 1 38 14l6 10c27 0 19-23 8-11Z"
              fill="none"
              stroke="#e6d6fc"
              strokeWidth="4"
            />
            <circle cx="60" cy="60" r="18" fill="#292737" stroke="#f2d49c" strokeWidth="2" />
            <circle cx="60" cy="60" r="13" fill="none" stroke="#857198" />
            <path d="M60 50v11l7 4" stroke="#f2d49c" strokeWidth="2" strokeLinecap="round" />
            <path d="m17 8 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#e4dcff" stroke="none" />
          </>
        )}
      </g>
    </svg>
  );
}
