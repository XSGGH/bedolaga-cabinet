import * as Dialog from '@radix-ui/react-dialog';
import { ChevronRightIcon, CloseIcon } from '@/components/icons';
import {
  checkTime,
  coverageModel,
  districtCount,
  DIRECTION_STATES,
  DISTRICTS,
  OPERATORS,
  type MobileProgress,
  type MobileStatus,
} from './mobileCoverageModel';

const TONES = {
  success: 'text-success-400',
  warning: 'text-warning-400',
  critical: 'text-critical-500',
  neutral: 'text-dark-400',
};

export default function MobileCoverage({
  mobile,
  progress,
}: {
  mobile: MobileStatus;
  progress?: MobileProgress;
}) {
  const model = coverageModel(mobile, progress);
  const checkedAt = checkTime(model.at);
  const operatorNumber = model.operators.length || mobile.ops?.length || 0;
  const operatorWord = new Intl.PluralRules('ru').select(operatorNumber);
  const footprint = [
    model.regions.length ? districtCount(model.regions.length) : '',
    operatorNumber
      ? `${operatorNumber} ${operatorWord === 'one' ? 'оператор' : operatorWord === 'few' ? 'оператора' : 'операторов'}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const result = model.total > 0 ? `${model.up}/${model.total}` : 'Нет замеров';
  const summary = `Мобильные сети: ${model.up} из ${model.total} проверок успешны. ${footprint}. Без замера: ${model.untested}. Устарели: ${model.stale}. Открыть подробности`;
  const caption = model.checking
    ? 'Идёт проверка'
    : model.pending
      ? 'Ждём результат'
      : model.stale > 0
        ? `Устарели: ${model.stale}`
        : footprint || 'Результаты проверок';

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={summary}
          className="flex h-[84px] min-w-0 flex-col justify-between rounded-xl border border-accent-500/25 bg-accent-500/[0.06] px-2.5 py-2.5 text-left transition-colors hover:border-accent-400/50 hover:bg-accent-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:h-[88px] sm:px-3"
        >
          <span className="text-[11px] font-medium text-dark-200 sm:text-xs">Мобильные сети</span>
          <span className="flex items-center justify-between gap-1">
            <span
              className={`font-semibold leading-tight tabular-nums ${model.total > 0 ? 'text-[17px]' : 'text-xs'} ${TONES[model.tone]}`}
            >
              {result}
              {model.total > 0 && (
                <span className="ml-1 hidden text-[10px] font-medium min-[360px]:inline">
                  успешно
                </span>
              )}
            </span>
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-accent-300" />
          </span>
          <span className="text-[10px] leading-3 text-dark-400" title={caption}>
            {caption.replace(/(\d+) /g, '$1\u00a0')}
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[10000] bg-dark-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-[10001] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[var(--xsg-line)] bg-dark-900 p-4 shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[460px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-bold text-dark-50">
                Мобильные сети
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-dark-400">
                Белые списки · {checkedAt ? `${checkedAt} МСК` : 'Время замера неизвестно'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрыть"
                className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-700/50 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mb-4 mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
            <span className={`font-semibold ${TONES[model.tone]}`}>
              {model.total > 0 ? `${result} проверок успешно` : 'Нет актуальных проверок'}
            </span>
            {model.untested > 0 && (
              <span className="text-dark-400">Без замера: {model.untested}</span>
            )}
            {model.stale > 0 && <span className="text-warning-400">Устарели: {model.stale}</span>}
          </div>

          {model.directions.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[var(--xsg-line)]">
              <table className="w-full table-fixed text-center text-[10px] sm:text-xs">
                <caption className="sr-only">
                  Последние проверки VPN по округам и операторам
                </caption>
                <thead className="bg-dark-800">
                  <tr className="text-dark-400">
                    <th className="py-2.5 pl-3 text-left font-medium" scope="col">
                      Округ
                    </th>
                    {model.operators.map((op) => (
                      <th key={op} scope="col" className="px-0.5 py-2.5 font-medium">
                        {OPERATORS[op] || op}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.regions.map((region) => (
                    <tr key={region} className="border-t border-[var(--xsg-line)]">
                      <th scope="row" className="py-2 pl-3 text-left font-medium text-dark-200">
                        {DISTRICTS[region] || region}
                      </th>
                      {model.operators.map((op) => {
                        const row = model.directions.find(
                          (r) => r.region === region && r.operator === op,
                        );
                        const state = DIRECTION_STATES[row?.status ?? 'unknown'];
                        const time = checkTime(row?.at ?? 0);
                        const label = `${DISTRICTS[region] || region}, ${OPERATORS[op] || op}: ${state.label}${time ? `, ${time} МСК` : ''}`;
                        return (
                          <td
                            key={op}
                            className={`px-1 py-2 text-sm font-semibold ${state.color}`}
                            title={label}
                            aria-label={label}
                          >
                            {state.symbol}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-dark-400">
            <span>
              <span className="text-success-400">✓</span> Работает
            </span>
            <span>
              <span className="text-critical-500">×</span> Сбой
            </span>
            <span>— Нет замера</span>
            {model.stale > 0 && (
              <span>
                <span className="text-warning-400">◷</span> Устарело
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-dark-400">
            {model.directions.some((r) => r.status === 'no_bs') && (
              <p>
                Белые списки отключены:{' '}
                {model.directions
                  .filter((r) => r.status === 'no_bs')
                  .map(
                    (r) =>
                      `${DISTRICTS[r.region] || r.region} / ${OPERATORS[r.operator] || r.operator}`,
                  )
                  .join(', ')}
                .
              </p>
            )}
            {model.directions.some((r) => ['no_modem', 'modem_unavailable'].includes(r.status)) && (
              <p>
                Нет доступного модема:{' '}
                {model.directions
                  .filter((r) => ['no_modem', 'modem_unavailable'].includes(r.status))
                  .map(
                    (r) =>
                      `${DISTRICTS[r.region] || r.region} / ${OPERATORS[r.operator] || r.operator}`,
                  )
                  .join(', ')}
                .
              </p>
            )}
            {(model.checking || model.pending) && (
              <p className="text-accent-300">
                {model.checking ? 'Идёт новая проверка.' : 'Ожидаем результат запуска.'}
              </p>
            )}
            <p>
              Одна проверка — один оператор в округе. Указаны последние результаты; время замеров
              может отличаться.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
