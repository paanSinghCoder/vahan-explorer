import { CalendarRange, LayoutGrid, MapPin, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
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
import { useFilters } from '../store';
import { CheckGroupSection } from './CheckGroupSection';
import { Button, cn, Field, Segmented, Select, Spinner } from './ui';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-5 py-5 last:border-b-0">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

interface Props {
  meta: Meta;
  checkGroups: CheckGroup[];
  running: boolean;
  onApplied?: () => void;
}

export function FilterPanel({ meta, checkGroups, running, onApplied }: Props) {
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
  const loadingState = draft.state !== ALL && detailQuery.isFetching;
  const multi = isMultiYear(draft.xAxis);

  const run = () => {
    apply();
    onApplied?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-thin flex-1 overflow-y-auto">
        <Section icon={<MapPin className="size-3.5" />} title="Location">
          <Field label="State" htmlFor="filter-state">
            <Select id="filter-state" options={meta.states} value={draft.state} format={stateLabel} onChange={(state) => setDraft({ state, rto: ALL })} />
          </Field>
          <Field label="RTO" htmlFor="filter-rto" hint={loadingState ? <Spinner className="size-3" /> : undefined}>
            <Select
              id="filter-rto"
              options={detail?.rtos ?? [{ value: ALL, label: 'All' }]}
              value={draft.rto}
              format={rtoLabel}
              disabled={draft.state === ALL || !detail}
              onChange={(rto) => setDraft({ rto })}
            />
          </Field>
        </Section>

        <Section icon={<LayoutGrid className="size-3.5" />} title="Layout">
          <Field label="Rows" htmlFor="filter-rows" hint="Y-axis">
            <Select id="filter-rows" options={yAxisOptions(meta, detail, draft)} value={draft.yAxis} format={axisLabel} onChange={(yAxis) => setDraft({ yAxis })} />
          </Field>
          <Field label="Columns" htmlFor="filter-columns" hint="X-axis">
            <Select id="filter-columns" options={xAxisOptions(meta, detail, draft)} value={draft.xAxis} format={axisLabel} onChange={(xAxis) => setDraft({ xAxis })} />
          </Field>
        </Section>

        <Section icon={<CalendarRange className="size-3.5" />} title="Period">
          {multi ? (
            <div>
              <p className="mb-2 text-xs text-muted">Pick the years to compare</p>
              <div className="grid grid-cols-2 gap-1.5">
                {multiYearOptions(meta, draft).map((o) => {
                  const on = draft.years.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDraft({ years: on ? draft.years.filter((y) => y !== o.value) : [...draft.years, o.value] })
                      }
                      disabled={on && draft.years.length === 1}
                      className={cn(
                        'h-8 rounded-md border text-xs font-medium tabular transition',
                        on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <Segmented
                label="Year type"
                stretch
                size="sm"
                value={draft.yearType}
                options={meta.yearTypes.map((t) => ({ value: t.value, label: t.label.replace(' Year', '') }))}
                onChange={(yearType) => setDraft({ yearType })}
              />
              <Field label="Year" htmlFor="filter-year">
                <Select id="filter-year" options={yearOptions(meta, draft)} value={draft.year} format={yearLabel} onChange={(year) => setDraft({ year })} />
              </Field>
            </>
          )}
        </Section>

        <Section icon={<SlidersHorizontal className="size-3.5" />} title="Refine">
          <div className="-mt-1">
            {checkGroups.map((g) => (
              <CheckGroupSection
                key={g.name}
                group={g}
                selected={draft.checks[g.name] ?? []}
                onChange={(values) => setDraft({ checks: { ...draft.checks, [g.name]: values } })}
              />
            ))}
          </div>
        </Section>
      </div>

      <div className="border-t border-line bg-surface px-5 py-4">
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={run} disabled={running || !dirty}>
            {running ? <Spinner /> : <Play className="size-4" />}
            {running ? 'Running…' : 'Run report'}
          </Button>
          <Button
            variant="ghost"
            aria-label="Reset filters to defaults"
            title="Reset filters to defaults"
            onClick={() => replaceDraft(normalise(meta, undefined, meta.defaults))}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
        <p className={cn('mt-2 text-center text-xs', dirty ? 'text-accent' : 'text-faint')}>
          {dirty ? 'You have changes that aren’t applied yet' : 'Filters are saved and reopen with the page'}
        </p>
      </div>
    </div>
  );
}
