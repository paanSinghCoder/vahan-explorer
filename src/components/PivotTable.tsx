import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ReportResult, ReportRow } from '../../shared/types';
import { formatInteger, formatValue } from '../lib/format';
import { columnSums, resolveHeader, totalIndex, type Sort } from '../lib/table';
import type { Unit } from '../store';
import { cn } from './ui';

interface Props {
  report: ReportResult;
  /** Indexes of the value columns to show. */
  columns: number[];
  /** Rows after search and sort. */
  rows: ReportRow[];
  sort: Sort;
  onSort: (sort: Sort) => void;
  unit: Unit;
  heatmap: boolean;
  pageSize: number;
  onPageSize: (size: number) => void;
}

const PAGE_SIZES = [25, 50, 100, 250];

function nextSort(current: Sort, column: number | 'label'): Sort {
  if (current?.column !== column) return { column, dir: column === 'label' ? 'asc' : 'desc' };
  if (current.dir === (column === 'label' ? 'asc' : 'desc')) return { column, dir: column === 'label' ? 'desc' : 'asc' };
  return null;
}

function SortIcon({ sort, column }: { sort: Sort; column: number | 'label' }) {
  if (sort?.column !== column) return <ArrowUpDown className="size-3 opacity-0 transition group-hover:opacity-60" />;
  return sort.dir === 'asc' ? <ArrowUp className="size-3 text-accent" /> : <ArrowDown className="size-3 text-accent" />;
}

export function PivotTable({ report, columns, rows, sort, onSort, unit, heatmap, pageSize, onPageSize }: Props) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows, pageSize]);

  const grid = useMemo(() => resolveHeader(report.headerRows), [report.headerRows]);
  const depth = grid.length;
  const total = totalIndex(report);
  const columnMax = useMemo(() => report.columns.map((_, i) => Math.max(0, ...report.rows.map((r) => r.values[i] ?? 0))), [report]);
  const sums = useMemo(() => columnSums(rows, report.columns.length), [rows, report.columns.length]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const pageRows = rows.slice(current * pageSize, (current + 1) * pageSize);

  const tint = (value: number | null, column: number): CSSProperties | undefined => {
    if (!heatmap || column === total || !value || !columnMax[column]) return undefined;
    const strength = Math.round(6 + (value / columnMax[column]) * 30);
    return { backgroundColor: `color-mix(in oklab, var(--accent) ${strength}%, transparent)` };
  };

  const headerRow = (level: number) => {
    const cells = [];
    for (let k = 0; k < columns.length; k++) {
      const slot = grid[level][columns[k]];
      if (!slot?.start) continue;
      let span = 1;
      while (k + span < columns.length && grid[level][columns[k + span]]?.id === slot.id) span++;
      const column = columns[k];
      const leaf = level + slot.rowSpan === depth;
      cells.push(
        leaf ? (
          <th
            key={`${level}-${column}`}
            rowSpan={slot.rowSpan}
            aria-sort={sort?.column === column ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
            className={cn('border-b border-l border-line px-0 align-bottom font-medium', column === total && 'bg-surface-2')}
          >
            <button
              type="button"
              onClick={() => onSort(nextSort(sort, column))}
              className="group flex w-full items-center justify-end gap-1 px-3 py-2 text-right text-[11px] leading-tight tracking-wide text-ink-2 uppercase hover:text-ink"
              title={`Sort by ${slot.label}`}
            >
              <SortIcon sort={sort} column={column} />
              <span className="max-w-36">{slot.label}</span>
            </button>
          </th>
        ) : (
          <th
            key={`${level}-${column}`}
            colSpan={span}
            rowSpan={slot.rowSpan}
            className="border-b border-l border-line px-3 py-1.5 text-left text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase"
          >
            {slot.label}
          </th>
        ),
      );
      k += span - 1;
    }
    return cells;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="scroll-thin relative max-h-[calc(100vh-15rem)] min-h-64 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-surface">
            {grid.map((_, level) => (
              <tr key={level}>
                {level === 0 && (
                  <th rowSpan={depth} className="sticky left-0 z-30 border-r border-b border-line bg-surface px-0 text-left align-bottom sm:min-w-64">
                    <button
                      type="button"
                      onClick={() => onSort(nextSort(sort, 'label'))}
                      className="group flex w-full items-center gap-1 px-4 py-2 text-[11px] font-semibold tracking-wider text-ink-2 uppercase hover:text-ink"
                    >
                      {report.rowHeader}
                      <SortIcon sort={sort} column="label" />
                    </button>
                  </th>
                )}
                {headerRow(level)}
              </tr>
            ))}
          </thead>

          <tbody>
            {pageRows.map((row, i) => {
              const rowTotal = total >= 0 ? (row.values[total] ?? 0) : 0;
              return (
                <tr key={`${current * pageSize + i}-${row.label}`} className="group/row">
                  <td className="sticky left-0 z-10 border-r border-b border-line bg-surface px-4 py-2 group-hover/row:bg-surface-2">
                    <div className="flex max-w-40 items-center gap-3 sm:max-w-[22rem]">
                      <span className="w-7 shrink-0 text-right text-xs text-faint tabular">{current * pageSize + i + 1}</span>
                      <span className="truncate text-[13px] text-ink" title={row.label}>
                        {row.label}
                      </span>
                    </div>
                  </td>
                  {columns.map((c) => {
                    const value = row.values[c];
                    const isTotal = c === total;
                    return (
                      <td
                        key={c}
                        style={tint(value, c)}
                        className={cn(
                          'border-b border-l border-line px-3 py-2 text-right whitespace-nowrap tabular group-hover/row:bg-surface-2',
                          isTotal ? 'bg-surface-2 font-semibold text-ink' : value ? 'text-ink-2' : 'text-faint',
                        )}
                      >
                        {isTotal && columnMax[c] > 0 ? (
                          <div className="flex items-center justify-end gap-2.5">
                            <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${(rowTotal / columnMax[c]) * 100}%` }} />
                            </span>
                            {formatValue(value, unit)}
                          </div>
                        ) : (
                          formatValue(value, unit)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td className="sticky left-0 z-30 border-t border-r border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold tracking-wider text-ink-2 uppercase">
                  Total{rows.length !== report.rows.length && <span className="ml-1 font-normal normal-case text-muted">(matching rows)</span>}
                </td>
                {columns.map((c) => (
                  <td key={c} className="border-t border-l border-line bg-surface-2 px-3 py-2.5 text-right font-semibold whitespace-nowrap text-ink tabular">
                    {formatValue(sums[c], unit)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>

        {rows.length === 0 && <p className="px-6 py-16 text-center text-sm text-muted">No rows match your search.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span className="tabular">
          {rows.length ? `${formatInteger(current * pageSize + 1)}–${formatInteger(Math.min(rows.length, (current + 1) * pageSize))} of ${formatInteger(rows.length)}` : '0 rows'}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink outline-none focus:border-accent"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              className="rounded-md p-1 hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-16 text-center tabular">
              {current + 1} / {pages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              className="rounded-md p-1 hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
