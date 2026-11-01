import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { Option } from '../../shared/types';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-ink-2">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <span className="font-normal text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  format?: (option: Option) => string;
}

export function Select({ options, value, onChange, format, className, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full appearance-none truncate rounded-lg border border-line bg-surface pr-9 pl-3 text-sm text-ink shadow-xs outline-none transition',
          'hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {format ? format(o) : o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  stretch?: boolean;
}

export function Segmented<T extends string>({ label, value, options, onChange, size = 'md', stretch }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', stretch && 'flex w-full')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md font-medium whitespace-nowrap transition',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            stretch && 'flex-1',
            o.value === value ? 'bg-surface text-ink shadow-xs ring-1 ring-line' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' };

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-ink shadow-xs hover:bg-accent-strong',
        variant === 'secondary' && 'border border-line bg-surface text-ink-2 shadow-xs hover:border-line-strong hover:text-ink',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...rest}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="group inline-flex items-center gap-2 text-sm text-ink-2">
      <span className={cn('relative h-5 w-9 rounded-full transition', checked ? 'bg-accent' : 'bg-line-strong')}>
        <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition', checked && 'translate-x-4')} />
      </span>
      {label}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder, small }: { value: string; onChange: (v: string) => void; placeholder: string; small?: boolean }) {
  return (
    <div className="relative">
      <Search className={cn('pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint', small ? 'size-3.5' : 'size-4')} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'w-full rounded-lg border border-line bg-surface text-ink shadow-xs outline-none transition placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-accent/15',
          small ? 'h-8 pr-7 pl-8 text-xs' : 'h-9 pr-8 pl-9 text-sm',
        )}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'neutral' }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular',
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted ring-1 ring-line',
      )}
    >
      {children}
    </span>
  );
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('size-4 animate-spin', className)} />;
