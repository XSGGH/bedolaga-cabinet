import type { ReactNode } from 'react';
import { WarningIcon } from '@/components/icons';

/** A quota status, rather than an error banner or an extra purchase action. */
export default function LimitStatusNotice({
  children,
  exhausted = false,
  className = '',
}: {
  children: ReactNode;
  exhausted?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-relaxed text-warning-300 ${exhausted ? 'border-warning-500/30 bg-warning-500/10' : 'border-warning-500/20 bg-warning-500/5'} ${className}`}
    >
      <span aria-hidden="true" className="flex shrink-0">
        <WarningIcon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
