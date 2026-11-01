import { Check, Download, ExternalLink, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReportResult } from '../../shared/types';
import { downloadCsv, tidyTitle, UNITS } from '../lib/format';
import { filterAndSort, visibleColumns, type Sort } from '../lib/table';
import { shareUrl, useFilters } from '../store';
import { KpiCards } from './KpiCards';
import { PivotTable } from './PivotTable';
import { Button, cn, SearchInput, Segmented, Toggle } from './ui';

const SOURCE_URL = 'https://vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml';

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

export function ReportView({ report, fetching }: { report: ReportResult; fetching: boolean }) {
  const { applied, apply, unit, hideEmpty, heatmap, pageSize, setPrefs } = useFilters();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>(() => {
    const total = report.columns.lastIndexOf('TOTAL');
    return total >= 0 ? { column: total, dir: 'desc' } : null;
  });
  const [copied, setCopied] = useState(false);

  const columns = useMemo(() => visibleColumns(report, hideEmpty), [report, hideEmpty]);
  const safeSort = sort && sort.column !== 'label' && (sort.column < 0 || sort.column >= report.columns.length) ? null : sort;
  const rows = useMemo(() => filterAndSort(report.rows, query, safeSort), [report.rows, query, safeSort]);
  const title = tidyTitle(report.title);

  const refinements = report.checkGroups
    .filter((g) => report.appliedChecks[g.name]?.length)
    .map((g) => {
      const picked = new Set(report.appliedChecks[g.name]);
      return { label: g.label, values: g.options.filter((o) => picked.has(o.value)).map((o) => o.label) };
    });

  const exportCsv = () => {
    downloadCsv(
      `${title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'vahan-report'}.csv`,
      [report.rowHeader, ...columns.map((c) => report.columns[c])],
      rows.map((r) => [r.label, ...columns.map((c) => r.values[c])]),
    );
  };

  const copyLink = async () => {
    if (!applied) return;
    await navigator.clipboard.writeText(shareUrl(applied));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn('space-y-5 transition-opacity', fetching && 'pointer-events-none opacity-60')}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            Updated {timeFormat.format(new Date(report.fetchedAt))}
            {' · '}
            {report.cached ? 'from cache' : `fetched in ${(report.tookMs / 1000).toFixed(1)}s`}
          </p>
          {refinements.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {refinements.map((r) => (
                <span key={r.label} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2">
                  <span className="font-medium text-muted">{r.label}:</span>
                  <span className="truncate">{r.values.join(', ')}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={copyLink} title="Copy a link that opens this report">
            {copied ? <Check className="size-4 text-accent" /> : <Link2 className="size-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button onClick={exportCsv} disabled={!rows.length}>
            <Download className="size-4" />
            CSV
          </Button>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            title="Open the original VAHAN report page"
            className="inline-flex h-9 items-center rounded-lg px-2.5 text-muted transition hover:bg-surface hover:text-ink"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </header>

      <KpiCards report={report} />

      {report.tableGroups.length > 0 && (
        <nav aria-label="Vehicle category group" className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {report.tableGroups.map((g) => {
            const active = g.value === report.tableGroup;
            return (
              <button
                key={g.value}
                type="button"
                aria-current={active}
                onClick={() => !active && apply({ tableGroup: g.value })}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition',
                  active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
                )}
              >
                {g.label}
              </button>
            );
          })}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="w-full sm:w-72">
          <SearchInput value={query} onChange={setQuery} placeholder={`Search ${report.rowHeader.toLowerCase()}`} />
        </div>
        <Toggle checked={hideEmpty} onChange={(v) => setPrefs({ hideEmpty: v })} label="Hide empty columns" />
        <Toggle checked={heatmap} onChange={(v) => setPrefs({ heatmap: v })} label="Heatmap" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-xs text-muted">Values in</span>
          <Segmented label="Values in" size="sm" value={unit} options={UNITS} onChange={(u) => setPrefs({ unit: u })} />
        </div>
      </div>

      {report.rows.length ? (
        <PivotTable
          report={report}
          columns={columns}
          rows={rows}
          sort={safeSort}
          onSort={setSort}
          unit={unit}
          heatmap={heatmap}
          pageSize={pageSize}
          onPageSize={(n) => setPrefs({ pageSize: n })}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <p className="font-medium text-ink">No registrations for these filters</p>
          <p className="mt-1 text-sm text-muted">Try a wider period, another state, or fewer refinements.</p>
        </div>
      )}
    </div>
  );
}
