import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { snowApi, snowError, subscriptionLabels, type SubscriptionScenario } from '@/api/snowEvent';
import '@/components/snow-event/snow-event.css';
import '@/components/snow-event/snow-experience.css';
import '@/components/snow-event/snow-world.css';

export default function AdminSnowEvent() {
  const query = useQuery({ queryKey: ['admin-snow-event'], queryFn: snowApi.admin });
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionScenario>('active');
  const [date, setDate] = useState('2026-12-15');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [incidentStart, setIncidentStart] = useState('2026-12-01');
  const [incidentEnd, setIncidentEnd] = useState('2026-12-01');
  const [reason, setReason] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [userId, setUserId] = useState('');
  const [restoreDate, setRestoreDate] = useState('2026-12-01');
  const [costGb, setCostGb] = useState('');
  const [costDay, setCostDay] = useState('');
  const [quazarCost, setQuazarCost] = useState('');
  const data = query.data;
  const run = async (work: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await query.refetch();
      setNotice(message);
    } catch (e) {
      setError(snowError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="snow-page snow-experience snow-world-experience sw-admin">
      <Link className="snow-back" to="/admin">
        ← Административная панель
      </Link>
      <header>
        <p className="se-kicker">Настоящая станция и изолированный тестовый мир</p>
        <h1>Снежный переполох</h1>
      </header>
      {error && (
        <p className="se-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="se-notice" role="status">
          {notice}
        </p>
      )}
      <section className="se-panel">
        <h2>👁 Предпросмотр глазами пользователя</h2>
        <p>
          Те же компоненты и серверные правила. Можно пройти все десять игр, проверить 25 этапов,
          подарки, «Орбиту» и путь к Квазару. Никакие тестовые операции не меняют настоящие подписки
          и общий прогресс.
        </p>
        <div className="sw-preview-fields">
          <label>
            Подписка
            <select
              value={subscription}
              onChange={(e) => setSubscription(e.target.value as SubscriptionScenario)}
            >
              {Object.entries(subscriptionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Любая тестовая дата
            <input
              type="date"
              min="2026-11-01"
              max="2027-01-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="se-button"
          disabled={busy || !date}
          onClick={() =>
            void run(async () => {
              const result = await snowApi.create(subscription, date);
              navigate(`/admin/snow-event/preview/${result.id}?settings=1`);
            }, '')
          }
        >
          Открыть предпросмотр
        </button>
        <p className="sw-fine-print">
          Настройки в предпросмотре можно полностью скрыть. Открытие отсюда снова показывает их;
          скрытое состояние запоминается на время браузерной сессии.
        </p>
      </section>
      {data ? (
        <>
          <section className="se-panel">
            <h2>Настоящие результаты мероприятия</h2>
            <div className="sw-admin-stats">
              {[
                ['Участников', data.participants],
                ['Активных сегодня', data.stats?.active_today],
                ['Ещё могут выполнить 26/31', data.stats?.quazar_candidates],
                ['Уже выполнили 26/31', data.stats?.quazar_completed],
                ['Общий прогресс', data.earned],
                ['Потрачено снежинок', data.stats?.spent],
                ['Выдано времени, ч.', data.stats?.hours_granted],
                ['Выдано трафика, ГБ', data.stats?.traffic_granted],
                ['Постоянных прав на Квазар', data.stats?.quazar_accounts],
              ].map(([name, value]) => (
                <div key={String(name)}>
                  <span>{name}</span>
                  <strong>{value ?? '—'}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="se-panel">
            <p className="se-kicker">Обязательная проверка перед оформлением</p>
            <h2>Исходный тариф для Квазара</h2>
            <p>
              Выбери действующий «Гипердрайв». Сервер проверит раздельные лимиты, сохранит
              безлимитные сквады и перенесёт специальные серверы с лимитом 250 ГБ. Внутренние
              названия доступны только здесь.
            </p>
            <label className="sw-field">
              Действующий исходный тариф
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Выбрать тариф</option>
                {data.sources?.map((tariff) => (
                  <option key={tariff.id} value={tariff.id}>
                    {tariff.name} · ID {tariff.id} · {tariff.traffic} ГБ · {tariff.devices} устр.
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || !source}
              onClick={() =>
                void run(
                  () => snowApi.setupQuazar(Number(source)),
                  'Тариф проверен. Квазар доступен только заслужившим его аккаунтам с 31 декабря.',
                )
              }
            >
              Проверить и настроить Квазар
            </button>
            <p className="sw-fine-print">
              При неоднозначных лимитах настройка будет отклонена. До проверки оформление закрыто.
              Никакая действующая подписка при этом не переключается.
            </p>
          </section>
          <section className="se-panel">
            <h2>Опубликованные правила</h2>
            <p>
              Основная цель — 1 500, дополнительные этапы — до 5 000. Экономика: 5 / 15 / 25;
              максимум 720 базовых снежинок и 80 коллективных. Цели и каталог не увеличиваются
              незаметно.
            </p>
            <p>
              1 декабря, 00:00 МСК — автоматический старт. С 1 января только магазин. 8 января —
              завершение.
            </p>
            <div className="sw-admin-catalog">
              {data.config.rewards.map((gift) => (
                <div key={gift.id}>
                  <strong>{gift.cost} ❄</strong>
                  <span>{gift.options?.map((o) => o.name).join(' / ')}</span>
                </div>
              ))}
            </div>
          </section>
          {data.budget && (
            <section className="se-panel">
              <h2>Обязательства по наградам</h2>
              <p>{data.budget.note}</p>
              <div className="sw-preview-fields">
                <label>
                  Себестоимость 1 ГБ, ₽
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={costGb}
                    onChange={(e) => setCostGb(e.target.value)}
                    placeholder="Не задана"
                  />
                </label>
                <label>
                  Себестоимость суток аккаунта, ₽
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={costDay}
                    onChange={(e) => setCostDay(e.target.value)}
                    placeholder="Не задана"
                  />
                </label>
                <label>
                  Обслуживание Квазара / месяц, ₽
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quazarCost}
                    onChange={(e) => setQuazarCost(e.target.value)}
                    placeholder="Не задано"
                  />
                </label>
              </div>
              <div className="sw-budget-table">
                <table>
                  <thead>
                    <tr>
                      <th>Игроков</th>
                      <th>Время, суток ≤</th>
                      <th>Трафик, ГБ ≤</th>
                      <th>Бюджет наград ≤</th>
                      <th>Квазар / месяц</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.budget.scenarios.map((row) => (
                      <tr key={row.participants}>
                        <td>{row.participants}</td>
                        <td>{(row.hours_upper / 24).toLocaleString('ru')}</td>
                        <td>{row.gb_upper}</td>
                        <td>
                          {costGb !== '' && costDay !== ''
                            ? `${(row.gb_upper * Number(costGb) + (row.hours_upper / 24) * Number(costDay)).toLocaleString('ru', { maximumFractionDigits: 2 })} ₽`
                            : 'Нужна себестоимость'}
                        </td>
                        <td>
                          {quazarCost !== ''
                            ? `${(row.quazar_accounts_upper * Number(quazarCost)).toLocaleString('ru')} ₽`
                            : 'Нужна себестоимость'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sw-fine-print">
                ГБ и время — отдельные верхние оценки; суммирование даёт консервативный потолок, а
                не ожидаемый расход. Время оценено в сутках аккаунта с его устройствами. Квазар —
                постоянное право на платный тариф; стоимость обслуживания показана отдельно от цены
                180 ₽.
              </p>
            </section>
          )}
          <details className="se-panel se-details">
            <summary>Подтверждённые сбои и восстановление дней</summary>
            <p>
              Только подтверждённый сервисный инцидент. Дата восстановления должна попадать в его
              период и уже наступить. Дубликат не начислит награду повторно; каждое восстановление
              сохраняется в аудите.
            </p>
            <div className="sw-preview-fields">
              <label>
                Начало инцидента
                <input
                  type="date"
                  value={incidentStart}
                  onChange={(e) => setIncidentStart(e.target.value)}
                />
              </label>
              <label>
                Конец инцидента
                <input
                  type="date"
                  value={incidentEnd}
                  onChange={(e) => setIncidentEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="sw-field">
              Подтверждение и описание сбоя
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={12}
                maxLength={500}
              />
            </label>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || reason.length < 12}
              onClick={() =>
                void run(async () => {
                  const result = await snowApi.incident({
                    start: incidentStart,
                    end: incidentEnd,
                    reason,
                  });
                  setIncidentId(result.data.id);
                }, 'Инцидент зарегистрирован.')
              }
            >
              Зарегистрировать инцидент
            </button>
            <div className="sw-preview-fields">
              <label>
                ID инцидента
                <input value={incidentId} onChange={(e) => setIncidentId(e.target.value)} />
              </label>
              <label>
                ID аккаунта
                <input
                  type="number"
                  min="1"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </label>
              <label>
                Восстановить игровой день
                <input
                  type="date"
                  value={restoreDate}
                  onChange={(e) => setRestoreDate(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="se-secondary"
              disabled={busy || !incidentId || !userId || reason.length < 12}
              onClick={() =>
                void run(
                  () =>
                    snowApi.restoreDay({
                      user_id: Number(userId),
                      day: restoreDate,
                      incident_id: incidentId,
                      reason,
                    }),
                  'День восстановлен. Повторного начисления при дубликате не будет.',
                )
              }
            >
              Восстановить подтверждённый день
            </button>
            <ul className="sw-history">
              {data.audit?.map((entry) => (
                <li key={entry.id}>
                  <strong>
                    Аккаунт {entry.user_id} · {entry.day} · +{entry.credited} ❄
                  </strong>
                  <span>
                    {entry.reason} · {entry.at}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <section className="se-panel">
          <p role="status">
            {query.isError
              ? 'Не удалось загрузить серверную статистику мероприятия.'
              : 'Загружаем статистику…'}
          </p>
        </section>
      )}
    </div>
  );
}
