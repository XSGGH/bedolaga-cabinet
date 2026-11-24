import * as Dialog from '@radix-ui/react-dialog';
import { ChevronRightIcon, CloseIcon } from '@/components/icons';
import {
  checkTime,
  coverageModel,
  districtCount,
  DIRECTION_STATES,
  DISTRICTS,
  DISTRICT_NAMES,
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

  const summary = `Мобильные сети: ${model.up} из ${model.total} проверок успешны. ${footprint}. Не требуются: ${model.notRequired}. Без результата: ${model.noResult}. Устарели: ${model.stale}. Открыть подробности`;
  const headline =
    model.total === 0
      ? model.notRequired > 0 && model.noResult === 0 && model.stale === 0
        ? 'Проверка не требуется'
        : 'Нет свежих данных'
      : model.down > 0
        ? 'Есть проблемы с подключением'
        : 'Все завершённые проверки успешны';
  const caption = [
    model.total > 0 ? `${model.up} из ${model.total} успешно` : '',
    model.notRequired > 0 ? `${model.notRequired} не требуются` : '',
    model.noResult > 0 ? `${model.noResult} без результата` : '',
    model.stale > 0 ? `Устарели: ${model.stale}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={summary}
          className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-line bg-elevated px-3 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <span className="min-w-0 space-y-1">
            <span className="block text-xs font-medium text-dark-200">Мобильные сети</span>
            <span className={`block text-sm font-semibold leading-snug ${TONES[model.tone]}`}>
              {headline}
            </span>
            <span className="block text-xs leading-relaxed text-dark-300">{caption}</span>
            <span className="block text-xs leading-relaxed text-dark-400">
              {model.checking ? 'Идёт проверка' : model.pending ? 'Ждём результат' : footprint}
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-accent-300" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[10000] bg-dark-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] z-[10001] flex max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom,0px))] flex-col overflow-hidden rounded-2xl border border-[var(--xsg-line)] bg-dark-900 shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[460px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
            <div>
              <Dialog.Title className="text-base font-bold text-dark-50">
                Мобильные сети
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-dark-400">
                Последняя проверка: {checkedAt ? `${checkedAt} МСК` : 'нет данных'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрыть"
                className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-700/50 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="mb-4 mt-2 space-y-1 text-xs">
              <p className={`font-semibold ${TONES[model.tone]}`}>{headline}</p>
              <p className="leading-relaxed text-dark-300">{caption}</p>
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
                        <th
                          scope="row"
                          className="py-2 pl-3 text-left font-medium text-dark-200"
                          title={DISTRICT_NAMES[region] || region}
                        >
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

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-dark-300">
              <span>
                <span className="text-success-400">✓</span> Работает
              </span>
              <span>— Не требуется</span>
              <span>? Нет результата</span>
              <span>
                <span className="text-critical-500">×</span> Проблема
              </span>
              {model.stale > 0 && <span className="text-warning-400">◷ Устарело</span>}
            </div>
            <div className="mt-4 space-y-2 text-xs leading-relaxed text-dark-300">
              <p>
                «Не требуется» — белые списки отключены, обход не нужен. Отсутствие результата не
                означает сбой VPN.
              </p>
              {(model.checking || model.pending) && (
                <p className="text-accent-300">
                  {model.checking ? 'Идёт новая проверка.' : 'Ожидаем результат запуска.'}
                </p>
              )}
              <p>
                Результаты относятся к проверкам операторов в указанных округах. Время отдельных
                замеров может отличаться.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
