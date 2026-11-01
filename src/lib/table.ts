// Table helpers: header layout, hidden columns, search and sorting.
import type { HeaderCell, ReportResult, ReportRow } from '../../shared/types';

export interface HeaderSlot {
  id: number;
  label: string;
  rowSpan: number;
  /** True on the header row where the cell starts (false where a rowspan continues). */
  start: boolean;
}

/** Expands rowspan/colspan header rows into grid[level][leafColumn]. */
export function resolveHeader(rows: HeaderCell[][]): HeaderSlot[][] {
  const depth = rows.length;
  const grid: HeaderSlot[][] = rows.map(() => []);
  let id = 0;
  rows.forEach((cells, r) => {
    let c = 0;
    for (const cell of cells) {
      while (grid[r][c]) c++;
      const slotId = id++;
      const rowSpan = Math.min(cell.rowSpan, depth - r);
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          grid[r + dr][c + dc] = { id: slotId, label: cell.label, rowSpan, start: dr === 0 };
        }
      }
      c += cell.colSpan;
    }
  });
  return grid;
}

export const totalIndex = (report: ReportResult) => report.columns.lastIndexOf('TOTAL');

/** Indexes of the value columns to show; optionally drops columns that are empty in every row. */
export function visibleColumns(report: ReportResult, hideEmpty: boolean): number[] {
  const total = totalIndex(report);
  return report.columns
    .map((_, i) => i)
    .filter((i) => !hideEmpty || i === total || report.rows.some((r) => (r.values[i] ?? 0) !== 0));
}

export type Sort = { column: number | 'label'; dir: 'asc' | 'desc' } | null;

export function filterAndSort(rows: ReportRow[], query: string, sort: Sort): ReportRow[] {
  const q = query.trim().toLowerCase();
  const out = q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : [...rows];
  if (!sort) return out;
  const dir = sort.dir === 'asc' ? 1 : -1;
  if (sort.column === 'label') return out.sort((a, b) => a.label.localeCompare(b.label) * dir);
  const c = sort.column;
  return out.sort((a, b) => ((a.values[c] ?? 0) - (b.values[c] ?? 0)) * dir);
}

export function columnSums(rows: ReportRow[], width: number): number[] {
  const sums = new Array<number>(width).fill(0);
  for (const r of rows) r.values.forEach((v, i) => (sums[i] += v ?? 0));
  return sums;
}
