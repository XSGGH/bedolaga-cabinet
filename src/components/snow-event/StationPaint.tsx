import { useId } from 'react';

/**
 * One fixed camera, one paved entrance, 25 object-specific reveals.
 * Tree variants are separately painted so gifts, ornaments and lights are
 * impossible to reveal before their actual milestones.
 */
type Shape =
  | { kind: 'oval'; x: number; y: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; radius?: number }
  | { kind: 'path'; d: string };
const oval = (x: number, y: number, rx: number, ry: number): Shape => ({ kind: 'oval', x, y, rx, ry });
const rect = (x: number, y: number, width: number, height: number, radius = 8): Shape => ({ kind: 'rect', x, y, width, height, radius });

// Server stage names are the source of truth; do not reorder these reveals.
const milestones: Readonly<Record<number, readonly Shape[]>> = {
  1: [oval(436, 720, 43, 140)], // Первый большой фонарь; don't expose the later visiting cat
  2: [rect(30, 359, 335, 184), rect(472, 355, 125, 64)], // Свет в окнах серверной
  3: [oval(495, 607, 42, 58), oval(681, 577, 45, 44), oval(1168, 525, 42, 53), oval(1251, 622, 46, 59), oval(1202, 792, 48, 58)], // Освещённая дорожка
  4: [oval(1130, 503, 105, 48), oval(612, 547, 93, 71)], // Праздничный въезд, existing access only
  5: [oval(402, 386, 76, 52)], // Сияющая надпись XSG
  6: [oval(1442, 567, 75, 68)], // Ящики с украшениями, not the cats alongside
  9: [rect(17, 306, 420, 55), oval(431, 752, 27, 96)], // Гирлянды на деревьях и фонарях
  11: [rect(484, 345, 343, 173), rect(59, 473, 277, 74)], // Подсветка фасада
  13: [oval(1334, 571, 63, 61), oval(1350, 647, 73, 57)], // Коты-помощники
  15: [rect(440, 286, 393, 76), rect(1074, 364, 435, 110), oval(520, 474, 151, 80)], // Большое включение огней
  17: [{ kind: 'path', d: 'M 205 585 L 369 585 L 382 785 L 248 785 L 246 739 L 208 737 Z' }], // Фотобудка без преждевременного появления соседней ледяной скульптуры
  18: [{ kind: 'path', d: 'M 532 949 L 532 792 Q 544 671 696 654 Q 872 651 913 809 L 924 955 L 822 963 L 815 832 Q 782 753 723 752 Q 656 752 638 837 L 638 963 Z' }], // Арка над ЕДИНСТВЕННЫМ центральным проходом
  19: [oval(134, 798, 131, 131)], // Большая ледяная скульптура
  20: [oval(1395, 795, 177, 139)], // Праздничные сани
  21: [oval(376, 807, 75, 72)], // Коты-гости на станции
  23: [oval(1139, 46, 131, 77)], // Большое созвездие
  25: [oval(1076, 153, 125, 80)], // Небесное представление
};

const garlandFirs: readonly Shape[] = [oval(100, 623, 90, 80), oval(521, 919, 62, 73), oval(1515, 600, 49, 80)];
const centerTree: Shape = {
  kind: 'path',
  d: 'M 884 248 C 909 301 966 389 1000 459 C 1035 536 1069 637 1039 676 C 966 684 820 682 768 659 C 750 623 779 554 811 474 C 846 384 859 315 884 248 Z',
};
const asset = {
  final: '/xsg-snow-assets/station-v5-festival.webp',
  bare: '/xsg-snow-assets/station-v5-tree-bare.webp',
  baubles: '/xsg-snow-assets/station-v5-tree-baubles.webp',
  lights: '/xsg-snow-assets/station-v5-tree-lights.webp',
  smallFirs: '/xsg-snow-assets/station-v5-fir-garlands.webp',
  aurora: '/xsg-snow-assets/station-v5-aurora.webp',
  satellite: '/xsg-snow-assets/station-v5-orbit.webp',
};

function Shapes({ items }: { items: readonly Shape[] }) {
  return <>{items.map((item, index) => {
    if (item.kind === 'oval') return <ellipse key={index} cx={item.x} cy={item.y} rx={item.rx} ry={item.ry} fill="white" />;
    if (item.kind === 'rect') return <rect key={index} x={item.x} y={item.y} width={item.width} height={item.height} rx={item.radius} fill="white" />;
    return <path key={index} d={item.d} fill="white" />;
  })}</>;
}

export default function StationPaint({ count }: { count: number }) {
  const id = `sv5-${useId().replace(/:/g, '')}`;
  const stage = Math.max(0, Math.min(25, Math.floor(count)));
  const mask = (name: string) => `${id}-${name}`;
  const url = (name: string) => `url(#${mask(name)})`;
  const visible = Object.entries(milestones).filter(([step]) => Number(step) <= stage).flatMap(([, regions]) => regions);
  const painterly = (items: readonly Shape[]) => <g filter={`url(#${mask('feather')})`}><Shapes items={items} /></g>;
  const maskElement = (name: string, items: readonly Shape[]) => <mask id={mask(name)} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
    <rect width="1536" height="1024" fill="black" />{painterly(items)}
  </mask>;
  const plate = (href: string, name: string) => <image href={href} width="1536" height="1024" mask={url(name)} />;

  return <svg className="sv4-station-details" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
    <defs>
      <filter id={mask('feather')} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id={mask('sky-feather')} x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="35" /></filter>
      <filter id={mask('orbit-feather')} x="-40%" y="-100%" width="180%" height="300%"><feGaussianBlur stdDeviation="16" /></filter>
      {maskElement('main', visible)}
      {maskElement('firs', stage >= 9 ? garlandFirs : [])}
      {maskElement('tree', [centerTree])}
      {maskElement('gifts', [oval(923, 672, 113, 48)])}
      {maskElement('star', [oval(886, 258, 41, 53)])}
      <mask id={mask('aurora-early')} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
        <rect width="1536" height="1024" fill="black" />
        <ellipse cx="685" cy="64" rx="355" ry="106" fill="white" filter={url('sky-feather')} opacity=".75" />
      </mask>
      <mask id={mask('aurora-bright')} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
        <rect width="1536" height="1024" fill="black" />
        <path d="M -40 -60 H 1570 V 93 Q 1385 145 1244 141 Q 1006 226 845 198 Q 565 210 395 175 Q 145 156 -40 208 Z" fill="white" filter={url('sky-feather')} />
      </mask>
      <mask id={mask('orbit')} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
        <rect width="1536" height="1024" fill="black" />
        <ellipse cx="1369" cy="142" rx="59" ry="28" fill="white" filter={url('orbit-feather')} />
      </mask>
      {maskElement('fireworks', [oval(1086, 150, 146, 94)])}
    </defs>
    {plate(asset.final, 'main')}
    {stage >= 7 && plate(stage >= 10 ? asset.lights : stage >= 8 ? asset.baubles : asset.bare, 'tree')}
    {stage >= 9 && plate(asset.smallFirs, 'firs')}
    {stage >= 12 && plate(asset.final, 'gifts')}
    {stage >= 14 && plate(asset.final, 'star')}
    {stage >= 16 && plate(asset.aurora, 'aurora-early')}
    {stage >= 24 && plate(asset.aurora, 'aurora-bright')}
    {stage >= 22 && plate(asset.satellite, 'orbit')}
    {stage >= 25 && plate(asset.final, 'fireworks')}
  </svg>;
}
