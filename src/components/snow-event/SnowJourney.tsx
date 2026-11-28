import { LuCheck, LuFlag, LuHouse, LuMoonStar, LuSparkles, LuStar } from 'react-icons/lu';
import { gameDays } from './snowGrammar';

const milestones = [
  { day: 5, name: 'Первые следы', story: 'Кот нашёл тропинку сквозь снег.', Icon: LuFlag },
  { day: 10, name: 'Тёплый привал', story: 'Вдали загорелись первые окна.', Icon: LuHouse },
  { day: 15, name: 'Северные огни', story: 'Небо озарилось фиолетовым сиянием.', Icon: LuMoonStar },
  { day: 20, name: 'Звёздный мост', story: 'До обсерватории осталось совсем немного.', Icon: LuStar },
  { day: 26, name: 'Квазар!', story: 'Обсерватория открыла тебе двери.', Icon: LuSparkles },
] as const;

// One completed game day is one step. Milestones are readable rather than
// squeezed into a cropped horizontal sprite sheet or a grid of 26 tiny circles.
export default function SnowJourney({ count }: { count: number }) {
  const completed = Math.min(26, Math.max(0, count));
  const next = milestones.find(item => item.day > completed);
  return <div className="sv4-journey" aria-label={`Путь к Квазару: ${completed} из 26 приключений пройдено`}>
    <div className="sv4-journey-current">
      <LuSparkles aria-hidden="true" />
      <div><strong>{completed === 26 ? 'Ты добрался до Квазара!' : `Пройдено ${completed} из 26 приключений`}</strong>
        <p>{next ? `До этапа «${next.name}» ещё ${gameDays(next.day - completed)}.` : 'Все важные рубежи позади. Поздравляем!'}</p></div>
    </div>
    <ol className="sv4-journey-steps">
      {milestones.map(item => {
        const done = completed >= item.day;
        const active = next?.day === item.day;
        return <li key={item.day} className={done ? 'is-done' : active ? 'is-current' : ''}>
          <span className="sv4-journey-icon">{done ? <LuCheck aria-hidden="true" /> : <item.Icon aria-hidden="true" />}</span>
          <div><small>{gameDays(item.day)} {done ? '· открыто' : active ? '· следующий рубеж' : ''}</small><strong>{item.name}</strong><p>{item.story}</p></div>
        </li>;
      })}
    </ol>
  </div>;
}
