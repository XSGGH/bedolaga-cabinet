import { useId, useState, type ReactNode } from 'react';

import { ChevronDownIcon } from '@/components/icons';

interface CollapsibleSectionProps {
  title: ReactNode;
  /** Справа в шапке: краткая сводка (например «1,4 / 170 ГБ»). */
  summary?: ReactNode;
  /** Показывается под шапкой, пока секция свёрнута (например тонкая полоска). */
  collapsedPreview?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Рамка шапки без подложки — когда секция лежит внутри другой карточки. */
  className?: string;
  headerClassName?: string;
}

/**
 * Сворачиваемый блок страницы подписки. По умолчанию свёрнут.
 * Шапка — единственная кнопка; содержимое остаётся в DOM (hidden), чтобы
 * внутренние запросы и состояние не терялись при сворачивании.
 */
export function CollapsibleSection({
  title,
  summary,
  collapsedPreview,
  defaultOpen = false,
  children,
  className = '',
  headerClassName = 'px-5 py-4 sm:px-7',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className={`flex w-full flex-col gap-3 text-left ${headerClassName}`}
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold tracking-tight text-dark-50">
            {title}
          </span>
          <span className="flex shrink-0 items-center gap-2.5 text-[13px] text-dark-300 tabular-nums">
            {summary}
            <ChevronDownIcon
              className={`h-4 w-4 text-dark-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </span>
        {!open && collapsedPreview}
      </button>
      <div id={bodyId} className={open ? '' : 'hidden'}>
        {children}
      </div>
    </div>
  );
}

export default CollapsibleSection;
