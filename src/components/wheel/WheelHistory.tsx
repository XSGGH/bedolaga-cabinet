import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wheelApi } from '@/api/wheel';
import { HistoryIcon, ChevronDownIcon } from '@/components/icons';
import { uiLocale } from '@/utils/uiLocale';
import { historyReward, spinCost } from './wheelPresentation';

export default function WheelHistory() {
  const [expanded, setExpanded] = useState(false);
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['wheel-history', page],
    queryFn: () => wheelApi.getHistory(page, 10),
    enabled: expanded,
    retry: false,
  });
  return (
    <section
      className="rounded-[22px] border border-dark-700 bg-dark-900/80"
      aria-label="История вращений"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="wheel-history-content"
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-dark-100 sm:px-5"
      >
        <span className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4" />
          История вращений
          {data && <span className="text-xs font-normal text-dark-300">({data.total})</span>}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div id="wheel-history-content" className="border-t border-dark-700/60 px-4 pb-3 sm:px-5">
          {isPending ? (
            <p role="status" className="py-4 text-sm text-dark-300">
              Загружаем историю…
            </p>
          ) : isError ? (
            <div role="alert" className="py-3 text-sm text-dark-300">
              <p>Не удалось загрузить историю.</p>
              <button
                type="button"
                disabled={isFetching}
                onClick={() => void refetch()}
                className="min-h-11 text-accent-300"
              >
                Повторить
              </button>
            </div>
          ) : data?.items.length ? (
            <>
              <ul className="divide-y divide-dark-700/60">
                {data.items.slice(0, all ? undefined : 3).map((item) => {
                  const date = new Date(item.created_at);
                  const label = Number.isNaN(date.getTime())
                    ? 'Дата не указана'
                    : `${new Intl.DateTimeFormat(uiLocale(), {
                        timeZone: 'Europe/Moscow',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(date)} МСК`;
                  return (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dark-800 text-lg"
                      >
                        {item.emoji}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-medium text-dark-100 [overflow-wrap:anywhere]">
                          {historyReward(item)}
                        </p>
                        <p className="text-xs leading-relaxed text-dark-300">
                          Стоимость вращения: {spinCost(item.payment_type, item.payment_amount)}
                        </p>
                        {item.prize_type === 'promocode' && (
                          <p className="text-xs text-dark-300">Награда — промокод</p>
                        )}
                        <time
                          dateTime={Number.isNaN(date.getTime()) ? undefined : item.created_at}
                          className="block text-xs text-dark-400"
                        >
                          {label}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {data.items.length > 3 && (
                <button
                  type="button"
                  onClick={() => setAll(!all)}
                  className="min-h-11 w-full text-sm font-medium text-accent-300"
                >
                  {all ? 'Показать последние 3' : `Показать ещё ${data.items.length - 3}`}
                </button>
              )}
              {data.pages > 1 && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dark-700/60 pt-2 text-xs text-dark-300">
                  <button
                    type="button"
                    disabled={page <= 1 || isFetching}
                    onClick={() => {
                      setPage(page - 1);
                      setAll(false);
                    }}
                    className="min-h-11 px-2 text-accent-300 disabled:opacity-40"
                  >
                    Назад
                  </button>
                  <span>
                    Страница {page} из {data.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= data.pages || isFetching}
                    onClick={() => {
                      setPage(page + 1);
                      setAll(false);
                    }}
                    className="min-h-11 px-2 text-accent-300 disabled:opacity-40"
                  >
                    Далее
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="py-4 text-sm text-dark-300">История вращений пуста.</p>
          )}
        </div>
      )}
    </section>
  );
}
