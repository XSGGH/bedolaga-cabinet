import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import client from '@/api/client';
import { snowApi, snowError, subscriptionLabels, type SubscriptionScenario } from '@/api/snowEvent';
import type { MosaicState } from '@/components/snow-event/SnowMosaics';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';

type Stats = MosaicState & {
  scenarios: Record<string, { date: string; remaining: number; daily: number; on_time: boolean }>;
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
  const [chapter, setChapter] = useState('niveya');
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
  const updateSpec = (key: string, value: unknown) => {
    try {
      setJson(JSON.stringify({ ...JSON.parse(json), [key]: value }, null, 2));
    } catch {
      setError('Исправьте параметры истории.');
    }
  };
  let specFields: Record<string, unknown> = {};
  try {
    specFields = JSON.parse(json);
  } catch {
    /* Advanced editor can temporarily contain incomplete JSON. */
  }
  const data = query.data;
  return (
    <main className="snow-page snow-experience">
      <Link to="/admin">← Административная панель</Link>
      <h1>Семь планет: поиск Уголька</h1>
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
            <div className="sm-forecast">
              {Object.values(data.scenarios || {}).map((s) => (
                <p key={s.daily}>
                  {s.daily} ежедневных участников: {s.date} ·{' '}
                  {s.on_time ? 'успеваем к Новому году' : 'нужна дополнительная активность'}
                </p>
              ))}
            </div>
            <p>
              Уникальных игроков: {data.unique_players} · Сегодня: {data.today_players} · Резерв:{' '}
              {data.reserve}
            </p>
            <p>
              Среднее число вкладов за последние 7 дней мероприятия: {data.average_daily.toFixed(1)}
              . При нулевой активности прогноз отсутствует.
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
            <div className="snow-field">
              {[
                ['id', 'Идентификатор'],
                ['title', 'Название'],
                ['caption', 'Короткая подпись'],
                ['start', 'Дата начала'],
                ['finale', 'Дата раскрытия'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type={key === 'start' || key === 'finale' ? 'date' : 'text'}
                    value={String(specFields[key] || '')}
                    onChange={(e) => updateSpec(key, e.target.value)}
                  />
                </label>
              ))}
              <label>
                Рассказ
                <textarea
                  rows={6}
                  value={String(specFields.story || '')}
                  onChange={(e) => updateSpec('story', e.target.value)}
                />
              </label>
              <label>
                Сетка
                <select
                  value={`${specFields.columns}x${specFields.rows}`}
                  onChange={(e) => {
                    const [columns, rows] = e.target.value.split('x').map(Number);
                    try {
                      setJson(JSON.stringify({ ...JSON.parse(json), columns, rows }, null, 2));
                    } catch {
                      setError('Исправьте параметры.');
                    }
                  }}
                >
                  {[
                    [6, 4],
                    [8, 4],
                    [8, 5],
                  ].map(([x, y]) => (
                    <option key={x * y} value={`${x}x${y}`}>
                      {x * y} частей · {x}×{y}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!specFields.active}
                  onChange={(e) => updateSpec('active', e.target.checked)}
                />
                Опубликовать после подготовки изображения
              </label>
            </div>
            <p>
              Сетка 24, 32 или 40 частей. Сначала сохраните черновик без публикации. После
              подготовки художественных фрагментов включите публикацию. Опубликованные цели
              неизменяемы; начисление ретроактивных подарков отсутствует.
            </p>
            <details>
              <summary>Расширенные параметры истории</summary>
              <label className="snow-field">
                JSON
                <textarea rows={13} value={json} onChange={(e) => setJson(e.target.value)} />
              </label>
            </details>
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
