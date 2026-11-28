import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { SnowState } from '@/api/snowEvent';
import { catSays } from './snowDialogue';
import { hasSubscription } from './snowPresentation';
import { momentFor, momentNames } from './snowMoments';

// The existing game boards keep their working art and handlers.
export function StationSprite({ index, className = '', style }: { index: number; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`sw-sprite ${className}`} style={{ ...style, backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` }} />;
}
export function WinterArt({ index, className = '', style }: { index: number; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`sv3-cast ${className}`} style={{ ...style, backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100}%` }} />;
}
export function MomentArt({ index, className = '' }: { index: number; className?: string }) {
  return <span aria-hidden="true" className={`sv3-moment-art ${className}`} style={{ backgroundPosition: `${(index % 5) * 25}% ${Math.floor(index / 5) * 100 / 6}%` }} />;
}
const zones = [
  { id: 'plaza', name: 'Площадь', x: 55, y: 72, view: [400, 300, 830, 700], text: 'Сначала здесь только снег. Потом мы вместе поставим и нарядим большую ёлку.' },
  { id: 'data', name: 'Дата-центр', x: 28, y: 46, view: [0, 210, 900, 650], text: 'В настоящем доме серверов постепенно загораются окна, а на фасаде появляются праздничные огни.' },
  { id: 'workshop', name: 'Мастерская', x: 83, y: 55, view: [900, 270, 636, 620], text: 'Здесь кот готовит коробки, украшения и сюрпризы. Каждый подарок в лавке — маленькое продолжение истории.' },
  { id: 'orbit', name: 'Снежный парк', x: 17, y: 80, view: [0, 485, 760, 535], text: 'В парке появятся фотозона, световая арка, ледяные фигурки и гости. А над ним — звёзды и северное сияние.' },
] as const;
// Registered regions of ONE finished illustration; no independent pasted buildings.
const layers = [
  { at:100, box:[24,53,7,26] }, { at:200, box:[3,36,21,16] },
  { at:300, box:[40,91,13,9] }, { at:400, box:[29,43,13,15] },
  { at:500, box:[23,35,7,6] }, { at:600, box:[76,53,11,12] },
  { at:900, box:[1,27,53,9] }, { at:1100, box:[0,34,3,24] },
  { at:1200, box:[56,77,10,9] }, { at:1300, box:[87,52,11,13] },
  { at:1400, box:[38,0,30,13] }, { at:1500, box:[47,84,9,8] },
  { at:1750, box:[0,0,38,6] }, { at:2000, box:[5,66,11,18] },
  { at:2250, box:[16,64,10,18] }, { at:2500, box:[16,77,11,16] },
  { at:2750, box:[81,73,18,20] }, { at:3000, box:[3,81,13,15] },
  { at:3500, box:[82,7,10,7] }, { at:4000, box:[13,7,13,5] },
  { at:4500, box:[38,0,62,9] }, { at:5000, box:[40,13,24,9] },
];
const decorNames: Record<string,string> = { lantern:'Фонарик', bauble:'Игрушка', star:'Звезда', gift:'Подарок', crystal:'Кристалл' };
const decorFrames: Record<string,number> = { lantern:0, bauble:12, star:14, gift:2, crystal:13 };
const spot = (slot:number) => ({ x:30+(slot%16)*3.8, y:88+Math.floor(slot/16)*2 });
type Mode = 'world' | 'history' | 'vote' | 'place';
type View = { x:number; y:number; w:number; h:number };
const whole:View = {x:0,y:0,w:1536,h:1024};
const clampView = (v:View):View => ({...v,x:Math.max(0,Math.min(1536-v.w,v.x)),y:Math.max(0,Math.min(1024-v.h,v.y))});

export default function SnowWorldScene({ state, onSeen, onPlay, busy=false, act }: {
  state:SnowState; onSeen:()=>void; onPlay?:()=>void; busy?:boolean;
  act?:(action:string,body?:Record<string,unknown>)=>Promise<boolean | void>;
}) {
  const id=useId().replace(/:/g,'');
  const [open,setOpen]=useState(false), [mode,setMode]=useState<Mode>('world');
  const [view,setView]=useState<View>(whole);
  const [zone,setZone]=useState('all'), [info,setInfo]=useState<{title:string;text:string}|null>(null);
  const [history,setHistory]=useState<number|null>(null), [playing,setPlaying]=useState(false);
  const [historyTab,setHistoryTab]=useState<'stages'|'moments'>('stages'), [momentDay,setMomentDay]=useState<number|undefined>();
  const [pose,setPose]=useState(3), [slot,setSlot]=useState<number|null>(null);
  const [kind,setKind]=useState('lantern'), [consent,setConsent]=useState(false), [threshold,setThreshold]=useState(100);
  const svg=useRef<SVGSVGElement|null>(null), pointers=useRef(new Map<number,{x:number;y:number}>());
  const drag=useRef<{view:View;x:number;y:number;distance:number;middleX:number;middleY:number}|null>(null);
  const moved=useRef(false), poseTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const initialEvents=useRef(state.world?.new_events.length || 0);
  const stages=state.world?.stages || [], total=state.world?.total || 0;
  const reached=stages.filter(s=>s.threshold<=total).length;
  const visible=mode==='history' && history!==null ? (history===0 ? 0 : stages[history-1]?.threshold || 0) : total;
  const current=stages.filter(s=>s.threshold<=total).slice(-1)[0], next=stages.find(s=>s.threshold>total);
  const moment=mode==='history'&&historyTab==='stages' ? null : momentFor(state,mode==='history'?momentDay:undefined);
  const access=state.phase==='active'&&hasSubscription(state), vote=state.world?.vote;
  const decorations=state.world?.decorations || [], used=decorations.filter(d=>d.own).map(d=>d.threshold);
  const rights=[100,300,500].filter(n=>state.progress.earned>=n&&!used.includes(n));
  const picked=rights.includes(threshold)?threshold:rights[0];
  const lastStage=useRef(current?.id);
  useEffect(()=>{
    if(lastStage.current!==current?.id&&current){setInfo({title:'МЯУ! Ещё одно маленькое чудо',text:current.name});setPose(6);}
    lastStage.current=current?.id;
  },[current]);
  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const interval=setInterval(()=>{setPose(5);poseTimer.current=setTimeout(()=>setPose(3),190);},8500);
    return()=>{clearInterval(interval);if(poseTimer.current)clearTimeout(poseTimer.current);};
  },[]);
  useEffect(()=>{
    if(!playing||mode!=='history')return;
    const timer=setTimeout(()=>{if((history||0)>=reached)setPlaying(false);else setHistory((history||0)+1);},1300);
    return()=>clearTimeout(timer);
  },[playing,history,reached,mode]);
  const enter=(target:Mode)=>{
    pointers.current.clear();drag.current=null;
    setMode(target);setOpen(true);setInfo(null);setPlaying(false);setHistory(null);setMomentDay(undefined);
    if(target==='history'){setHistory(0);setHistoryTab('stages');setView(whole);setZone('all');onSeen();}
    if(target==='place'){setView({x:360,y:555,w:1150,h:460});setZone('all');setSlot(null);}
    if(target==='vote'){setView(whole);setZone('all');}
  };
  const focus=(target:string)=>{
    const item=zones.find(z=>z.id===target);setZone(target);
    setView(item?{x:item.view[0],y:item.view[1],w:item.view[2],h:item.view[3]}:whole);
    if(mode==='vote'&&item)setInfo({title:item.name,text:item.text});
  };
  const reactCat=()=>{
    if(poseTimer.current)clearTimeout(poseTimer.current);setPose(4);
    setInfo({title:'Кот XSG',text:moment?.text || catSays(state)});
    poseTimer.current=setTimeout(()=>setPose(3),1400);
  };
  const coordinates=(event:{clientX:number;clientY:number})=>{
    const node=svg.current, matrix=node?.getScreenCTM();if(!node||!matrix)return null;
    const point=node.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(matrix.inverse());
  };
  const zoom=(factor:number)=>setView(v=>{
    const w=Math.min(1536,Math.max(350,v.w*factor)),h=Math.min(1024,Math.max(300,v.h*factor));
    return clampView({x:v.x+(v.w-w)/2,y:v.y+(v.h-h)/2,w,h});
  });
  const pointerDown=(event:ReactPointerEvent<SVGSVGElement>)=>{
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});moved.current=false;
    if(pointers.current.size>1){for(const pointerId of pointers.current.keys())event.currentTarget.setPointerCapture(pointerId);moved.current=true;}
    const values=[...pointers.current.values()],a=values[0],b=values[1]||a;
    drag.current={view:{...view},x:event.clientX,y:event.clientY,distance:Math.hypot(a.x-b.x,a.y-b.y),middleX:(a.x+b.x)/2,middleY:(a.y+b.y)/2};
  };
  const pointerMove=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(!pointers.current.has(event.pointerId)||!drag.current)return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const start=drag.current, box=event.currentTarget.getBoundingClientRect();
    const values=[...pointers.current.values()];
    if(values.length>1&&start.distance>0){
      moved.current=true;event.currentTarget.setPointerCapture(event.pointerId);const[a,b]=values,ratio=start.distance/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
      const w=Math.min(1536,Math.max(350,start.view.w*ratio)),h=Math.min(1024,Math.max(300,start.view.h*ratio));
      setView(clampView({x:start.view.x+(start.view.w-w)/2-((a.x+b.x)/2-start.middleX)*start.view.w/box.width,y:start.view.y+(start.view.h-h)/2-((a.y+b.y)/2-start.middleY)*start.view.h/box.height,w,h}));
    }else{
      const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>6)moved.current=true;
      if(moved.current){event.currentTarget.setPointerCapture(event.pointerId);setView(clampView({...start.view,x:start.view.x-dx*start.view.w/box.width,y:start.view.y-dy*start.view.h/box.height}));}
    }
  };
  const mapClick=(event:ReactMouseEvent<SVGSVGElement>)=>{
    if(moved.current)return;
    if(mode==='vote'){const point=coordinates(event);if(point){const nearest=zones.filter(z=>z.id!=='workshop').slice().sort((a,b)=>Math.hypot(a.x*15.36-point.x,a.y*10.24-point.y)-Math.hypot(b.x*15.36-point.x,b.y*10.24-point.y))[0];if(nearest)focus(nearest.id);}return;}
    if(mode==='place'){
      const point=coordinates(event);if(!point)return;
      if(point.y<850){setInfo({title:'Твоё место на станции',text:'Украшения стоят вдоль передней дорожки. Коснись свободной точки на снегу.'});return;}
      const free=Array.from({length:64},(_,n)=>n).filter(n=>!decorations.some(d=>d.slot===n));
      free.sort((a,b)=>{const x=spot(a),y=spot(b);return Math.hypot(x.x*15.36-point.x,x.y*10.24-point.y)-Math.hypot(y.x*15.36-point.x,y.y*10.24-point.y);});
      if(free.length)setSlot(free[0]);
    }
  };
  const hit=(title:string,text:string)=>{if(!moved.current&&mode!=='place'&&mode!=='vote')setInfo({title,text});};
  const camera=view;
  const map=(large:boolean)=><div className="sv3-map" style={{aspectRatio:`${camera.w}/${camera.h}`}}>
    <svg ref={large||!open?svg:undefined} viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`} role="group" aria-label="Интерактивная зимняя станция XSG" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={e=>{pointers.current.delete(e.pointerId);drag.current=null;}} onPointerCancel={e=>{pointers.current.delete(e.pointerId);drag.current=null;}} onClick={mapClick}>
      <defs><filter id={`${id}-soft-${large}`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>{layers.map(layer=><mask maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024" key={layer.at} id={`${id}-${large?'large':'small'}-${layer.at}`}><rect fill="white" filter={`url(#${id}-soft-${large})`} x={layer.box[0]*15.36} y={layer.box[1]*10.24} width={layer.box[2]*15.36} height={layer.box[3]*10.24} rx="10" />{layer.at===1100&&<rect fill="white" filter={`url(#${id}-soft-${large})`} x="1075" y="310" width="430" height="185" rx="10" />}</mask>)}</defs>
      <image href="/xsg-snow-assets/station-v3-base.webp" width="1536" height="1024" />
      {zones.filter(item=>mode!=='vote'||item.id!=='workshop').map(item=><g key={item.id} role="button" tabIndex={0} aria-label={`Рассмотреть: ${item.name}`} onClick={event=>{if(moved.current)return;event.stopPropagation();focus(item.id);if(mode!=='vote')hit(item.name,item.text);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus(item.id);if(mode!=='vote')hit(item.name,item.text);}}}><rect x={(item.x-15)*15.36} y={(item.y-10)*10.24} width="450" height="230" rx="30" className={`sv3-zone-hit ${mode==='vote'?'sv3-vote-zone':''}`} /><title>{item.name}</title></g>)}
      {layers.filter(layer=>layer.at<=visible).map(layer=>{
        const stage=stages.find(s=>s.threshold===layer.at);
        return <g key={layer.at} className="sv3-stage-reveal" role="button" tabIndex={0} aria-label={stage?.name||'Украшение станции'} onClick={()=>hit(stage?.name||'Украшение',`Это появилось благодаря ${layer.at.toLocaleString('ru')} общих снежинок. ${state.world?.events.find(e=>e.threshold===layer.at)?.at?`Станция хранит эту дату: ${new Date(state.world.events.find(e=>e.threshold===layer.at)!.at).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})}.`:''}`)} onKeyDown={e=>{if(e.key==='Enter')hit(stage?.name||'Украшение',`Общий этап ${layer.at} снежинок.`);}}><image href="/xsg-snow-assets/station-v3-festival.webp" width="1536" height="1024" pointerEvents="none" mask={`url(#${id}-${large?'large':'small'}-${layer.at})`} /><rect x={layer.box[0]*15.36} y={layer.box[1]*10.24} width={layer.box[2]*15.36} height={layer.box[3]*10.24} fill="transparent"/><title>{stage?.name}</title></g>;
      })}
      {visible>=300&&<g className="sv3-stage-reveal" role="button" tabIndex={0} aria-label="Первая тёплая лавочка" onClick={()=>hit('Первая тёплая лавочка','На 300 общих снежинках у площади появилось место, где можно немного отдохнуть.')} onKeyDown={e=>{if(e.key==='Enter')hit('Первая тёплая лавочка','Маленькая остановка на пути к большому празднику.');}}><foreignObject x="570" y="840" width="116" height="116"><MomentArt index={10}/></foreignObject></g>}
      {(vote?.results||[]).filter(()=>mode!=='history').map((result,i)=>{const winner=zones.find(z=>z.id===result.choice);if(!winner)return null;return <g key={`vote-${result.week}`} className="sv3-stage-reveal" role="button" tabIndex={0} aria-label={`Общее украшение: ${winner.name}, раунд ${result.week+1}`} onClick={()=>hit(`Выбрали вместе · ${winner.name}`,`В голосовании раунда ${result.week+1} победила эта зона. Сюда кот принёс новую гирлянду.`)} onKeyDown={e=>{if(e.key==='Enter')hit(winner.name,`Украшение по результатам раунда ${result.week+1}.`);}}><foreignObject x={winner.x*15.36+i*25-40} y={winner.y*10.24+55} width="85" height="85"><MomentArt index={12}/></foreignObject></g>;})}
      {visible>=5000&&<g className="sv3-finale" aria-hidden="true"><text x="735" y="190">✦</text><text x="850" y="140">✧</text><text x="910" y="205">✦</text></g>}
      {visible>=700&&<g key={`tree-${visible>=1000?2:visible>=800?1:0}`} className="sv3-stage-reveal" role="button" tabIndex={0} aria-label="Большая ёлка — её развитие" onClick={()=>hit('Наша большая ёлка',visible>=1000?'Мы поставили её, нарядили и вместе зажгли огни.':visible>=800?'Первые игрушки уже на ветках. На 1 000 снежинках зажжём огни!':'Ёлка только приехала. На 800 снежинках появятся первые игрушки.')} onKeyDown={e=>{if(e.key==='Enter')hit('Большая ёлка','700 — появилась; 800 — игрушки; 1 000 — огни.');}}><foreignObject x="690" y="375" width="310" height="414"><WinterArt index={visible>=1000?2:visible>=800?1:0}/></foreignObject></g>}
      {moment&&<g role="button" tabIndex={0} aria-label={`Момент дня: ${moment.name}`} onClick={()=>hit(`${moment.day} декабря · ${moment.name}`,moment.text)} onKeyDown={e=>{if(e.key==='Enter')hit(moment.name,moment.text);}}><foreignObject x={moment.x*15.36-53} y={moment.y*10.24-106} width="106" height="106"><MomentArt index={moment.day-1}/></foreignObject><title>{moment.name}</title></g>}
      {decorations.filter(item=>mode!=='history'||historyTab!=='stages'||item.threshold<=visible).map(item=>{const point=spot(item.slot);return <g key={item.id} role="button" tabIndex={0} aria-label={item.own?'Моё украшение':`Украшение${item.name?` · ${item.name}`:''}`} onClick={()=>hit(item.own?'Здесь осталось твоё тепло':item.name||'Чей-то тёплый привет',item.own?'Это украшение здесь благодаря тебе. Спасибо за маленькую частичку нашего праздника.':'Кто-то тоже захотел сделать станцию уютнее.')} onKeyDown={e=>{if(e.key==='Enter')hit('Личное украшение',item.own?'Твой огонёк на общей станции.':item.name||'Тёплый привет от участника.');}}><foreignObject x={point.x*15.36-14} y={point.y*10.24-30} width="28" height="30"><StationSprite index={decorFrames[item.kind]??14}/></foreignObject></g>;})}
      {mode==='place'&&Array.from({length:64},(_,n)=>{const point=spot(n),taken=decorations.some(d=>d.slot===n);return <circle key={n} role={taken?undefined:'button'} tabIndex={taken?-1:0} aria-label={`Место ${n+1}${taken?' занято':''}`} onKeyDown={e=>{if(!taken&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setSlot(n);}}} cx={point.x*15.36} cy={point.y*10.24} r={slot===n?16:6} fill={taken?'#706c7b':slot===n?'#f4db9c':'#dbc6ed'} opacity={taken ? 0.3 : 0.85} />;})}
      <g role="button" tabIndex={0} aria-label="Поговорить с котом XSG" onClick={()=>{if(!moved.current&&mode==='world')reactCat();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reactCat();}}} className="sv3-cat-hit"><foreignObject x="951" y="735" width="99" height="132"><WinterArt index={pose}/></foreignObject><title>Кот XSG</title></g>
    </svg>
    {mode==='history'&&history!==null&&<span className="sv3-history-caption">{history===0?'Так всё начиналось':stages[history-1]?.name}</span>}
  </div>;
  const infoPanel=info&&<div className="sv3-map-info" role="status"><div><strong>{info.title}</strong><p>{info.text}</p></div><button type="button" aria-label="Закрыть историю объекта" onClick={()=>setInfo(null)}>×</button></div>;
  return <section className="sv3-station" aria-label="Наша зимняя станция">
    <div className="sv3-station-heading"><div><span>{reached===0?'Наша история только начинается':`Этап ${reached} из 25`}</span><h2>{current?.name||'Разбудим зимнюю станцию'}</h2></div>{onPlay&&<button type="button" className="sv3-play-short" onClick={onPlay}>{state.phase==='active'?'К сегодняшней игре':'О событии'} <span>↗</span></button>}</div>
    <div className="sv3-zone-nav" aria-label="Зоны станции"><button type="button" aria-pressed={zone==='all'} onClick={()=>focus('all')}>Вся станция</button>{zones.map(item=><button type="button" key={item.id} aria-pressed={zone===item.id} onClick={()=>focus(item.id)}>{item.name}</button>)}<button type="button" className="sv3-expand" onClick={()=>enter('world')} aria-label="Открыть станцию на весь экран">⛶</button></div>
    {map(false)}
    {!open&&infoPanel}
    <div className="sv3-world-progress"><div><strong>{total.toLocaleString('ru')} <span>❄</span></strong><span>{next?`Ещё ${(next.threshold-total).toLocaleString('ru')} до преображения`:'Мы построили настоящее чудо'}</span></div><progress max={5000} value={Math.min(5000,total)} aria-label="Общий прогресс станции"/><p>{next?<><span>Следом:</span> {next.name}</>:'Все 25 этапов открыты. Спасибо каждому 💜'}</p></div>
    <div className="sv3-station-actions"><button type="button" onClick={()=>enter('history')}>История станции <span>↗</span></button><button type="button" onClick={()=>enter('vote')}>{vote?.own?'Мой голос сохранён':'Куда отправим украшения?'} <span>↗</span></button><button type="button" onClick={()=>enter('place')}>{rights.length?`Поставить украшение · ${rights.length}`:used.length?'Мои украшения':'Моё украшение · от 100 ❄'} <span>↗</span></button></div>
    {moment&&<button type="button" className="sv3-moment-note" onClick={()=>{focus(moment.zone);setInfo({title:`${moment.day} декабря · ${moment.name}`,text:moment.text});}}><MomentArt index={moment.day-1}/><span><small>Момент дня · {moment.day} декабря</small><strong>{moment.name}</strong></span><span>↗</span></button>}
    {initialEvents.current>0&&<p className="sv3-return-note">Пока тебя не было, на станции появилось {initialEvents.current} новых изменений. Они ждут в истории.</p>}
    <Dialog.Root open={open} onOpenChange={value=>{setOpen(value);if(!value){setMode('world');setPlaying(false);setHistory(null);setMomentDay(undefined);setInfo(null);pointers.current.clear();drag.current=null;}}}><Dialog.Portal><Dialog.Overlay className="snow-event-overlay"/><Dialog.Content className="sv3-map-dialog">
      <header><div><Dialog.Title>{mode==='history'?'История станции':mode==='place'?'Моё украшение':mode==='vote'?'Выбираем вместе':'Наша зимняя станция'}</Dialog.Title><Dialog.Description>{mode==='place'?'Выбери предмет и место на передней дорожке':mode==='vote'?'Коснись подсвеченной зоны и подтверди голос':'Приближай, перемещай и открывай маленькие истории'}</Dialog.Description></div><Dialog.Close aria-label="Закрыть станцию" className="sv3-close">×</Dialog.Close></header>
      {mode==='history'?<div className="sv3-history-tools"><div className="sv3-segment"><button type="button" aria-pressed={historyTab==='stages'} onClick={()=>{setHistoryTab('stages');setMomentDay(undefined);}}>Как мы всё построили</button><button type="button" aria-pressed={historyTab==='moments'} onClick={()=>{setHistoryTab('moments');setHistory(null);setPlaying(false);setMomentDay(state.today>='2026-12-01'?1:undefined);}}>Моменты декабря</button></div>{historyTab==='stages'?<><label>Достигнутый этап<select value={history??reached} onChange={e=>{setPlaying(false);setHistory(Number(e.target.value));}}><option value={0}>Начало · только снег</option>{stages.map((item,i)=><option key={item.id} value={i+1} disabled={i>=reached}>{item.threshold.toLocaleString('ru')} ❄ · {item.name}</option>)}</select></label><input type="range" min="0" max={reached} value={history??reached} aria-label="Было / Стало" onChange={e=>{setPlaying(false);setHistory(Number(e.target.value));}}/><div className="sv3-inline"><button type="button" disabled={!reached} onClick={()=>{setHistory(0);setPlaying(true);onSeen();}}>▶ Вся история</button><button type="button" onClick={()=>{setPlaying(false);setHistory(0);}}>Было</button><button type="button" onClick={()=>{setPlaying(false);setHistory(reached);}}>Стало</button>{playing&&<button type="button" onClick={()=>setPlaying(false)}>Пропустить</button>}</div></>:<label>Маленькая история<select disabled={state.today<'2026-12-01'} value={momentDay||1} onChange={e=>setMomentDay(Number(e.target.value))}>{momentNames.map(([name],i)=><option key={name} value={i+1} disabled={`2026-12-${String(i+1).padStart(2,'0')}`>state.today}>{i+1} декабря · {name}</option>)}</select></label>}</div>:<div className="sv3-zone-nav"><button type="button" onClick={()=>focus('all')}>Вся станция</button>{zones.filter(item=>mode!=='vote'||item.id!=='workshop').map(item=><button type="button" key={item.id} aria-pressed={zone===item.id} onClick={()=>focus(item.id)}>{item.name}</button>)}</div>}
      <div className="sv3-modal-map">{map(true)}<div className="sv3-zoom"><button type="button" onClick={()=>zoom(.8)} aria-label="Приблизить карту">+</button><button type="button" onClick={()=>zoom(1.25)} aria-label="Отдалить карту">−</button><button type="button" onClick={()=>focus('all')} aria-label="Показать всю станцию">⛶</button></div></div>
      {infoPanel}
      {mode==='history'&&historyTab==='moments'&&moment&&<div className="sv3-moment-description"><strong>{moment.name}</strong><p>{moment.text}</p></div>}
      {mode==='vote'&&<div className="sv3-map-task"><p>{vote?.own?`Ты уже выбрал: ${zones.find(z=>z.id===vote.own)?.name}.`:'Один голос за раунд. Следующая партия огоньков появится в выбранной зоне.'}</p>{zone!=='all'&&zone!=='workshop'&&<p><strong>{zones.find(z=>z.id===zone)?.name}</strong> · {vote?.counts[zone]||0} голосов</p>}<button type="button" className="se-button" disabled={!access||busy||!!vote?.own||zone==='all'||zone==='workshop'} onClick={async()=>{if(await act?.('vote',{choice:zone})){setInfo({title:'Кот запомнил твой выбор',text:'Спасибо! Результат появится после завершения раунда.'});}}}>Голосовать за выбранную зону</button><small>{!access?'Голосование доступно в декабре с активной подпиской.':vote?.tie_rule}</small>{!!vote?.results.length&&<details><summary>Предыдущие результаты</summary>{vote.results.map(result=><p key={result.week}>Раунд {result.week+1}: {zones.find(z=>z.id===result.choice)?.name}</p>)}</details>}</div>}
      {mode==='place'&&<div className="sv3-map-task">{access&&rights.length>0?<><div className="sv3-placement-fields"><label>Украшение<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(decorNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>Заработанное право<select value={picked} onChange={e=>setThreshold(Number(e.target.value))}>{rights.map(n=><option key={n} value={n}>За {n} ❄</option>)}</select></label></div><p>{slot===null?'Коснись свободной точки на передней дорожке.':`Выбрано место ${slot+1} из 64.`}</p><label className="sv3-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Разрешаю показать моё имя у украшения</label><button type="button" className="se-button" disabled={slot===null||busy} onClick={async()=>{if(await act?.('place',{threshold:picked,decoration:kind,slot:String(slot),consent})){setSlot(null);setInfo({title:'Твой огонёк уже на станции',text:'Спасибо за маленькую частичку тепла. Её увидят все участники.'});}}}>Поставить украшение</button></>:<p>{!access?'Размещение доступно в декабре с активной подпиской.':used.length===3?'Все три твоих украшения уже украшают станцию.':`Следующее право — за ${[100,300,500].find(n=>n>state.progress.earned)||500} заработанных снежинок. Покупать подарки для этого не нужно.`}</p>}</div>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
