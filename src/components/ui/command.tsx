// shadcn/ui-style Command (cmdk) plus the two pickers built on it: a single-select
// Combobox and a multi-select "faceted filter".
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronsUpDown, PlusCircle, Search } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import type { Option } from '../../../shared/types';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './overlays';

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive className={cn('flex w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)} {...props} />;
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-9 items-center gap-2 border-b px-3">
      <Search className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input className={cn('h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground', className)} {...props} />
    </div>
  );
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('scroll-thin max-h-72 overflow-x-hidden overflow-y-auto p-1', className)} {...props} />;
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}

const Empty = () => <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">No results</CommandPrimitive.Empty>;

const trigger =
  'flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-sm shadow-xs outline-none transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

interface ComboboxProps {
  id?: string;
  'aria-label'?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  format?: (option: Option) => string;
  disabled?: boolean;
  className?: string;
  /** Show a search box; defaults to on for long lists. */
  searchable?: boolean;
}

export function Combobox({ id, value, options, onChange, format, disabled, className, searchable, ...aria }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const label = (o: Option) => (format ? format(o) : o.label);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open} aria-label={aria['aria-label']} disabled={disabled} className={cn(trigger, className)}>
          <span className="min-w-0 flex-1 truncate">{selected ? label(selected) : 'Select…'}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56">
        <Command>
          {(searchable ?? options.length > 8) && <CommandInput placeholder="Search…" />}
          <CommandList>
            <Empty />
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${label(o)} ${o.value}`}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Check className={cn('size-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{label(o)}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface FacetedFilterProps {
  title: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/** Multi-select refinement in the style of shadcn's data-table faceted filter. */
export function FacetedFilter({ title, options, selected, onChange }: FacetedFilterProps) {
  const chosen = new Set(selected);
  const first = options.find((o) => chosen.has(o.value));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(trigger, !selected.length && 'border-dashed shadow-none')}>
          <PlusCircle className={cn('size-3.5 shrink-0 opacity-60', selected.length && 'rotate-45')} />
          <span className="shrink-0">{title}</span>
          {selected.length > 0 && (
            <>
              <span className="h-4 w-px shrink-0 bg-border" />
              <span className="min-w-0 truncate rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                {selected.length === 1 ? first?.label : `${selected.length} selected`}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <Empty />
            {options.map((o) => {
              const on = chosen.has(o.value);
              return (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              );
            })}
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <CommandItem onSelect={() => onChange([])} className="justify-center">
                Clear filters
              </CommandItem>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
