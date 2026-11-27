import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  snowApi,
  snowDates,
  snowError,
  subscriptionLabels,
  type SubscriptionScenario,
} from '@/api/snowEvent';
import '@/components/snow-event/snow-event.css';

export default function AdminSnowEvent() {
  const query = useQuery({ queryKey: ['admin-snow-event'], queryFn: snowApi.admin });
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionScenario>('active');
  const [date, setDate] = useState('2026-12-15');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState<number | undefined>();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const data = query.data;
  return (
    <div className="snow-page snow-admin">
      <Link to="/admin" className="snow-back">
        ← Административная панель
      </Link>
      <div>
        <p className="snow-eyebrow">УПРАВЛЕНИЕ СОБЫТИЕМ</p>
        <h1>Снежный переполох</h1>
      </div>
      {error && (
        <p role="alert" className="snow-error">
          {error}
        </p>
      )}
      <section className="snow-card">
        <p className="snow-eyebrow">ИЗОЛИРОВАННАЯ ТЕСТОВАЯ СЕССИЯ</p>
        <h2>👁️ Предпросмотр глазами пользователя</h2>
        <p className="snow-muted">
          Тот же интерфейс и серверные ограничения, что у участников. Подписка, дата, снежинки и
          выдача наград — тестовые. Реальные данные не меняются.
        </p>
        <div className="snow-admin-scenarios">
          <label className="snow-field">
            Состояние подписки
            <select
              value={subscription}
              onChange={(e) => setSubscription(e.target.value as SubscriptionScenario)}
            >
              {Object.entries(subscriptionLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="snow-field">
            Тестовая дата
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {snowDates.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="snow-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const result = await snowApi.create(subscription, date);
              navigate(`/admin/snow-event/preview/${result.id}`);
            } catch (e) {
              setError(snowError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Открываем…' : 'Открыть предпросмотр'}
        </button>
      </section>
      {data ? (
        <>
          <section className="snow-stats">
            <div>
              <small>Участников</small>
              <strong>{data.participants}</strong>
            </div>
            <div>
              <small>Настоящих снежинок</small>
              <strong>{data.earned}</strong>
            </div>
            <div>
              <small>Общая цель</small>
              <strong>{data.config.goal}</strong>
            </div>
          </section>
          <section className="snow-card">
            <h2>Настройки запуска</h2>
            <p className="snow-muted">
              1 декабря 2026, 00:00 МСК — старт. 1 января — только магазин. 8 января — завершение.
              Этапы переключаются по серверному времени автоматически.
            </p>
            <label className="snow-field">
              Общая цель, снежинок
              <input
                type="number"
                min="1"
                max="100000000"
                disabled={data.locked || busy}
                value={goal ?? data.config.goal}
                onChange={(e) => setGoal(Number(e.target.value))}
              />
            </label>
            <div className="snow-admin-prices">
              {data.config.rewards.map((reward) => (
                <label className="snow-field" key={reward.id}>
                  {reward.name}
                  <input
                    type="number"
                    min="1"
                    max="545"
                    disabled={data.locked || busy}
                    value={prices[reward.id] ?? reward.cost}
                    onChange={(e) => setPrices({ ...prices, [reward.id]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <p className="snow-muted">
              {data.locked
                ? 'Событие началось: общая цель и цены зафиксированы.'
                : 'Проверьте цель до 1 декабря. После старта цель и цены фиксируются для всех участников.'}
            </p>
            <button
              type="button"
              className="snow-button snow-secondary"
              disabled={data.locked || busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await snowApi.config(
                    goal ?? data.config.goal,
                    Object.fromEntries(
                      data.config.rewards.map((r) => [r.id, prices[r.id] ?? r.cost]),
                    ),
                  );
                  await query.refetch();
                } catch (e) {
                  setError(snowError(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Сохранить настройки
            </button>
          </section>
        </>
      ) : (
        <p role="status">
          {query.isError
            ? 'Не удалось загрузить настройки. Проверьте доступ к API события.'
            : 'Загружаем настройки…'}
        </p>
      )}
    </div>
  );
}
