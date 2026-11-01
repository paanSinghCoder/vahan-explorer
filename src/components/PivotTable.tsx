import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ReportResult, ReportRow } from '../../shared/types';
import { formatInteger, formatValue } from '../lib/format';
import { columnSums, resolveHeader, totalIndex, type Sort } from '../lib/table';
import { cn } from '../lib/utils';
import type { Unit } from '../store';
import { Button } from './ui/button';
import { Combobox } from './ui/command';

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
  status: string;
}

const PAGE_SIZES = [25, 50, 100, 250].map((n) => ({ value: String(n), label: String(n) }));

function nextSort(current: Sort, column: number | 'label'): Sort {
  const first = column === 'label' ? 'asc' : 'desc';
  if (current?.column !== column) return { column, dir: first };
  if (current.dir === first) return { column, dir: first === 'asc' ? 'desc' : 'asc' };
  return null;
}

function SortIcon({ sort, column }: { sort: Sort; column: number | 'label' }) {
  if (sort?.column !== column) return <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-50" />;
  return sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

export function PivotTable({ report, columns, rows, sort, onSort, unit, heatmap, pageSize, onPageSize, status }: Props) {
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
    return { backgroundColor: `color-mix(in oklab, var(--data) ${Math.round(5 + (value / columnMax[column]) * 30)}%, transparent)` };
  };

  const headerRow = (level: number) => {
    const cells = [];
    for (let k = 0; k < columns.length; k++) {
      const slot = grid[level][columns[k]];
      if (!slot?.start) continue;
      let span = 1;
      while (k + span < columns.length && grid[level][columns[k + span]]?.id === slot.id) span++;
      const column = columns[k];
      if (level + slot.rowSpan === depth) {
        cells.push(
          <th
            key={`${level}-${column}`}
            rowSpan={slot.rowSpan}
            aria-sort={sort?.column === column ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
            className={cn('border-b border-l p-0 align-bottom font-medium', column === total && 'bg-muted/40')}
          >
            <button
              type="button"
              onClick={() => onSort(nextSort(sort, column))}
              title={`Sort by ${slot.label}`}
              className="group flex w-full items-center justify-end gap-1 px-3 py-2 text-right text-xs leading-tight text-muted-foreground hover:text-foreground"
            >
              <SortIcon sort={sort} column={column} />
              <span className="max-w-32">{slot.label}</span>
            </button>
          </th>,
        );
      } else {
        cells.push(
          <th key={`${level}-${column}`} colSpan={span} rowSpan={slot.rowSpan} className="border-b border-l px-3 py-1.5 text-left text-xs font-medium whitespace-nowrap text-foreground/70">
            {slot.label}
          </th>,
        );
      }
      k += span - 1;
    }
    return cells;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="scroll-thin relative min-h-0 flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-background">
            {grid.map((_, level) => (
              <tr key={level}>
                {level === 0 && (
                  <th rowSpan={depth} className="sticky left-0 z-30 border-r border-b bg-background p-0 text-left align-bottom sm:min-w-64">
                    <button
                      type="button"
                      onClick={() => onSort(nextSort(sort, 'label'))}
                      className="group flex w-full items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {report.rowHeader.replace(/\bRto\b/, 'RTO')}
                      <SortIcon sort={sort} column="label" />
                    </button>
                  </th>
                )}
                {headerRow(level)}
              </tr>
            ))}
          </thead>

          <tbody>
            {pageRows.map((row, i) => (
              <tr key={`${current * pageSize + i}-${row.label}`} className="group/row">
                <td className="sticky left-0 z-10 border-r border-b bg-background px-3 py-1.5 group-hover/row:bg-muted">
                  <div className="flex max-w-40 items-center gap-2.5 sm:max-w-[22rem]">
                    <span className="w-6 shrink-0 text-right text-xs text-muted-foreground/70 tabular">{current * pageSize + i + 1}</span>
                    <span className="truncate" title={row.label}>
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
                        'border-b border-l px-3 py-1.5 text-right whitespace-nowrap tabular group-hover/row:bg-muted',
                        isTotal ? 'bg-muted/40 font-medium' : !value && 'text-muted-foreground/60',
                      )}
                    >
                      {isTotal && columnMax[c] > 0 ? (
                        <span className="flex items-center justify-end gap-2.5">
                          <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-border sm:block" aria-hidden>
                            <span className="block h-full rounded-full bg-data" style={{ width: `${((value ?? 0) / columnMax[c]) * 100}%` }} />
                          </span>
                          {formatValue(value, unit)}
                        </span>
                      ) : (
                        formatValue(value, unit)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td className="sticky left-0 z-30 border-t border-r bg-muted px-3 py-2 text-xs font-medium">
                  Total{rows.length !== report.rows.length && <span className="font-normal text-muted-foreground"> (matching rows)</span>}
                </td>
                {columns.map((c) => (
                  <td key={c} className="border-t border-l bg-muted px-3 py-2 text-right font-medium whitespace-nowrap tabular">
                    {formatValue(sums[c], unit)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="px-6 py-16 text-center text-sm text-muted-foreground">No rows match your search.</p>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="tabular">
          {rows.length === report.rows.length ? `${formatInteger(rows.length)} rows` : `${formatInteger(rows.length)} of ${formatInteger(report.rows.length)} rows`}
          <span className="hidden sm:inline"> · {status}</span>
        </span>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden items-center gap-2 sm:flex">
            <span>Rows per page</span>
            <Combobox aria-label="Rows per page" className="w-16" options={PAGE_SIZES} value={String(pageSize)} searchable={false} onChange={(v) => onPageSize(Number(v))} />
          </div>
          <span className="tabular">
            Page {current + 1} of {pages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="hidden size-7 sm:inline-flex" aria-label="First page" disabled={current === 0} onClick={() => setPage(0)}>
              <ChevronsLeft />
            </Button>
            <Button variant="outline" size="icon" className="size-7" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" className="size-7" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight />
            </Button>
            <Button variant="outline" size="icon" className="hidden size-7 sm:inline-flex" aria-label="Last page" disabled={current >= pages - 1} onClick={() => setPage(pages - 1)}>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
