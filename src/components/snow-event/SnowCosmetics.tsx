import { useSnowEvent } from './useSnowEvent';
import './snow-event.css';

export default function SnowCosmetics() {
  const { data } = useSnowEvent();
  const cosmetics = data?.progress.cosmetics || [];
  if (!cosmetics.length) return null;
  return (
    <section
      className={`snow-profile-award ${cosmetics.includes('decoration') ? 'snow-profile-orbit' : ''}`}
      aria-label="Награды зимнего события"
    >
      <span aria-hidden="true">✦</span>
      <div>
        <strong>{cosmetics.includes('badge') ? 'Снежный первопроходец' : 'Зимняя орбита'}</strong>
        <small>Снежный переполох · зима 2026 / 27</small>
      </div>
    </section>
  );
}
