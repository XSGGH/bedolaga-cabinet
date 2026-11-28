import { useId } from 'react';

/**
 * The station never changes its camera or floor plan. Each milestone unveils
 * a softly feathered piece of a single, painterly holiday treatment of the
 * original plate. No SVG decoration or whole-frame crossfade is allowed.
 * The path arch is an independent transparent illustration at stage 18.
 */
type Region = readonly [number, number, number, number];

const paintedRegions: readonly (readonly Region[])[] = [
  [[185, 408, 147, 86]], // 1: first windows
  [[494, 606, 105, 90]], // 2: warm path bollards
  [[329, 692, 46, 112]], // 3: left vintage lamp
  [[1251, 475, 152, 80]], // 4: workshop windows
  [[236, 334, 205, 41]], // 5: left eaves garland
  [[1304, 405, 217, 65]], // 6: chalet garland
  [[885, 596, 115, 143]], // 7: Christmas tree in the plaza
  [[814, 518, 115, 86]], // 8: upper plaza lights
  [[1398, 797, 115, 72]], // 9: gifts beside the path
  [[1388, 648, 112, 90]], // 10: winter bench
  [[649, 389, 194, 93]], // 11: more lit windows
  [[502, 490, 107, 94]], // 12: festive entrance
  [[885, 471, 47, 43]], // 13: star above the tree
  [[1076, 732, 144, 89]], // 14: right path lights
  [[1171, 506, 93, 73]], // 15: chalet entrance
  [[837, 113, 565, 124]], // 16: real, wispy northern lights
  [[147, 792, 120, 113]], // 17: tiny photo booth
  [], // 18: separate arch on the ORIGINAL path, no generated paving
  [[1367, 836, 105, 49]], // 19: presents and reflected snow glow
  [[100, 559, 82, 112]], // 20: softly lit trees
  [[1248, 622, 87, 81]], // 21: pathway lanterns
  [[356, 72, 291, 76]], // 22: extra celestial sparkle
  [[158, 496, 119, 79]], // 23: the lower data-centre windows
  [[1411, 559, 103, 86]], // 24: snow-side lights
  [], // 25: last milestone adds the sky's painterly fireworks
];

const fireworkRegions: Region[] = [
  [680, 155, 52, 66], [742, 162, 51, 64], [823, 156, 52, 67], [897, 167, 47, 62],
];

const decoratedArt = '/xsg-snow-assets/station-v4-painted.webp';
const finalSkyArt = '/xsg-snow-assets/station-v3-festival.webp';

function Regions({ regions }: { regions: readonly Region[] }) {
  return <>{regions.map(([cx, cy, rx, ry], index) =>
    <ellipse key={index} cx={cx} cy={cy} rx={rx} ry={ry} fill="white" />,
  )}</>;
}

export default function StationPaint({ count }: { count: number }) {
  const id = useId().replace(/:/g, '');
  const revealed = Math.max(0, Math.min(25, count));
  const softMaskId = `station-soft-mask-${id}`;
  const skyMaskId = `station-sky-mask-${id}`;
  const featherId = `station-feather-${id}`;
  return <>
    <svg className="sv4-station-details" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <filter id={featherId} x="-18%" y="-18%" width="136%" height="136%"><feGaussianBlur stdDeviation="17" /></filter>
        <mask id={softMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
          <rect width="1536" height="1024" fill="black" />
          <g filter={`url(#${featherId})`}><Regions regions={paintedRegions.slice(0, revealed).flat()} /></g>
        </mask>
        <mask id={skyMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
          <rect width="1536" height="1024" fill="black" />
          <g filter={`url(#${featherId})`}><Regions regions={revealed >= 25 ? fireworkRegions : []} /></g>
        </mask>
      </defs>
      <image href={decoratedArt} width="1536" height="1024" mask={`url(#${softMaskId})`} />
      {revealed >= 25 && <image href={finalSkyArt} width="1536" height="1024" mask={`url(#${skyMaskId})`} />}
    </svg>
    {revealed >= 18 && <img className="sv4-station-arch" src="/xsg-snow-assets/station-arch-cutout.webp" alt="" aria-hidden="true" draggable={false} />}
  </>;
}
