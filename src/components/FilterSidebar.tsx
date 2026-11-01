import { RotateCcw } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { CheckGroup, Meta } from '../../shared/types';
import { useStateDetail } from '../api';
import {
  ALL,
  axisLabel,
  isMultiYear,
  multiYearOptions,
  normalise,
  rtoLabel,
  sameFilters,
  stateLabel,
  xAxisOptions,
  yAxisOptions,
  yearLabel,
  yearOptions,
} from '../lib/filters';
import { cn } from '../lib/utils';
import { useFilters } from '../store';
import { Button } from './ui/button';
import { Combobox, FacetedFilter } from './ui/command';
import { Field, Segmented, Spinner } from './ui/controls';
import { Tooltip } from './ui/overlays';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M8 21V11m5.33 10V15m5.34 6v-9M24 21v-4" className="stroke-primary-foreground" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground/80">{label}</p>
      {children}
    </div>
  );
}

interface Props {
  meta: Meta;
  checkGroups: CheckGroup[];
  running: boolean;
  onApplied?: () => void;
}

export function FilterSidebar({ meta, checkGroups, running, onApplied }: Props) {
  const { draft, applied, setDraft, replaceDraft, apply } = useFilters();
  const detailQuery = useStateDetail(draft?.state);
  const detail = draft && draft.state !== ALL ? detailQuery.data : undefined;

  // Keep the draft valid as dependent options load or change.
  useEffect(() => {
    if (!draft) return;
    const next = normalise(meta, detail, draft);
    if (!sameFilters(next, draft)) replaceDraft(next);
  }, [meta, detail, draft, replaceDraft]);

  if (!draft) return null;
  const dirty = !sameFilters(draft, applied);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-4">
        <Logo />
        <span className="text-sm font-semibold tracking-tight">Vahan Explorer</span>
      </div>

      <div className="scroll-thin flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-4">
        <Group label="Location">
          <Field label="State" htmlFor="filter-state">
            <Combobox id="filter-state" options={meta.states} value={draft.state} format={stateLabel} onChange={(state) => setDraft({ state, rto: ALL })} />
          </Field>
          <Field label="RTO" htmlFor="filter-rto">
            <div className="relative">
              <Combobox
                id="filter-rto"
                options={detail?.rtos ?? [{ value: ALL, label: 'All' }]}
                value={draft.rto}
                format={rtoLabel}
                disabled={draft.state === ALL || !detail}
                onChange={(rto) => setDraft({ rto })}
              />
              {draft.state !== ALL && detailQuery.isFetching && <Spinner className="absolute top-2 right-7 size-4 text-muted-foreground" />}
            </div>
          </Field>
        </Group>

        <Group label="Layout">
          <Field label="Rows" htmlFor="filter-rows">
            <Combobox id="filter-rows" options={yAxisOptions(meta, detail, draft)} value={draft.yAxis} format={axisLabel} onChange={(yAxis) => setDraft({ yAxis })} />
          </Field>
          <Field label="Columns" htmlFor="filter-columns">
            <Combobox id="filter-columns" options={xAxisOptions(meta, detail, draft)} value={draft.xAxis} format={axisLabel} onChange={(xAxis) => setDraft({ xAxis })} />
          </Field>
        </Group>

        <Group label="Period">
          {isMultiYear(draft.xAxis) ? (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Years">
              {multiYearOptions(meta, draft).map((o) => {
                const on = draft.years.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    disabled={on && draft.years.length === 1}
                    onClick={() => setDraft({ years: on ? draft.years.filter((y) => y !== o.value) : [...draft.years, o.value] })}
                    className={cn(
                      'h-7 rounded-md border text-xs tabular transition-colors',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent',
                    )}
                  >
                    {o.label.replace(/^20(\d\d)-20(\d\d)$/, '$1–$2')}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <Segmented
                label="Year type"
                value={draft.yearType}
                options={meta.yearTypes.map((t) => ({ value: t.value, label: t.label.replace(' Year', '') }))}
                onChange={(yearType) => setDraft({ yearType })}
              />
              <Field label="Year" htmlFor="filter-year">
                <Combobox id="filter-year" options={yearOptions(meta, draft)} value={draft.year} format={yearLabel} onChange={(year) => setDraft({ year })} />
              </Field>
            </>
          )}
        </Group>

        <Group label="Refine">
          <div className="space-y-2">
            {checkGroups.map((g) => (
              <FacetedFilter
                key={g.name}
                title={g.label}
                options={g.options}
                selected={draft.checks[g.name] ?? []}
                onChange={(values) => setDraft({ checks: { ...draft.checks, [g.name]: values } })}
              />
            ))}
          </div>
        </Group>
      </div>

      <div className="space-y-2 border-t p-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={running || !dirty}
            onClick={() => {
              apply();
              onApplied?.();
            }}
          >
            {running && <Spinner />}
            {running ? 'Running…' : 'Apply filters'}
          </Button>
          <Tooltip label="Reset to defaults" side="top">
            <Button variant="outline" size="icon" aria-label="Reset to defaults" onClick={() => replaceDraft(normalise(meta, undefined, meta.defaults))}>
              <RotateCcw />
            </Button>
          </Tooltip>
        </div>
        <p className="text-[11px] text-muted-foreground">{dirty ? 'You have unapplied changes' : 'Unofficial · data from VAHAN, MoRTH'}</p>
      </div>
    </div>
  );
}
