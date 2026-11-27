import { useId } from 'react';
import { Link } from 'react-router';
import type { SnowReward, SnowState } from '@/api/snowEvent';
import { timeUntil } from './useSnowEvent';
import {
  DAILY_GAME,
  DAILY_VISIT,
  WEEKLY_BONUS,
  hasSubscription,
  number,
  rewardStatus,
  weekProgress,
} from './snowPresentation';
import SnowRewardArt from './SnowRewardArt';

export function SnowHero({ state, now }: { state: SnowState; now: number }) {
  const upcoming = state.phase === 'upcoming';
  const count = timeUntil(state.starts_at, now);
  return (
    <section className={`se-hero ${upcoming ? 'se-hero-announcement' : 'se-hero-compact'}`}>
      <div className="se-hero-art">
        <img
          src="/xsg-snow-assets/winter-hero.webp"
          width="1536"
          height="1024"
          fetchPriority="high"
          alt="Белый кот XSG в фиолетовом космическом шлеме у заснеженной серверной с ёлкой и подарками"
        />
      </div>
      <div className="se-hero-copy">
        <p className="se-kicker">❄ Зимнее событие XSG VPN</p>
        <h1>
          <span>Снежный</span>
          <span>переполох</span>
        </h1>
        {upcoming ? (
          <>
            <p>
              Кот XSG уже готовит праздник! С 1 декабря заходи каждый день, собирай снежинки и
              обменивай их на подарки 💜
            </p>
            <div
              className="se-countdown"
              role="timer"
              aria-label={`До старта: ${count.days} дн., ${count.hours} ч., ${count.minutes} мин., ${count.seconds} сек.`}
            >
              {[
                [count.days, 'дней'],
                [count.hours, 'часов'],
                [count.minutes, 'минут'],
                [count.seconds, 'секунд'],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{String(value).padStart(2, '0')}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="se-start-date">1 декабря · 00:00 МСК</p>
          </>
        ) : (
          <p>
            {state.phase === 'active'
              ? 'Каждый день — маленькое зимнее приключение.'
              : state.phase === 'shop_only'
                ? 'Игры завершены. Забери подарки до 8 января, 00:00 МСК.'
                : 'Спасибо за эту зиму. Праздник закончился, подарки остались 💜'}
          </p>
        )}
      </div>
    </section>
  );
}

export function SnowSubscription({ state }: { state: SnowState }) {
  const active = hasSubscription(state);
  return (
    <section
      className={`se-subscription ${active ? '' : 'se-subscription-needed'}`}
      aria-label="Участие по подписке"
    >
      <span className="se-subscription-icon" aria-hidden="true">
        {active ? '💜' : '❄'}
      </span>
      <div>
        <h2>
          {active
            ? 'Ты готов к приключению!'
            : state.subscription === 'expired'
              ? 'Продолжим после продления?'
              : 'Присоединяйся к зимнему приключению'}
        </h2>
        <p>
          {active
            ? 'С 1 декабря сможешь собирать снежинки и получать подарки.'
            : state.subscription === 'expired'
              ? 'Все снежинки, подарки и календарь сохранены. Продли подписку — и снова в игру.'
              : 'Для участия понадобится активная подписка XSG VPN. А пока можно присмотреть подарки и узнать правила.'}
        </p>
        {!active && (
          <Link className="se-button" to="/subscription">
            {state.subscription === 'expired' ? 'Продлить подписку' : 'Выбрать подписку'}
          </Link>
        )}
      </div>
    </section>
  );
}

export function SnowDailyActivity({
  state,
  busy,
  onAction,
}: {
  state: SnowState;
  busy: boolean;
  onAction: (action: string) => void;
}) {
  const today = state.progress.days[state.today] || {};
  if (!hasSubscription(state)) return <SnowSubscription state={state} />;
  return (
    <section
      className={`se-panel se-daily ${today.game ? 'se-daily-done' : ''}`}
      aria-labelledby="se-daily-title"
    >
      <div className="se-section-heading">
        <p className="se-kicker">
          Задание дня ·{' '}
          {new Intl.DateTimeFormat('ru', {
            day: 'numeric',
            month: 'long',
            timeZone: 'Europe/Moscow',
          }).format(new Date(state.server_now))}
        </p>
        <span className="se-pill">+{DAILY_GAME} ❄</span>
      </div>
      <h2 id="se-daily-title">
        {today.game ? 'Кот доволен. Ты — молодец!' : 'Поймай снежинки для кота'}
      </h2>
      <p>
        {today.game
          ? state.today === '2026-12-31'
            ? 'Последнее задание выполнено! Пора выбрать подарки.'
            : 'Задание выполнено, снежинки уже в копилке. До завтра 💜'
          : 'Собери 7 снежинок за 20 секунд. Не получится с первого раза — попробуешь ещё.'}
      </p>
      {!today.game ? (
        <button
          type="button"
          className="se-button"
          disabled={busy}
          onClick={() => onAction('start')}
        >
          {busy ? 'Готовим игру…' : 'Играть · +10 снежинок'}
        </button>
      ) : (
        <div className="se-completed" role="status">
          <img
            className="se-happy-cat"
            src="/xsg-snow-assets/winter-hero.webp"
            alt="Кот XSG радуется твоим успехам"
            width="48"
            height="48"
          />
          <span aria-hidden="true">❄</span> Задание выполнено · +{DAILY_GAME} снежинок
        </div>
      )}
      <div className="se-checkin">
        <div>
          <strong>Маленький подарок за визит</strong>
          <span>
            {today.checkin
              ? 'Сегодня уже забрали. До встречи завтра!'
              : `Ещё ${DAILY_VISIT} снежинок просто за то, что заглянул.`}
          </span>
        </div>
        {today.checkin ? (
          <span className="se-success">✓ Получено</span>
        ) : (
          <button
            type="button"
            className="se-secondary"
            disabled={busy}
            onClick={() => onAction('checkin')}
          >
            Забрать {DAILY_VISIT} ❄
          </button>
        )}
      </div>
    </section>
  );
}

export function SnowWallet({ state }: { state: SnowState }) {
  const today = state.progress.days[state.today] || {};
  const daily = (today.checkin ? DAILY_VISIT : 0) + (today.game ? DAILY_GAME : 0);
  return (
    <section className="se-wallet" aria-label="Мои снежинки">
      <div>
        <span>Мои снежинки</span>
        <strong>
          {number(state.progress.balance)} <span aria-hidden="true">❄</span>
        </strong>
        <p>
          {state.phase === 'finished' ? 'Обмен завершён 8 января' : 'Можно обменять на подарки'}
        </p>
      </div>
      <div>
        {state.phase === 'active' ? (
          <>
            <span>Сегодня собрано</span>
            <strong>
              {daily}
              <small> / {DAILY_VISIT + DAILY_GAME}</small>
            </strong>
            <p>За визит и игру · бонус недели отдельно</p>
          </>
        ) : (
          <>
            <span>Собрано за событие</span>
            <strong>
              {number(state.progress.earned)} <small>❄</small>
            </strong>
            <p>Твой вклад в общий праздник</p>
          </>
        )}
      </div>
    </section>
  );
}

export function SnowCalendar({ state }: { state: SnowState }) {
  const week = weekProgress(state);
  const games = Object.values(state.progress.days).filter((day) => day.game).length;
  return (
    <section className="se-panel se-calendar" aria-labelledby="se-calendar-title">
      <div className="se-section-heading">
        <div>
          <p className="se-kicker">Декабрь · 2026</p>
          <h2 id="se-calendar-title">Календарь приключений</h2>
        </div>
        <span className="se-pill">{games} / 31</span>
      </div>
      <p>Снежинка отмечает выполненную игру.</p>
      <div className="se-calendar-grid" role="table" aria-label="Календарь декабря 2026">
        <div role="row" className="se-weekdays">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((name) => (
            <span role="columnheader" key={name}>
              {name}
            </span>
          ))}
        </div>
        {Array.from({ length: 5 }, (_, row) => (
          <div role="row" className="se-calendar-row" key={row}>
            {Array.from({ length: 7 }, (_, column) => {
              const day = row * 7 + column;
              if (day < 1 || day > 31)
                return <span role="cell" key={column} className="se-calendar-empty" />;
              const date = `2026-12-${String(day).padStart(2, '0')}`;
              const done = !!state.progress.days[date]?.game;
              const today = date === state.today;
              const status = done
                ? 'done'
                : today
                  ? 'today'
                  : date < state.today
                    ? 'missed'
                    : 'future';
              return (
                <span
                  role="cell"
                  key={column}
                  className={`se-calendar-day se-day-${status}`}
                  aria-current={today ? 'date' : undefined}
                  aria-label={`${day} декабря: ${done ? 'игра выполнена' : today ? 'сегодня' : status === 'missed' ? 'игра не выполнена' : 'впереди'}`}
                >
                  <b>{day}</b>
                  <i aria-hidden="true">
                    {done ? '❄' : today ? '•' : status === 'missed' ? '–' : ''}
                  </i>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="se-calendar-key">
        <span>
          <i className="se-key-done" /> Выполнено
        </span>
        <span>
          <i className="se-key-today" /> Сегодня
        </span>
        <span>– Не сыграли</span>
      </div>
      <div className="se-week-bonus">
        <div>
          <strong>
            {week.over ? 'Бонусы четырёх недель' : `Неделя ${week.first}–${week.first + 6} декабря`}
          </strong>
          <span>
            {week.over
              ? `Получено ${state.progress.weeks.length} из 4 бонусов`
              : week.claimed
                ? `Бонус получен · +${WEEKLY_BONUS} ❄`
                : `${Math.min(5, week.count)} из 5 игр · бонус ${WEEKLY_BONUS} ❄`}
          </span>
        </div>
        <div className="se-week-flakes" aria-label={`${Math.min(5, week.count)} из 5 игр`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={i < week.count ? 'is-lit' : ''} aria-hidden="true">
              ❄
            </span>
          ))}
        </div>
        <p>
          {week.over
            ? '29–31 декабря — финальные ежедневные задания, без нового недельного бонуса.'
            : 'Пять выполненных игр за эту неделю — и кот добавит ещё 25 снежинок. Открытие календаря не считается игрой.'}
        </p>
      </div>
    </section>
  );
}

export function SnowCommunity({ state }: { state: SnowState }) {
  const id = useId().replace(/:/g, '');
  const percent = Math.max(
    0,
    Math.min(100, Math.floor((state.global_earned / Math.max(1, state.goal)) * 100)),
  );
  const stage = Math.floor(percent / 25);
  const titles = [
    'Разбудим зимнюю станцию',
    'Огоньки уже зажглись',
    'На станции появилась ёлка',
    'Подарки ждут под ёлкой',
    'Праздник на всей орбите!',
  ];
  const next = ['Зажжём гирлянды', 'Нарядим ёлку', 'Соберём подарки', 'Устроим большой праздник'];
  return (
    <section className="se-panel se-community" aria-labelledby="se-community-title">
      <div className="se-section-heading">
        <div>
          <p className="se-kicker">Один праздник на всех</p>
          <h2 id="se-community-title">{titles[stage]}</h2>
        </div>
        <span className="se-pill">{percent}%</span>
      </div>
      <div
        className="se-station"
        role="img"
        aria-label={`Зимняя станция: ${titles[stage]}. Общая цель выполнена на ${percent}%`}
      >
        <svg viewBox="0 0 1536 1024" aria-hidden="true">
          <defs>
            <filter id={`${id}-soft`}>
              <feGaussianBlur stdDeviation="20" />
            </filter>
            <mask id={`${id}-lights`}>
              <g fill="white" filter={`url(#${id}-soft)`}>
                <path d="M510 180h440v360H510Z M1190 0h346v320h-346Z" />
              </g>
            </mask>
            <mask id={`${id}-tree`}>
              <path d="M1315 300h221v510h-221Z" fill="white" filter={`url(#${id}-soft)`} />
            </mask>
            <mask id={`${id}-gifts`}>
              <path d="M1240 720h296v280h-296Z" fill="white" filter={`url(#${id}-soft)`} />
            </mask>
          </defs>
          <image href="/xsg-snow-assets/winter-base.webp" width="1536" height="1024" />
          {stage >= 1 && (
            <image
              href="/xsg-snow-assets/winter-hero.webp"
              width="1536"
              height="1024"
              mask={`url(#${id}-lights)`}
            />
          )}
          {stage >= 2 && (
            <image
              href="/xsg-snow-assets/winter-hero.webp"
              width="1536"
              height="1024"
              mask={`url(#${id}-tree)`}
            />
          )}
          {stage >= 3 && (
            <image
              href="/xsg-snow-assets/winter-hero.webp"
              width="1536"
              height="1024"
              mask={`url(#${id}-gifts)`}
            />
          )}
          {stage >= 4 && (
            <image href="/xsg-snow-assets/winter-hero.webp" width="1536" height="1024" />
          )}
        </svg>
      </div>
      <div className="se-community-total">
        <strong>{number(state.global_earned)} ❄</strong>
        <span>из {number(state.goal)} вместе</span>
      </div>
      <progress value={percent} max="100" aria-label="Общий прогресс станции" />
      <p>
        {stage < 4
          ? `${next[stage]} на ${25 * (stage + 1)}% · ещё ${number(Math.max(0, Math.ceil(state.goal * ((stage + 1) / 4)) - state.global_earned))} снежинок.`
          : 'Вы вместе преобразили станцию. Кот передаёт огромное спасибо 💜'}
      </p>
      <div className="se-contribution">
        Твой вклад <strong>{number(state.progress.earned)} ❄</strong>
        <span>Покупки подарков его не уменьшают.</span>
      </div>
    </section>
  );
}

export function SnowRewards({
  state,
  onSelect,
  compact = false,
}: {
  state: SnowState;
  onSelect?: (reward: SnowReward) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'se-rewards se-rewards-preview' : 'se-rewards'}>
      {state.rewards.map((reward) => {
        const status = rewardStatus(state, reward);
        const labels = {
          locked: state.phase === 'finished' ? 'Обмен завершён' : 'С 1 декабря',
          subscription: 'Нужна активная подписка',
          ineligible:
            reward.kind === 'traffic'
              ? 'Нужен тариф с лимитом трафика'
              : 'Для подписки с фиксированным сроком',
          insufficient: `Ещё ${number(Math.max(0, reward.cost - state.progress.balance))} ❄ до подарка`,
          owned: '✓ Уже получено',
          processing: 'Подарок оформлен · доставляем',
        };
        return (
          <article
            className={`se-reward se-reward-${status}`}
            key={reward.id}
            data-reward={reward.id}
          >
            <SnowRewardArt reward={reward} />
            <div className="se-reward-copy">
              <h3>{reward.name}</h3>
              <p>{reward.description}</p>
            </div>
            <div className="se-reward-footer">
              <strong>
                {number(reward.cost)} <span>❄</span>
              </strong>
              {!compact &&
                (status === 'available' ? (
                  <button type="button" className="se-secondary" onClick={() => onSelect?.(reward)}>
                    Получить
                  </button>
                ) : (
                  <span className={status === 'owned' ? 'se-success' : 'se-reward-status'}>
                    {labels[status]}
                  </span>
                ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SnowAnnouncement({ state }: { state: SnowState }) {
  const previewRewards = {
    ...state,
    rewards: state.rewards.filter(
      (reward, index) =>
        index === 0 || reward.kind === 'traffic' || index === state.rewards.length - 1,
    ),
  };
  return (
    <>
      <section className="se-panel">
        <p className="se-kicker">Праздник по чуть-чуть</p>
        <h2>Заглядывай. Играй. Забирай подарки.</h2>
        <p>
          С 1 по 31 декабря — по одному маленькому приключению каждый день. Без гонки и обязательных
          марафонов.
        </p>
        <div className="se-features">
          {[
            ['01', 'Ежедневная игра', '20 секунд, чтобы поймать снежинки для кота.'],
            ['02', 'Зимний календарь', 'Сохраняет твои успехи. Пять игр за неделю — бонус.'],
            ['03', 'Праздник на станции', 'Собираем вместе: гирлянды, ёлка и гора подарков.'],
            ['04', 'Подарки за снежинки', 'Украшения профиля, трафик и дни подписки.'],
          ].map(([index, title, text]) => (
            <div key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="se-panel">
        <p className="se-kicker">Уже упаковываем</p>
        <h2>Вот что ждёт под ёлкой</h2>
        <p>Присмотри подарок заранее. Цены — в снежинках события.</p>
        <SnowRewards state={previewRewards} compact />
        <p className="se-shop-lock">🔒 Награды откроются 1 декабря</p>
        <details className="se-details">
          <summary>Посмотреть все подарки</summary>
          <SnowRewards state={state} compact />
        </details>
      </section>
      <SnowSubscription state={state} />
    </>
  );
}

export function SnowRules() {
  return (
    <details className="se-panel se-details se-rules">
      <summary>Правила зимнего приключения</summary>
      <div>
        <h3>Как собирать снежинки</h3>
        <p>
          С 1 по 31 декабря: 5 за ежедневный визит и 15 за выполненную игру. Пять игр за одну из
          недель 1–7, 8–14, 15–21 или 22–28 декабря приносят ещё 25. Максимум — 720 снежинок за
          событие.
        </p>
        <h3>Подписка и прогресс</h3>
        <p>
          Для игр, ежедневного подарка и обмена нужна активная подписка. Если она закончится,
          прогресс сохранится. После продления можно продолжить; пропущенные дни не начисляются
          задним числом.
        </p>
        <h3>Когда выбирать подарки</h3>
        <p>
          Магазин открыт с 1 декабря до 8 января, 00:00 МСК. С 1 по 7 января новых ежедневных игр
          нет. После завершения события остаток снежинок нельзя обменять или вывести деньгами.
        </p>
        <h3>Как работают награды</h3>
        <p>
          Каждый подарок можно получить один раз. Трафик действует 30 дней и подходит подпискам с
          лимитом трафика. Дни добавляются к подписке с фиксированным сроком. Доступные варианты
          проверяются при обмене.
        </p>
      </div>
    </details>
  );
}
