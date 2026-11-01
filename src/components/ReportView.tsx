import { Check, Download, ExternalLink, Link2, Settings2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReportResult, ReportRow } from '../../shared/types';
import { downloadCsv, formatCompact, formatInteger, formatPercent, tidyTitle, UNITS } from '../lib/format';
import { columnSums, filterAndSort, totalIndex, visibleColumns, type Sort } from '../lib/table';
import { cn } from '../lib/utils';
import { shareUrl, useFilters, type Unit } from '../store';
import { PivotTable } from './PivotTable';
import { TopBar } from './TopBar';
import { Button } from './ui/button';
import { Combobox } from './ui/command';
import { SearchInput } from './ui/controls';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from './ui/overlays';

const SOURCE_URL = 'https://vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml';
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

/** "Maker Wise Fuel Data of X, Y (2025)" -> { main: "Maker × Fuel", detail: "X, Y · 2025" }. */
function describeTitle(raw: string) {
  const title = tidyTitle(raw).replace(/\bRto\b/g, 'RTO');
  const m = title.match(/^(.+?) Wise (.+?) Data (?:of (.+?)|For All State)\s*(?:\((.*)\))?$/);
  if (!m) return { main: title, detail: '' };
  // A month shows as "(JAN,2025)"; tidy it to "Jan 2025".
  const period = m[4]?.trim().replace(/^([A-Z])([A-Z]{2}),\s*(\d{4})$/, (_, a: string, b: string, y: string) => `${a}${b.toLowerCase()} ${y}`);
  return { main: `${m[1]} × ${m[2]}`, detail: [m[3] ?? 'All states', period].filter(Boolean).join(' · ') };
}

const COLUMN_HEADLINE: Record<string, string> = { 'Month Wise': 'Peak month', 'Calendar Year': 'Top year', 'Financial Year': 'Top year' };

function Stats({ report }: { report: ReportResult }) {
  const total = totalIndex(report);
  const rowTotal = (r: ReportRow) => (total >= 0 ? (r.values[total] ?? 0) : r.values.reduce<number>((a, v) => a + (v ?? 0), 0));
  const grand = report.rows.reduce((a, r) => a + rowTotal(r), 0);
  const topRow = report.rows.reduce<ReportRow | null>((best, r) => (!best || rowTotal(r) > rowTotal(best) ? r : best), null);
  const sums = columnSums(report.rows, report.columns.length);
  let topCol = -1;
  sums.forEach((s, i) => {
    if (i !== total && (topCol < 0 || s > sums[topCol])) topCol = i;
  });
  const group = report.headerRows[0]?.[0]?.label ?? 'column';

  const stats = [
    { label: 'Total registrations', value: formatCompact(grand), note: formatInteger(grand) },
    { label: `Top ${report.rowHeader.replace(/\bRto\b/, 'RTO')}`, value: topRow?.label ?? '–', note: topRow ? formatPercent(rowTotal(topRow), grand) : '' },
    { label: COLUMN_HEADLINE[group] ?? `Top ${group}`, value: topCol >= 0 ? report.columns[topCol] : '–', note: topCol >= 0 ? formatPercent(sums[topCol], grand) : '' },
  ];
  return (
    <div className="grid shrink-0 grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 bg-background px-4 py-2.5">
          <p className="truncate text-xs text-muted-foreground">{s.label}</p>
          <p className="mt-0.5 flex items-baseline gap-2 truncate" title={s.value}>
            <span className="truncate text-[15px] font-semibold tracking-tight">{s.value}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular">{s.note}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function ViewMenu() {
  const { unit, hideEmpty, heatmap, setPrefs } = useFilters();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Settings2 />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Values in</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={unit} onValueChange={(v) => setPrefs({ unit: v as Unit })}>
          {UNITS.map((u) => (
            <DropdownMenuRadioItem key={u.value} value={u.value}>
              {u.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={hideEmpty} onCheckedChange={(v) => setPrefs({ hideEmpty: v })}>
          Hide empty columns
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={heatmap} onCheckedChange={(v) => setPrefs({ heatmap: v })}>
          Heatmap
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Props {
  report: ReportResult;
  fetching: boolean;
  onToggleSidebar: () => void;
}

export function ReportView({ report, fetching, onToggleSidebar }: Props) {
  const { draft, applied, apply, unit, hideEmpty, heatmap, pageSize, setPrefs } = useFilters();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>(() => {
    const total = totalIndex(report);
    return total >= 0 ? { column: total, dir: 'desc' } : null;
  });
  const [copied, setCopied] = useState(false);

  const columns = useMemo(() => visibleColumns(report, hideEmpty), [report, hideEmpty]);
  const safeSort = sort && sort.column !== 'label' && (sort.column < 0 || sort.column >= report.columns.length) ? null : sort;
  const rows = useMemo(() => filterAndSort(report.rows, query, safeSort), [report.rows, query, safeSort]);
  const { main, detail } = describeTitle(report.title);

  const refinements = report.checkGroups
    .filter((g) => report.appliedChecks[g.name]?.length)
    .map((g) => {
      const picked = new Set(report.appliedChecks[g.name]);
      return { name: g.name, label: g.label, values: g.options.filter((o) => picked.has(o.value)).map((o) => o.label) };
    });

  const exportCsv = () =>
    downloadCsv(
      `${tidyTitle(report.title).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'vahan-report'}.csv`,
      [report.rowHeader, ...columns.map((c) => report.columns[c])],
      rows.map((r) => [r.label, ...columns.map((c) => r.values[c])]),
    );

  const copyLink = async () => {
    if (!applied) return;
    await navigator.clipboard.writeText(shareUrl(applied));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const status = `Updated ${timeFormat.format(new Date(report.fetchedAt))}${report.cached ? ' (cached)' : ''}`;

  return (
    <>
      <TopBar onToggleSidebar={onToggleSidebar}>
        <h1 className="min-w-0 flex-1 truncate text-sm" title={tidyTitle(report.title)}>
          <span className="font-medium">{main}</span>
          {detail && <span className="text-muted-foreground"> · {detail}</span>}
        </h1>
        <div className="flex shrink-0 items-center">
          <Tooltip label={copied ? 'Copied' : 'Copy link'}>
            <Button variant="ghost" size="icon" aria-label="Copy link" onClick={copyLink}>
              {copied ? <Check /> : <Link2 />}
            </Button>
          </Tooltip>
          <Tooltip label="Export CSV">
            <Button variant="ghost" size="icon" aria-label="Export CSV" onClick={exportCsv} disabled={!rows.length}>
              <Download />
            </Button>
          </Tooltip>
          <Tooltip label="Open on VAHAN">
            <Button asChild variant="ghost" size="icon">
              <a href={SOURCE_URL} target="_blank" rel="noreferrer" aria-label="Open on VAHAN">
                <ExternalLink />
              </a>
            </Button>
          </Tooltip>
        </div>
      </TopBar>

      <div className={cn('flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4', fetching && 'pointer-events-none opacity-60 transition-opacity')}>
        <Stats report={report} />

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SearchInput className="w-full sm:w-60" value={query} onChange={setQuery} placeholder={`Search ${report.rowHeader.replace(/\bRto\b/, 'RTO').toLowerCase()}`} />
          {report.tableGroups.length > 0 && (
            <Combobox
              aria-label="Vehicle category group"
              className="w-auto max-w-60"
              options={report.tableGroups}
              value={report.tableGroup}
              searchable={false}
              onChange={(tableGroup) => tableGroup !== report.tableGroup && apply({ tableGroup })}
            />
          )}
          {refinements.map((r) => (
            <span key={r.name} className="inline-flex h-8 max-w-72 items-center gap-1.5 rounded-md border bg-muted/40 pr-1 pl-2.5 text-xs">
              <span className="shrink-0 text-muted-foreground">{r.label}</span>
              <span className="truncate font-medium" title={r.values.join(', ')}>
                {r.values.length > 1 ? `${r.values.length} selected` : r.values[0]}
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.label} filter`}
                onClick={() => apply({ checks: { ...draft?.checks, [r.name]: [] } })}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <ViewMenu />
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
            status={status}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-sm font-medium">No registrations for these filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a wider period, another state, or fewer refinements.</p>
          </div>
        )}
      </div>
    </>
  );
}
