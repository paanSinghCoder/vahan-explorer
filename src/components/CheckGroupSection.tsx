import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { CheckGroup } from '../../shared/types';
import { Badge, cn, SearchInput } from './ui';

interface Props {
  group: CheckGroup;
  selected: string[];
  onChange: (values: string[]) => void;
}

/** One collapsible refinement list (e.g. Fuel). Nothing ticked means everything is included. */
export function CheckGroupSection({ group, selected, onChange }: Props) {
  const [open, setOpen] = useState(selected.length > 0);
  const [query, setQuery] = useState('');
  const chosen = new Set(selected);
  const q = query.trim().toLowerCase();
  const visible = q ? group.options.filter((o) => o.label.toLowerCase().includes(q)) : group.options;

  const toggle = (value: string) => onChange(chosen.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-2.5 text-left text-sm font-medium text-ink hover:text-accent"
      >
        {group.label}
        <span className="flex items-center gap-2">
          {selected.length > 0 && <Badge>{selected.length}</Badge>}
          <ChevronDown className={cn('size-4 text-faint transition', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="pb-3">
          {group.options.length > 8 && <SearchInput small value={query} onChange={setQuery} placeholder={`Search ${group.label.toLowerCase()}`} />}
          <div className="mt-2 flex items-center justify-between px-0.5 text-xs text-muted">
            <span>{selected.length ? `${selected.length} of ${group.options.length} selected` : `All ${group.options.length} included`}</span>
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="font-medium text-accent hover:underline">
                Clear
              </button>
            )}
          </div>
          <ul className="scroll-thin mt-1.5 max-h-60 space-y-px overflow-y-auto pr-1">
            {visible.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={chosen.has(o.value)}
                    onChange={() => toggle(o.value)}
                    className="size-3.5 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="truncate" title={o.label}>
                    {o.label}
                  </span>
                </label>
              </li>
            ))}
            {!visible.length && <li className="px-2 py-1.5 text-xs text-faint">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
