// Small, targeted parsers for the markup PrimeFaces renders on the Vahan report page.
import type { CheckGroup, HeaderCell, Option } from '../../shared/types.js';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function text(html: string): string {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface SelectInfo {
  options: Option[];
  selected: string;
}

/** Reads a <select id="..."> (PrimeFaces keeps one hidden behind each SelectOneMenu). */
export function readSelect(html: string, id: string): SelectInfo | null {
  const m = html.match(new RegExp(`<select id="${escapeRe(id)}"[^>]*>([\\s\\S]*?)</select>`));
  if (!m) return null;
  const options: Option[] = [];
  let selected = '';
  for (const o of m[1].matchAll(/<option([^>]*)value="([^"]*)"([^>]*)>([\s\S]*?)<\/option>/g)) {
    const value = decodeEntities(o[2]);
    options.push({ value, label: text(o[4]) });
    if (/selected/.test(o[1] + o[3])) selected = value;
  }
  return { options, selected: selected || options[0]?.value || '' };
}

/** Every <select> in a fragment, keyed by its id (which is also its form field name). */
export function readAllSelects(html: string): Map<string, SelectInfo> {
  const out = new Map<string, SelectInfo>();
  for (const m of html.matchAll(/<select id="([^"]+)"/g)) {
    const info = readSelect(html, m[1]);
    if (info) out.set(m[1], info);
  }
  return out;
}

const GROUP_LABELS: Record<string, string> = {
  VhCatg: 'Vehicle Category',
  norms: 'Norms',
  fuel: 'Fuel',
  VhClass: 'Vehicle Class',
};
export const CHECK_GROUP_NAMES = Object.keys(GROUP_LABELS);

/** Checkbox options rendered for a SelectManyCheckbox / SelectCheckboxMenu named `name`. */
export function readCheckboxes(html: string, name: string): { options: Option[]; checked: string[] } {
  const options: Option[] = [];
  const checked: string[] = [];
  const re = new RegExp(`<input([^>]*)id="(${escapeRe(name)}:\\d+)"([^>]*)>`, 'g');
  for (const m of html.matchAll(re)) {
    const attrs = m[1] + m[3];
    if (!/type="checkbox"/.test(attrs) || !new RegExp(`name="${escapeRe(name)}"`).test(attrs)) continue;
    const value = decodeEntities((attrs.match(/value="([^"]*)"/) || [])[1] ?? '');
    const label = html.match(new RegExp(`<label for="${escapeRe(m[2])}"[^>]*>([\\s\\S]*?)</label>`));
    options.push({ value, label: label ? text(label[1]) : value });
    if (/checked/.test(attrs)) checked.push(value);
  }
  return { options, checked };
}

export function readCheckGroups(html: string): CheckGroup[] {
  return CHECK_GROUP_NAMES.map((name) => ({ name, label: GROUP_LABELS[name], options: readCheckboxes(html, name).options })).filter(
    (g) => g.options.length > 0,
  );
}

export interface ParsedTable {
  id: string;
  title: string;
  rowHeader: string;
  headerRows: HeaderCell[][];
  columns: string[];
  rowCount: number;
}

/** Parses the report data table (groupingTable or vchgroupTable) out of a fragment. */
export function readTable(html: string): ParsedTable | null {
  const id = ['vchgroupTable', 'groupingTable'].find((t) => html.includes(`id="${t}"`));
  if (!id) return null;
  const start = html.indexOf(`id="${id}"`);
  const fragment = html.slice(start);

  const header = fragment.match(/class="ui-datatable-header[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const title = header ? text(header[1].replace(/<select[\s\S]*?<\/select>/g, '').replace(/<ul[\s\S]*?<\/ul>/g, '')) : '';

  const thead = fragment.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  const rawRows: HeaderCell[][] = [];
  for (const tr of (thead?.[1] ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells: HeaderCell[] = [];
    for (const th of tr[1].matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/g)) {
      cells.push({
        label: text(th[2].replace(/<select[\s\S]*?<\/select>/g, '')),
        colSpan: Number((th[1].match(/colspan="(\d+)"/) || [])[1] ?? 1),
        rowSpan: Number((th[1].match(/rowspan="(\d+)"/) || [])[1] ?? 1),
      });
    }
    if (cells.length) rawRows.push(cells);
  }
  if (!rawRows.length) return null;

  // The first two header cells (S No, row dimension) span every header row; the rest describe value columns.
  const rowHeader = rawRows[0][1]?.label ?? '';
  const headerRows = [rawRows[0].slice(2), ...rawRows.slice(1)];
  const columns = leafColumns(headerRows);
  const rowCount = Number((fragment.match(/rowCount:(\d+)/) || [])[1] ?? (fragment.match(/<tr data-ri=/g) || []).length);
  return { id, title, rowHeader, headerRows, columns, rowCount };
}

/** Resolves rowspan/colspan header rows into the ordered list of leaf column labels. */
function leafColumns(rows: HeaderCell[][]): string[] {
  const depth = rows.length;
  const grid: (string | null)[][] = Array.from({ length: depth }, () => []);
  rows.forEach((cells, r) => {
    let c = 0;
    for (const cell of cells) {
      while (grid[r][c] !== undefined) c++;
      for (let dr = 0; dr < cell.rowSpan && r + dr < depth; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) grid[r + dr][c + dc] = dr === cell.rowSpan - 1 ? cell.label : null;
      }
      c += cell.colSpan;
    }
  });
  const width = Math.max(...grid.map((g) => g.length));
  const leaves: string[] = [];
  for (let c = 0; c < width; c++) {
    for (let r = depth - 1; r >= 0; r--) {
      if (grid[r][c]) {
        leaves.push(grid[r][c] as string);
        break;
      }
    }
  }
  return leaves;
}

/** Messages the page shows in its error area (e.g. JSF validation failures). */
export function readErrors(html: string): string[] {
  return [...html.matchAll(/ui-messages-error-(?:summary|detail)[^>]*>([^<]*)/g)].map((m) => decodeEntities(m[1]).trim()).filter(Boolean);
}
