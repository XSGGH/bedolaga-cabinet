import { PhoneIcon } from '@/components/icons';
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
  critical: 'text-critical-400',
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
  const headline =
    model.total === 0
      ? 'Нет актуальных VPN-проверок'
      : model.down === 0
        ? `Проверки успешны: ${model.up}/${model.total}`
        : `VPN работает в ${model.up} из ${model.total} направлений`;

  return (
    <details className="group/coverage min-w-0 rounded-xl border border-[var(--xsg-line)] bg-dark-800/60">
      <summary className="cursor-pointer list-none rounded-xl px-3 py-2.5 outline-none transition-colors hover:bg-dark-700/20 focus-visible:ring-2 focus-visible:ring-accent-400 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <PhoneIcon className={`h-3.5 w-3.5 shrink-0 ${TONES[model.tone]}`} />
          <span
            className={`min-w-0 flex-1 text-[12px] font-semibold leading-snug ${TONES[model.tone]}`}
          >
            {headline}
          </span>
          <span
            aria-hidden="true"
            className="text-dark-400 transition-transform group-open/coverage:rotate-180"
          >
            ⌄
          </span>
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] leading-relaxed text-dark-300">
          {model.regions.length > 0 && (
            <span>
              {districtCount(model.regions.length)}:{' '}
              {model.regions.map((r) => DISTRICTS[r] || r).join(' · ')}
            </span>
          )}
          <span className="text-dark-400">
            Операторы:{' '}
            {(model.operators.length
              ? model.operators.map((op) => OPERATORS[op] || op)
              : (mobile.ops?.map((op) => op.op) ?? [])
            ).join(' · ')}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-relaxed text-dark-400">
          {model.untested > 0 && <span>Без замера: {model.untested}</span>}
          {model.stale > 0 && <span className="text-warning-400">Устарели: {model.stale}</span>}
          {(model.untested > 0 || model.stale > 0) && <span aria-hidden="true">·</span>}
          <span>{checkedAt ? `Замер ${checkedAt} МСК` : 'Время замера неизвестно'}</span>
          {model.checking ? (
            <span>Идёт новая проверка</span>
          ) : (
            model.pending && <span>Ожидаем результат запуска</span>
          )}
        </div>
      </summary>

      <div className="border-t border-[var(--xsg-line)] px-3 pb-3 pt-2">
        {model.directions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-center text-[10px]">
              <caption className="sr-only">Последние проверки VPN по округам и операторам</caption>
              <thead>
                <tr className="text-dark-400">
                  <th className="py-1 text-left font-normal" scope="col">
                    Округ
                  </th>
                  {model.operators.map((op) => (
                    <th key={op} scope="col" className="px-1 py-1 font-normal">
                      {OPERATORS[op] || op}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.regions.map((region) => (
                  <tr key={region}>
                    <th scope="row" className="py-1 text-left font-medium text-dark-300">
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
                          className={`px-1 py-1 text-sm font-semibold ${state.color}`}
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
        <p className="mt-2 text-[10px] leading-relaxed text-dark-400">
          ✓ VPN работает · × Не удалось подключиться · — Нет замера · ◷ Устарело
        </p>
        {model.directions.some((r) => r.status === 'no_bs') && (
          <p className="mt-1 text-[10px] leading-relaxed text-dark-400">
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
          <p className="mt-1 text-[10px] leading-relaxed text-dark-400">
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
        <p className="mt-2 text-[10px] leading-relaxed text-dark-400">
          Результаты последних замеров в мобильных сетях. В разных округах время проверки может
          отличаться.
        </p>
      </div>
    </details>
  );
}
