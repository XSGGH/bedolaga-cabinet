import { useId } from 'react';

// Each milestone adds a small, permanent physical detail to the *same* scene.
// Never blend a second complete painting over the station: that caused ghosts,
// prematurely revealed fireworks, and half-transparent characters.
type DetailProps = { count: number };

const facadeLights = [
  [65, 377], [93, 380], [124, 384], [155, 389], [186, 392], [218, 394],
  [250, 397], [282, 400], [311, 405], [341, 406], [379, 411],
];
const walkwayLights = [
  [404, 708], [503, 654], [736, 839], [1042, 569], [1249, 614], [1331, 722],
];
const skyStars = [[199, 112], [258, 95], [338, 135], [602, 73], [773, 112], [944, 98], [1176, 123]];

function Lamp({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <ellipse cy="6" rx="19" ry="6" fill="#1e1536" opacity=".3" />
    <path d="M-3 -4L-2 -91H2L3 -4Z" fill="#392b39" stroke="#dfb47a" strokeWidth="2" />
    <path d="M-16 -92L-11 -116H11L16 -92Z" fill="#402d45" stroke="#e1af6b" strokeWidth="3" />
    <path d="M-10 -94L-8 -111H8L10 -94Z" fill="#ffd989" stroke="#ffedbc" strokeWidth="2" />
    <path d="M-16 -116Q0 -133 16 -116" fill="none" stroke="#e9c38a" strokeWidth="3" />
    <circle cy="-104" r="30" fill="#ffe1a0" opacity=".11" />
  </g>;
}

function Garland({ path, bulbs }: { path: string; bulbs: [number, number][] }) {
  return <g>
    <path d={path} stroke="#203a31" strokeWidth="8" fill="none" strokeLinecap="round" />
    <path d={path} stroke="#a67d4f" strokeWidth="2" fill="none" strokeLinecap="round" />
    {bulbs.map(([x,y],i) => <g key={i}>
      <circle cx={x} cy={y} r="6.5" fill="#ffc56e" opacity=".15" />
      <circle cx={x} cy={y} r="2.2" fill={i % 4 ? '#ffd998' : '#f7a2ce'} />
    </g>)}
  </g>;
}

function Gift({ x,y,size = 1 }: { x:number; y:number; size?:number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <ellipse cy="1" rx="27" ry="8" fill="#2c2149" opacity=".32" />
    <path d="M-19 -40L18 -43L22 -3L-18 -1Z" fill="#65417d" stroke="#cda1d7" strokeWidth="2.5" />
    <path d="M-22 -43L15 -48L23 -41L-16 -35Z" fill="#ae8bc7" />
    <path d="M-4 -45L1 -2M-21 -22L21 -24" stroke="#f3c982" strokeWidth="6" fill="none" />
    <path d="M0 -47C-26 -63 -25 -38 -1 -42C15 -69 27 -52 1 -42" fill="none" stroke="#efd18e" strokeWidth="5" strokeLinecap="round" />
  </g>;
}

function Star({ x, y, size = 7 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <circle r={size * 2.2} fill="#ffcf78" opacity=".07" />
    <path d={`M0 ${-size}L${size * .2} ${-size * .2}L${size} 0L${size * .2} ${size * .2}L0 ${size}L${-size * .2} ${size * .2}L${-size} 0L${-size * .2} ${-size * .2}Z`} fill="#ffe7b3" />
  </g>;
}

const decoratedSteps = [
  // 1 First window lights, 2 warm path, 3 first grand lantern.
  <g key="1">{facadeLights.slice(0,5).map(([x,y])=><rect key={x} x={x} y={y} width="17" height="37" rx="2" fill="#ffd596" opacity=".38" />)}</g>,
  <g key="2"><path d="M622 955Q687 878 747 832" fill="none" stroke="#eecb9b" strokeWidth="4" strokeDasharray="3 17" opacity=".8" />{[700,780,870].map(x=><Star key={x} x={x} y={1040-x/4} size={4}/>)}</g>,
  <g key="3"><Lamp x={420} y={775} size={1.05}/></g>,
  // 4 workshop windows, 5 data-centre roof garlands, 6 workshop eaves.
  <g key="4"><path d="M1140 457L1189 463L1189 503L1140 498ZM1263 460L1302 463L1302 503L1263 504Z" fill="#f7c479" opacity=".42" /></g>,
  <g key="5"><Garland path="M27 333Q132 350 227 353Q348 365 450 335" bulbs={[[32,336],[75,344],[116,349],[165,353],[207,355],[254,357],[296,358],[344,355],[390,346],[444,335]]}/></g>,
  <g key="6"><Garland path="M1073 437Q1150 386 1252 349Q1350 404 1487 428" bulbs={[[1080,433],[1122,408],[1170,380],[1211,363],[1252,352],[1302,377],[1350,403],[1392,416],[1435,422],[1482,428]]}/></g>,
  // 7 The large real illustrated tree is an independent transparent image.
  <g key="7" />,
  // 8 distinct ground lantern, 9 arch, 10 gift display.
  <g key="8"><Lamp x={1213} y={681} size={.58}/></g>,
  <g key="9"><path d="M251 813V739Q250 657 313 658Q379 660 379 744V812" stroke="#b68c60" strokeWidth="11" fill="none"/><path d="M256 745Q252 663 314 663Q374 669 372 744" stroke="#ffe1aa" strokeWidth="3" fill="none"/><Star x={313} y={656} size={13}/></g>,
  <g key="10"><Gift x={951} y={837} size={.86}/><Gift x={987} y={850} size={.52}/></g>,
  // 11 more data windows, 12 festive front entrance, 13 constellation.
  <g key="11">{facadeLights.slice(5).map(([x,y])=><rect key={x} x={x} y={y} width="17" height="37" rx="2" fill="#ffd596" opacity=".4" />)}</g>,
  <g key="12"><Garland path="M431 460Q500 448 580 450" bulbs={[[435,462],[452,458],[474,456],[500,453],[525,452],[552,452],[578,451]]}/><Star x={508} y={451} size={10}/></g>,
  <g key="13"><path d="M219 101L260 120L305 101L349 118L394 101" stroke="#eac68f" strokeWidth="2" fill="none"/>{[[219,101],[260,120],[305,101],[349,118],[394,101]].map(([x,y])=><Star key={x} x={x} y={y} size={6}/>)}</g>,
  // 14 snowy fairy lights in the plaza, 15 another lantern, 16 the sky's FIRST aurora.
  <g key="14">{walkwayLights.map(([x,y])=><g key={x}><circle cx={x} cy={y-16} r="15" fill="#ffd68d" opacity=".1"/><circle cx={x} cy={y-16} r="4" fill="#fff2be" /></g>)}</g>,
  <g key="15"><Lamp x={852} y={515} size={.35}/></g>,
  <g key="16"><path d="M0 75Q245 11 469 67Q666 131 834 47Q1050 -5 1247 39Q1379 67 1536 12" stroke="#77e9b2" strokeWidth="34" strokeLinecap="round" opacity=".2" fill="none"/><path d="M0 84Q252 27 459 75Q659 140 841 54Q1040 10 1239 43Q1407 79 1536 26" stroke="#bb82ee" strokeWidth="10" strokeLinecap="round" opacity=".32" fill="none"/></g>,
  // 17 snow-covered gift stand, 18 the starry arch at the tree, 19 workshop lamps.
  <g key="17"><Gift x={1398} y={635} size={.65}/><Gift x={1444} y={643} size={.45}/></g>,
  <g key="18"><Star x={820} y={455} size={11}/><Star x={768} y={507} size={5}/><Star x={876} y={499} size={5}/></g>,
  <g key="19"><Lamp x={1422} y={600} size={.35}/><Lamp x={1167} y={542} size={.3}/></g>,
  // 20 decorations around the park, 21 snow-trail glow, 22 overhead ornaments.
  <g key="20">{[[174,783],[203,821],[317,883]].map(([x,y])=><Star key={x} x={x} y={y} size={5}/>)}</g>,
  <g key="21"><path d="M390 919Q449 903 512 924" fill="none" stroke="#f6deaf" strokeWidth="4" strokeDasharray="1 15"/><Star x={462} y={918} size={8}/></g>,
  <g key="22">{skyStars.map(([x,y],i)=><Star key={x} x={x} y={y} size={i%2?11:8}/>)}</g>,
  // 23 photo booth, 24 fireworks and 25 the final festive sky.
  <g key="23"><path d="M78 825V745L126 706L182 737V825Z" fill="#51334f" stroke="#edc08d" strokeWidth="5"/><path d="M110 821V757Q127 741 151 757V821" fill="#a36b5b"/><Star x={129} y={716} size={9}/></g>,
  <g key="24">{[[674,174],[833,126],[940,160]].map(([x,y])=><g key={x}>{Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <path key={i} d={`M${x+Math.cos(a)*14} ${y+Math.sin(a)*14}L${x+Math.cos(a)*43} ${y+Math.sin(a)*43}`} stroke="#f7ce99" strokeWidth="3" strokeLinecap="round" opacity=".85"/>;})}</g>)}</g>,
  <g key="25"><path d="M0 43Q228 3 456 41Q685 83 850 30Q1009 -14 1170 29Q1343 67 1536 17" stroke="#90f1be" strokeWidth="22" strokeLinecap="round" opacity=".27" fill="none"/>{[[525,91],[710,63],[982,105],[1248,80]].map(([x,y])=><Star key={x} x={x} y={y} size={13}/>)}</g>,
];

export default function StationDetails({ count }: DetailProps) {
  const filterId = useId().replace(/:/g, '');
  return <svg className="sv4-station-details" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs><filter id={filterId} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" /></filter></defs>
    {decoratedSteps.slice(0, Math.max(0, Math.min(25,count)))}
  </svg>;
}
