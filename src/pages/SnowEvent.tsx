import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSnowEvent, useServerNow } from '@/components/snow-event/useSnowEvent';
import { nextBoundary } from '@/components/snow-event/snowPresentation';
import SnowEventTeaser from '@/components/snow-event/SnowEventTeaser';
import SnowMosaics from '@/components/snow-event/SnowMosaics';
import { useAuthStore } from '@/store/auth';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';
import '@/components/snow-event/snow-gifts.css';
import '@/components/snow-event/snow-mosaics.css';

export default function SnowEvent() {
  const { previewId } = useParams();
  const [previewOpen, setPreviewOpen] = useState(false);
  const userId = useAuthStore((auth) => auth.user?.id);
  const query = useSnowEvent(previewId);
  const refetch = query.refetch;
  const refresh = useCallback(async () => {
    const result = await refetch();
    return result.isError ? undefined : result.data;
  }, [refetch]);
  const state = query.data;
  const now = useServerNow(state?.server_now, query.dataUpdatedAt);
  const fetched = useRef('');
  const boundary = state ? nextBoundary(state) : undefined;
  useEffect(() => {
    if (!previewId && boundary && now >= Date.parse(boundary) && fetched.current !== boundary) {
      fetched.current = boundary;
      void refresh().then((next) => {
        if (!next) fetched.current = '';
      });
    }
  }, [previewId, boundary, now, refresh]);
  if (!state)
    return (
      <section className="snow-page">
        <h1>Снежный переполох</h1>
        <p role="status">
          {query.isError ? 'Не удалось загрузить событие.' : 'Загружаем событие…'}
        </p>
        {query.isError && (
          <button type="button" className="se-secondary" onClick={() => void refresh()}>
            Повторить
          </button>
        )}
      </section>
    );
  if (state.phase === 'upcoming' && !previewId)
    return <SnowEventTeaser startsAt={state.starts_at} now={now} />;
  if (!state.mosaics?.session_version)
    return (
      <section className="snow-page">
        <h1>Снежный переполох</h1>
        <p role="status">Событие временно недоступно.</p>
        <button type="button" className="se-secondary" onClick={() => void refresh()}>
          Повторить
        </button>
      </section>
    );
  return (
    <SnowMosaics
      key={`${userId}/${previewId}/${state.preview_revision}/${state.today}/${state.subscription}`}
      state={{ ...state, mosaics: state.mosaics }}
      preview={previewId}
      refresh={refresh}
      stale={query.isRefetchError}
      previewOpen={previewOpen}
      setPreviewOpen={setPreviewOpen}
    />
  );
}
