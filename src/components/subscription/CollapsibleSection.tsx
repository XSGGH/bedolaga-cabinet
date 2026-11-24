import { useId, useState, type ReactNode } from 'react';

import { ChevronDownIcon } from '@/components/icons';

interface CollapsibleSectionProps {
  title: ReactNode;
  /** Справа в шапке: краткая сводка (например «1,4 / 170 ГБ»). */
  summary?: ReactNode;
  hideSummaryWhenOpen?: boolean;
  /** Показывается под шапкой, пока секция свёрнута (например тонкая полоска). */
  collapsedPreview?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** Рамка шапки без подложки — когда секция лежит внутри другой карточки. */
  className?: string;
  headerClassName?: string;
  variant?: 'plain' | 'inset';
  icon?: ReactNode;
}

/**
 * Сворачиваемый блок страницы подписки. По умолчанию свёрнут.
 * Шапка — единственная кнопка; содержимое остаётся в DOM (hidden), чтобы
 * внутренние запросы и состояние не терялись при сворачивании.
 */
export function CollapsibleSection({
  title,
  summary,
  hideSummaryWhenOpen = false,
  collapsedPreview,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  className = '',
  headerClassName = 'px-4 py-3 sm:px-6',
  variant = 'plain',
  icon,
}: CollapsibleSectionProps) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const bodyId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          setLocalOpen(!open);
          onOpenChange?.(!open);
        }}
        aria-expanded={open}
        aria-controls={bodyId}
        className={`flex w-full flex-col gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
          variant === 'inset'
            ? `min-h-12 rounded-xl border border-[var(--border-default)] px-3 py-3 transition-colors hover:bg-hover active:bg-selected ${open ? 'bg-hover' : 'bg-elevated'}`
            : headerClassName
        }`}
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span
            className={`flex min-w-0 items-center text-sm font-semibold text-dark-100 sm:text-base ${variant === 'inset' ? 'gap-2' : 'flex-wrap gap-x-3 gap-y-1'}`}
          >
            {icon}
            {title}
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 text-[11px] text-dark-300 tabular-nums sm:text-xs">
            {(!open || !hideSummaryWhenOpen) && summary}
            <ChevronDownIcon
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-dark-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </span>
        {!open && collapsedPreview}
      </button>
      <div id={bodyId} className={open ? (variant === 'inset' ? 'pt-2' : '') : 'hidden'}>
        {children}
      </div>
    </div>
  );
}

export default CollapsibleSection;
