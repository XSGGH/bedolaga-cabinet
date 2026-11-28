import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import client from '@/api/client';
import { snowApi, snowError, subscriptionLabels, type SubscriptionScenario } from '@/api/snowEvent';
import type { MosaicState } from '@/components/snow-event/SnowMosaics';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';

type Stats = MosaicState & {
  average_daily: number;
  forecast: Record<string, string | null>;
  daily: Record<string, number>;
  audit: Record<string, unknown>[];
};
export default function AdminSnowEvent() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['admin-mosaics'],
    queryFn: async () => (await client.get<Stats>('/cabinet/admin/snow-event/mosaics')).data,
  });
  const [subscription, setSubscription] = useState<SubscriptionScenario>('active');
  const [date, setDate] = useState('2026-12-15');
  const [reason, setReason] = useState('');
  const [chapter, setChapter] = useState('meeting');
  const [delta, setDelta] = useState(1);
  const [json, setJson] = useState(
    JSON.stringify(
      {
        id: 'first-snow',
        title: 'Первый снег',
        caption: 'Первый снег вдвоём',
        story: 'Зимняя история Снежка и Уголька.',
        image: 'first-snow',
        columns: 6,
        rows: 4,
        start: '2026-12-11',
        finale: '2026-12-11',
        kind: 'bonus',
        active: false,
        order: 10,
      },
      null,
      2,
    ),
  );
  const [art, setArt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await query.refetch();
      setNotice('Сохранено.');
    } catch (e) {
      setError(snowError(e));
    } finally {
      setBusy(false);
    }
  };
  const action = (action: string, extra: Record<string, unknown> = {}) =>
    run(() => client.post('/cabinet/admin/snow-event/mosaics', { action, reason, ...extra }));
  const data = query.data;
  return (
    <main className="snow-page snow-experience">
      <Link to="/admin">← Административная панель</Link>
      <h1>Три маленькие истории</h1>
      {error && (
        <p role="alert" className="se-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="se-panel">
        <h2>Предпросмотр глазами пользователя</h2>
        <p>
          Настоящие пользовательские компоненты, виртуальная дата и изолированные начисления.
          Реальные подписки и балансы сохраняются.
        </p>
        <label className="snow-field">
          Подписка
          <select
            value={subscription}
            onChange={(e) => setSubscription(e.target.value as SubscriptionScenario)}
          >
            {Object.entries(subscriptionLabels).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="snow-field">
          Тестовая дата
          <input
            type="date"
            value={date}
            min="2026-11-01"
            max="2027-01-31"
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="se-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await snowApi.create(subscription, date);
              navigate(`/admin/snow-event/preview/${r.id}?settings=1`);
            })
          }
        >
          Открыть предпросмотр
        </button>
      </section>
      {data ? (
        <>
          <section className="se-panel">
            <h2>Общие результаты</h2>
            <p>
              Уникальных игроков: {data.unique_players} · Сегодня: {data.today_players} · Резерв:{' '}
              {data.reserve}
            </p>
            <p>
              Среднее число вкладов за активный день: {data.average_daily.toFixed(1)}. При нулевой
              активности прогноз отсутствует.
            </p>
            {data.chapters.map((c) => (
              <p key={c.id}>
                <strong>{c.title}</strong> — {c.count}/{c.total}.{' '}
                {data.average_daily > 0
                  ? `Прогноз: ${data.forecast[c.id] || 'нет данных'}.`
                  : 'Пока недостаточно данных для прогноза.'}
              </p>
            ))}
            <details>
              <summary>Вклады по дням</summary>
              {Object.entries(data.daily).map(([day, count]) => (
                <p key={day}>
                  {day}: {count}
                </p>
              ))}
            </details>
          </section>
          <section className="se-panel">
            <h2>Корректировка с аудитом</h2>
            <p>
              Это отдельная административная корректировка, она не создаёт вымышленных игроков или
              личных наград.
            </p>
            <label className="snow-field">
              Причина
              <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} />
            </label>
            <label className="snow-field">
              Мозаика
              <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
                {data.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="snow-field">
              Изменение числа фрагментов
              <input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || reason.trim().length < 5}
              onClick={() => void action('correct', { mosaic_id: chapter, delta })}
            >
              Применить корректировку
            </button>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || reason.trim().length < 5}
              onClick={() => void action('reserve')}
            >
              Направить резерв в доступные бонусные мозаики
            </button>
          </section>
          <section className="se-panel">
            <h2>Дополнительная история</h2>
            <p>
              Сетка 24, 32 или 40 частей. Сначала сохраните черновик с active:false. После
              подготовки художественных фрагментов можно включить active:true. Опубликованные цели
              неизменяемы; начисление ретроактивных подарков отсутствует.
            </p>
            <label className="snow-field">
              Параметры истории
              <textarea rows={13} value={json} onChange={(e) => setJson(e.target.value)} />
            </label>
            <label className="snow-field">
              Художественный исходник для черновика
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setArt(e.target.files?.[0] || null)}
              />
            </label>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || !art || reason.trim().length < 5}
              onClick={() =>
                void run(async () => {
                  const spec = JSON.parse(json);
                  await client.put(
                    `/cabinet/admin/snow-event/mosaics/art/${encodeURIComponent(spec.id)}`,
                    art,
                    {
                      params: { columns: spec.columns, rows: spec.rows, reason },
                      headers: { 'Content-Type': art?.type || 'application/octet-stream' },
                    },
                  );
                })
              }
            >
              Подготовить фрагменты из изображения
            </button>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void run(async () => {
                  await client.post('/cabinet/admin/snow-event/mosaics', {
                    action: 'bonus',
                    reason,
                    spec: JSON.parse(json),
                  });
                })
              }
            >
              Сохранить историю
            </button>
          </section>
          <section className="se-panel">
            <h2>Журнал операций</h2>
            {data.audit
              .slice()
              .reverse()
              .map((entry, i) => (
                <pre
                  key={i}
                  style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}
                >
                  {JSON.stringify(entry, null, 2)}
                </pre>
              ))}
          </section>
        </>
      ) : (
        <p role="status">
          {query.isError ? 'Не удалось загрузить API мозаик.' : 'Загружаем результаты…'}
        </p>
      )}
    </main>
  );
}
