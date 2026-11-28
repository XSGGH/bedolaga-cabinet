import { useEffect, useRef, useState } from 'react';
import { snowApi, type SnowChapter } from '@/api/snowEvent';

export default function SnowMosaicPicture({
  chapter,
  preview,
}: {
  chapter: SnowChapter;
  preview?: string;
}) {
  const urls = useRef(new Map<number, string>());
  const requests = useRef(new Map<number, AbortController>());
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set());
  const [tiles, setTiles] = useState<ReadonlyMap<number, string>>(new Map());
  const indices = chapter.tiles.join(',');

  useEffect(
    () => () => {
      for (const request of requests.current.values()) request.abort();
      requests.current.clear();
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      urls.current.clear();
    },
    [],
  );

  useEffect(() => {
    const opened = new Set(indices ? indices.split(',').map(Number) : []);
    let removed = false;
    for (const [index, request] of requests.current) {
      if (!opened.has(index)) {
        request.abort();
        requests.current.delete(index);
      }
    }
    for (const [index, url] of urls.current) {
      if (!opened.has(index)) {
        URL.revokeObjectURL(url);
        urls.current.delete(index);
        removed = true;
      }
    }
    if (removed) setTiles(new Map(urls.current));
    for (const index of opened) {
      if (requests.current.size >= 4) break;
      if (tiles.has(index) || requests.current.has(index) || failed.has(index)) continue;
      const request = new AbortController();
      requests.current.set(index, request);
      void snowApi.tile(chapter.id, index, request.signal, preview).then(
        (blob) => {
          if (request.signal.aborted) return;
          requests.current.delete(index);
          urls.current.set(index, URL.createObjectURL(blob));
          setTiles(new Map(urls.current));
        },
        () => {
          if (request.signal.aborted) return;
          requests.current.delete(index);
          setFailed((previous) => new Set(previous).add(index));
        },
      );
    }
  }, [indices, chapter.id, preview, tiles, failed]);

  const missing = chapter.tiles.filter((index) => failed.has(index)).length;
  const loading = chapter.tiles.some((index) => !tiles.has(index) && !failed.has(index));
  return (
    <div className="sm-art">
      <div
        className={chapter.count ? 'sm-picture' : 'sm-picture sm-picture-empty'}
        role={chapter.count ? 'img' : undefined}
        aria-label={
          chapter.count
            ? `Иллюстрация главы «${chapter.title}», открыто ${chapter.count} из ${chapter.total}`
            : undefined
        }
        style={{
          aspectRatio: `${chapter.image_width}/${chapter.image_height}`,
          gridTemplateColumns: chapter.count
            ? `repeat(${chapter.columns}, minmax(0, 1fr))`
            : undefined,
          gridTemplateRows: chapter.count ? `repeat(${chapter.rows}, minmax(0, 1fr))` : undefined,
        }}
      >
        {chapter.count === 0 ? (
          <p>Первый фрагмент появится после игры</p>
        ) : (
          Array.from({ length: chapter.total }, (_, index) => {
            const revealed = chapter.tiles.includes(index);
            const url = revealed ? tiles.get(index) : undefined;
            return (
              <div
                key={index}
                className={url ? 'sm-piece sm-revealed' : 'sm-piece'}
                data-missing={revealed && failed.has(index)}
              >
                {url && <img src={url} alt="" draggable={false} />}
              </div>
            );
          })
        )}
      </div>
      {missing > 0 ? (
        <div className="sm-art-status" role="status">
          <span>Часть иллюстрации не загрузилась</span>
          <button type="button" className="se-secondary" onClick={() => setFailed(new Set())}>
            Повторить
          </button>
        </div>
      ) : (
        loading && (
          <p className="sm-art-status" role="status">
            Загружаем фрагменты…
          </p>
        )
      )}
    </div>
  );
}
