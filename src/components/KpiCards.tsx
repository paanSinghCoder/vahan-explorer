import type { ReportResult, ReportRow } from '../../shared/types';
import { formatCompact, formatInteger, formatPercent } from '../lib/format';
import { columnSums, totalIndex } from '../lib/table';

const COLUMN_HEADLINE: Record<string, string> = {
  'Month Wise': 'Peak month',
  'Calendar Year': 'Top year',
  'Financial Year': 'Top year',
};

function Card({ label, value, sub, title }: { label: string; value: string; sub: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-xs">
      <p className="truncate text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-ink tabular" title={title ?? value}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted tabular">{sub}</p>
    </div>
  );
}

export function KpiCards({ report }: { report: ReportResult }) {
  const total = totalIndex(report);
  const rowTotal = (r: ReportRow) => (total >= 0 ? (r.values[total] ?? 0) : r.values.reduce<number>((a, v) => a + (v ?? 0), 0));
  const grand = report.rows.reduce((a, r) => a + rowTotal(r), 0);
  const topRow = report.rows.reduce<ReportRow | null>((best, r) => (!best || rowTotal(r) > rowTotal(best) ? r : best), null);

  const sums = columnSums(report.rows, report.columns.length);
  let topCol = -1;
  sums.forEach((s, i) => {
    if (i !== total && (topCol < 0 || s > sums[topCol])) topCol = i;
  });
  const columnGroup = report.headerRows[0]?.[0]?.label ?? 'column';

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Card label="Total registrations" value={formatCompact(grand)} sub={formatInteger(grand)} />
      <Card label="Rows" value={formatInteger(report.rows.length)} sub={`by ${report.rowHeader}`} />
      <Card
        label={`Top ${report.rowHeader}`}
        value={topRow?.label ?? '–'}
        sub={topRow ? `${formatCompact(rowTotal(topRow))} · ${formatPercent(rowTotal(topRow), grand)} of total` : '–'}
      />
      <Card
        label={COLUMN_HEADLINE[columnGroup] ?? `Top ${columnGroup}`}
        value={topCol >= 0 ? report.columns[topCol] : '–'}
        sub={topCol >= 0 ? `${formatCompact(sums[topCol])} · ${formatPercent(sums[topCol], grand)} of total` : '–'}
      />
    </div>
  );
}
