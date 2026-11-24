import type { ButtonHTMLAttributes } from 'react';
import { PlusIcon } from '@/components/icons';

export const addonActionClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent-400/30 bg-accent-500/10 px-3 text-[13px] font-medium text-accent-300 transition-colors hover:bg-accent-500/15 active:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:cursor-not-allowed disabled:border-line disabled:bg-elevated disabled:text-dark-400';

export default function AddonPurchaseButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${addonActionClass} ${className}`} {...props}>
      <PlusIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {children}
    </button>
  );
}
