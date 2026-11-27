import { Link } from 'react-router';
import { useSnowEvent, useServerNow, timeUntil } from './useSnowEvent';
import './snow-event.css';

export default function SnowEventBanner() {
  const query = useSnowEvent();
  const now = useServerNow(query.data?.server_now, query.dataUpdatedAt);
  if (!query.data || query.data.phase === 'finished') return null;
  const state = query.data;
  const timer = timeUntil(state.starts_at, now);
  return (
    <Link to="/snow-event" className="snow-banner">
      <img src="/xsg-snow-assets/winter-hero.webp" alt="" width="96" height="80" />
      <span>
        <strong>Снежный переполох</strong>
        <small>
          {state.phase === 'upcoming'
            ? `Зимнее приключение начинается 1 декабря · ${timer.days} д. ${timer.hours} ч.`
            : state.phase === 'shop_only'
              ? 'Успейте обменять снежинки до 8 января'
              : `Ваши снежинки: ${state.progress.balance} · Подарки ждут`}
        </small>
      </span>
      <span aria-hidden="true" className="snow-banner-arrow">
        ↗
      </span>
    </Link>
  );
}
