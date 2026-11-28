import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { useSnowEvent, useServerNow } from '@/components/snow-event/useSnowEvent';
import { nextBoundary } from '@/components/snow-event/snowPresentation';
import SnowEventTeaser from '@/components/snow-event/SnowEventTeaser';
import SnowMosaics from '@/components/snow-event/SnowMosaics';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';
import '@/components/snow-event/snow-gifts.css';

export default function SnowEvent() {
  const { previewId } = useParams();
  const query = useSnowEvent(previewId);
  const state = query.data;
  const now = useServerNow(state?.server_now, query.dataUpdatedAt);
  const fetched = useRef('');
  const boundary = state ? nextBoundary(state) : undefined;
  useEffect(() => {
    if (!previewId && boundary && now >= Date.parse(boundary) && fetched.current !== boundary) {
      fetched.current = boundary;
      void query.refetch();
    }
  }, [previewId, boundary, now, query.refetch]);
  if (!state)
    return (
      <section className="snow-page">
        <h1>Снежный переполох</h1>
        <p role="status">
          {query.isError ? 'Не удалось загрузить истории.' : 'Приближаемся к зимней истории…'}
        </p>
        <button type="button" onClick={() => void query.refetch()}>
          Обновить
        </button>
      </section>
    );
  if (state.phase === 'upcoming' && !previewId)
    return <SnowEventTeaser startsAt={state.starts_at} now={now} />;
  return (
    <SnowMosaics
      key={`${previewId}/${state.today}/${state.subscription}`}
      state={state}
      preview={previewId}
      refresh={() => void query.refetch()}
    />
  );
}
