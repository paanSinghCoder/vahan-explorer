import { Github, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CheckGroup, Meta, Option } from '../../shared/types';
import { useStateDetail } from '../api';
import {
  ALL,
  axisLabel,
  isMultiYear,
  monthApplies,
  monthOptions,
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

const REPO_URL = 'https://github.com/paanSinghCoder/vahan-explorer';

/** A number plate: the strip on the left nods to the "IND" band on Indian plates. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect x="4.5" y="9.5" width="23" height="13" rx="2.5" className="fill-primary-foreground" />
      <rect x="6.5" y="11.5" width="3" height="9" rx="1" className="fill-data" />
      <rect x="12" y="13" width="12.5" height="2.2" rx="1.1" className="fill-primary" />
      <rect x="12" y="16.8" width="8" height="2.2" rx="1.1" className="fill-primary" />
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
  /** Month choices from the latest report. */
  months: Option[];
  running: boolean;
}

/** Report filters. Changes apply automatically (see useFilterSync). */
export function FilterSidebar({ meta, checkGroups, months, running }: Props) {
  const { draft, applied, setDraft, replaceDraft } = useFilters();
  const detailQuery = useStateDetail(draft?.state);
  const detail = draft && draft.state !== ALL ? detailQuery.data : undefined;

  if (!draft) return null;
  const updating = running || !sameFilters(draft, applied);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 pr-11 pl-4 md:pr-2">
        <Logo className="size-8" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold tracking-tight">Vahan Explorer</p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title="Source code on GitHub"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <Github className="size-3" />
            paanSinghCoder
          </a>
        </div>
        <Tooltip label="Reset filters">
          <Button variant="ghost" size="icon" aria-label="Reset filters" onClick={() => replaceDraft(normalise(meta, undefined, meta.defaults))}>
            <RotateCcw />
          </Button>
        </Tooltip>
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
                onChange={(yearType) => setDraft({ yearType, month: '' })}
              />
              <Field label="Year" htmlFor="filter-year">
                <Combobox id="filter-year" options={yearOptions(meta, draft)} value={draft.year} format={yearLabel} onChange={(year) => setDraft({ year, month: '' })} />
              </Field>
              {monthApplies(draft) && (
                <Field label="Month" htmlFor="filter-month">
                  <Combobox id="filter-month" options={monthOptions(months, draft)} value={draft.month} searchable={false} onChange={(month) => setDraft({ month })} />
                </Field>
              )}
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

      <p role="status" className="flex h-10 shrink-0 items-center gap-2 border-t px-4 text-[11px] text-muted-foreground">
        {updating ? (
          <>
            <Spinner className="size-3" />
            Updating report…
          </>
        ) : (
          'Unofficial · data from VAHAN, MoRTH'
        )}
      </p>
    </div>
  );
}
