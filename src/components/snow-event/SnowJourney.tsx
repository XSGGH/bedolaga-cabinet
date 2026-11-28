import { MomentArt, WinterArt } from './SnowWorldScene';

const milestones = [
  { day: 5, name: 'Первые следы', story: 'Кот нашёл тропинку сквозь снег.', art: 2 },
  { day: 10, name: 'Тёплый привал', story: 'Вдали загорелись первые окна.', art: 10 },
  { day: 15, name: 'Северные огни', story: 'Небо озарилось фиолетовым сиянием.', art: 16 },
  { day: 20, name: 'Звёздный мост', story: 'До обсерватории осталось совсем немного.', art: 25 },
  { day: 26, name: 'Квазар!', story: 'Обсерватория открыла тебе двери.', art: 23 },
] as const;

// A completed server game day is one step. The route has no claim or payment action.
export default function SnowJourney({ count }: { count:number }) {
  const done=Math.min(26,Math.max(0,count));
  const next = milestones.find(milestone=>milestone.day>done);
  const last = milestones.filter(milestone=>milestone.day<=done).slice(-1)[0];
  const points=Array.from({length:26},(_,i)=>{
    const row=Math.floor(i/7),column=i%7;
    return {x:40+(row%2?6-column:column)*45,y:235-row*57};
  });
  const cat=points[Math.max(0,done-1)];
  return <div className="sv3-journey-route" aria-label={`Путь к обсерватории: ${done} из 26 шагов пройдено`}>
    <svg viewBox="0 0 350 290" aria-hidden="true">
      <defs><linearGradient id="sv3-path-snow" x2="0" y2="1"><stop stopColor="#dad7e5"/><stop offset="1" stopColor="#8f8caa"/></linearGradient></defs>
      <path className="sv3-route-track" d="M40 235 H290 Q332 235 310 206 Q310 178 290 178 H60 Q15 178 40 149 Q40 121 60 121 H290 Q332 121 310 92 Q310 64 290 64 H130"/>
      {points.map((point,i)=><g key={i} className={i<done?'sv3-step-done':'sv3-step-next'}><circle cx={point.x} cy={point.y} r="13"/><text x={point.x} y={point.y+4} textAnchor="middle">{i<done?'✓':i+1}</text></g>)}
      <foreignObject x="24" y="0" width="102" height="110"><MomentArt index={23}/></foreignObject>
      <foreignObject x={cat.x-18} y={cat.y-55} width="36" height="48"><WinterArt index={done===26?6:4}/></foreignObject>
    </svg><span className="sv3-route-destination">XSG Квазар · обсерватория</span>
    <div className="sv3-journey-story">
      <WinterArt index={done >= 26 ? 6 : 4}/>
      <div>
        <span>{done >= 26 ? 'Путешествие завершено' : `Приключение ${done} из 26`}</span>
        <strong>{done >= 26 ? 'Добро пожаловать в Квазар!' : last ? last.name : 'Наше путешествие начинается'}</strong>
        <p>{done >= 26 ? 'Кот дождался тебя у обсерватории. Право на эксклюзивный тариф теперь твоё навсегда.' : last?.story || 'Кот только собирается в путь. Впереди столько всего интересного!'}</p>
        {next&&<small>Следом — {next.name.toLowerCase()}. Ещё {next.day - done} игровых дней.</small>}
      </div>
    </div>
    <div className="sv3-journey-milestones" aria-label="Главные рубежи путешествия">
      {milestones.map(milestone=><div key={milestone.day} className={`sv3-journey-milestone ${done >= milestone.day ? 'is-done' : next?.day === milestone.day ? 'is-next' : ''}`}>
        <MomentArt index={milestone.art}/>
        <div><strong>{milestone.name}</strong><span>{milestone.day} игр {done >= milestone.day ? '· ✓' : ''}</span></div>
      </div>)}
    </div>
  </div>;
}
