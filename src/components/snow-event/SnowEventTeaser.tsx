import { Link } from 'react-router';
import { timeUntil } from './useSnowEvent';
import './snow-teaser.css';

type SnowEventTeaserProps = {
  startsAt: string;
  now: number;
};

/**
 * Stable public announcement before the event starts. Intentionally independent
 * of station, games, rewards and admin preview: those features must not leak here.
 */
export default function SnowEventTeaser({ startsAt, now }: SnowEventTeaserProps) {
  const remaining = timeUntil(startsAt, now);
  const units = [
    { label: 'дней', value: remaining.days },
    { label: 'часов', value: remaining.hours },
    { label: 'минут', value: remaining.minutes },
    { label: 'секунд', value: remaining.seconds },
  ];

  return (
    <main className="snow-teaser" aria-labelledby="snow-teaser-title">
      <div className="snow-teaser-navigation">
        <Link to="/" className="snow-teaser-back">← На главную</Link>
        <span>XSG VPN · ЗИМА 2026</span>
      </div>

      <section className="snow-teaser-hero">
        <div className="snow-teaser-sky" aria-hidden="true">
          <span className="snow-teaser-star snow-teaser-star-one">✦</span>
          <span className="snow-teaser-star snow-teaser-star-two">✧</span>
          <span className="snow-teaser-star snow-teaser-star-three">✦</span>
          <span className="snow-teaser-star snow-teaser-star-four">✧</span>
          <span className="snow-teaser-emblem">❄</span>
        </div>

        <div className="snow-teaser-content">
          <span className="snow-teaser-eyebrow"><span aria-hidden="true">✳</span> НОВОГОДНЕЕ СОБЫТИЕ</span>
          <h1 id="snow-teaser-title">Снежный <span>переполох</span></h1>
          <p className="snow-teaser-lead">
            В XSG VPN готовится кое-что особенное. Пока оставим это маленьким зимним секретом.
          </p>

          <div className="snow-teaser-clock" aria-label="Обратный отсчёт до начала события">
            <p>До начала осталось</p>
            <div className="snow-teaser-clock-grid" role="timer" aria-live="off">
              {units.map(({ label, value }) => (
                <div className="snow-teaser-clock-unit" key={label}>
                  <strong>{String(value).padStart(2, '0')}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="snow-teaser-date">
            <span className="snow-teaser-date-dot" aria-hidden="true" />
            Старт 1 декабря в 00:00 по Москве
          </div>
        </div>
        <div className="snow-teaser-drift snow-teaser-drift-back" aria-hidden="true" />
        <div className="snow-teaser-drift snow-teaser-drift-front" aria-hidden="true" />
      </section>
      <p className="snow-teaser-footer">До встречи в первый день зимы <span aria-hidden="true">✦</span></p>
    </main>
  );
}
