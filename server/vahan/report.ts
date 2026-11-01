// High-level operations built on JsfSession: filter metadata, per-state options and reports.
import type { CheckGroup, Meta, Option, ReportFilters, ReportResult, ReportRow, StateDetail } from '../../shared/types.ts';
import { readCheckboxes, readCheckGroups, readSelect, readTable, type ParsedTable } from './html.ts';
import { JsfSession, UpstreamError, ValidationError, type PartialResponse } from './session.ts';
import { readFirstSheet } from './xlsx.ts';

const MAIN_RENDER = 'VhCatg norms fuel VhClass combTablePnl groupingTable msg vhCatgPnl';
const TABLE_GROUP = 'vchgroupTable:selectCatgGrp';
export const MULTI_YEAR_AXES = ['Financial Year', 'Calendar Year'];
const MONTH_WISE = 'Month Wise';

const withoutBlank = (options: Option[]) => options.filter((o) => o.value !== '');

function selectFrom(res: PartialResponse | string, id: string) {
  const html = typeof res === 'string' ? res : [...res.updates.values()].join('\n');
  return readSelect(html, id);
}

export async function fetchMeta(): Promise<Meta> {
  const s = await JsfSession.open();
  const initial = s.html;
  const state = readSelect(initial, `${s.ids.state}_input`)!;
  const yAxis = readSelect(initial, 'yaxisVar_input')!;
  const xAxis = readSelect(initial, 'xaxisVar_input')!;
  const yearType = readSelect(initial, 'selectedYearType_input')!;
  const year = readSelect(initial, 'selectedYear_input')!;

  const defaults: ReportFilters = {
    state: state.selected,
    rto: '-1',
    yAxis: yAxis.selected,
    xAxis: xAxis.selected,
    yearType: yearType.selected,
    year: year.selected,
    years: [],
    tableGroup: '',
    checks: {},
  };

  const years: Record<string, Option[]> = { [yearType.selected]: withoutBlank(year.options) };
  for (const t of withoutBlank(yearType.options)) {
    if (years[t.value]) continue;
    s.set('selectedYearType_input', t.value);
    years[t.value] = withoutBlank(selectFrom(await s.change('selectedYearType', 'selectedYear'), 'selectedYear_input')?.options ?? []);
  }

  // Financial/Calendar Year as X axis swaps the year dropdowns for a multi-year list.
  const multiYears: Record<string, Option[]> = {};
  for (const x of MULTI_YEAR_AXES) {
    s.set('xaxisVar_input', x);
    const res = await s.change('xaxisVar', 'multipleYear');
    multiYears[x] = readCheckboxes(res.updates.get('multipleYear') ?? '', 'yearList').options;
  }

  // Month Wise offers plain years for both year types.
  const monthWiseYears: Record<string, Option[]> = {};
  s.set('xaxisVar_input', MONTH_WISE);
  await s.change('xaxisVar', 'multipleYear');
  for (const t of withoutBlank(yearType.options)) {
    s.set('selectedYearType_input', t.value);
    monthWiseYears[t.value] = withoutBlank(selectFrom(await s.change('selectedYearType', 'selectedYear'), 'selectedYear_input')?.options ?? []);
  }

  const xAxisByY: Record<string, Option[]> = {};
  for (const y of yAxis.options) {
    s.set('yaxisVar_input', y.value);
    xAxisByY[y.value] = selectFrom(await s.change('yaxisVar', 'xaxisVar'), 'xaxisVar_input')?.options ?? [];
  }

  return {
    defaults,
    states: state.options,
    yAxis: yAxis.options,
    xAxisByY,
    yearTypes: withoutBlank(yearType.options),
    years,
    monthWiseYears,
    multiYears,
    checkGroups: readCheckGroups(initial),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchStateDetail(stateCode: string): Promise<StateDetail> {
  const s = await JsfSession.open();
  const states = readSelect(s.html, `${s.ids.state}_input`)!;
  if (!states.options.some((o) => o.value === stateCode)) throw new ValidationError(`Unknown state ${stateCode}`);
  s.set(`${s.ids.state}_input`, stateCode);
  const res = await s.change(s.ids.state, 'selectedRto yaxisVar');
  const rtos = selectFrom(res, 'selectedRto_input')?.options ?? [];
  const yAxis = selectFrom(res, 'yaxisVar_input')?.options ?? [];

  // Only the state-specific Y axis ("Rto") needs its own X list; the others match the all-state lists.
  const xAxisByY: Record<string, Option[]> = {};
  for (const y of yAxis.filter((o) => o.value === 'Rto')) {
    s.set('yaxisVar_input', y.value);
    xAxisByY[y.value] = selectFrom(await s.change('yaxisVar', 'xaxisVar'), 'xaxisVar_input')?.options ?? [];
  }
  return { rtos, yAxis, xAxisByY };
}

/** Sets a dropdown and fires its change request, after checking the value is currently offered. */
async function choose(s: JsfSession, componentId: string, value: string, render: string, label: string, html: string) {
  const field = `${componentId}_input`;
  if (s.get(field) === value) return;
  const select = readSelect(html, field);
  if (select && !select.options.some((o) => o.value === value)) throw new ValidationError(`${label} "${value}" is not available for these filters`);
  s.set(field, value);
  return s.change(componentId, render);
}

const merged = (res: PartialResponse | undefined, previous: string) => (res ? [...res.updates.values()].join('\n') + previous : previous);

export async function fetchReport(f: ReportFilters): Promise<Omit<ReportResult, 'cached' | 'tookMs'>> {
  const s = await JsfSession.open();
  let html = s.html;

  // Same order the page enforces: each choice re-renders the options of the next.
  html = merged(await choose(s, s.ids.state, f.state, 'selectedRto yaxisVar', 'State', html), html);
  html = merged(await choose(s, 'selectedRto', f.rto, 'yaxisVar', 'RTO', html), html);
  html = merged(await choose(s, 'yaxisVar', f.yAxis, 'xaxisVar', 'Y-axis', html), html);
  html = merged(await choose(s, 'xaxisVar', f.xAxis, 'multipleYear', 'X-axis', html), html);

  if (MULTI_YEAR_AXES.includes(f.xAxis)) {
    const offered = new Set(readCheckboxes(html, 'yearList').options.map((o) => o.value));
    const years = f.years.filter((y) => offered.has(y));
    if (!years.length) throw new ValidationError('Pick at least one year');
    s.set('yearList', years);
  } else {
    html = merged(await choose(s, 'selectedYearType', f.yearType, 'selectedYear', 'Year type', html), html);
    html = merged(await choose(s, 'selectedYear', f.year, 'selectedYear', 'Year', html), html);
  }

  let fragment = [...(await s.press(s.ids.refresh, MAIN_RENDER)).updates.values()].join('\n');
  let table = readTable(fragment);
  if (!table) throw new UpstreamError('Vahan returned no table for these filters');

  let tableGroups: Option[] = [];
  if (table.id === 'vchgroupTable') {
    tableGroups = readSelect(fragment, `${TABLE_GROUP}_input`)?.options ?? [];
    if (f.tableGroup && f.tableGroup !== s.get(`${TABLE_GROUP}_input`)) {
      const res = await choose(s, TABLE_GROUP, f.tableGroup, 'vchgroupTable VhCatg norms fuel VhClass', 'Vehicle group', fragment);
      // The response re-renders the table and every checkbox group, so it replaces the old fragment.
      if (res) fragment = [...res.updates.values()].join('\n');
      table = readTable(fragment) ?? table;
    }
  }

  // Refinements: keep only values the page currently offers, then use the side-panel refresh.
  const checkGroups: CheckGroup[] = readCheckGroups(fragment);
  const appliedChecks: Record<string, string[]> = {};
  for (const g of checkGroups) {
    const offered = new Set(g.options.map((o) => o.value));
    const picked = (f.checks[g.name] ?? []).filter((v) => offered.has(v));
    if (picked.length) appliedChecks[g.name] = picked;
  }
  if (Object.keys(appliedChecks).length) {
    for (const g of checkGroups) s.set(g.name, appliedChecks[g.name] ?? []);
    const res = await s.press(s.ids.sideRefresh, 'combTablePnl');
    table = readTable([...res.updates.values()].join('\n')) ?? table;
  }

  const rows = table.rowCount > 0 ? rowsFromExport(readFirstSheet(await s.exportXlsx(table.id)), table) : [];

  return {
    title: table.title,
    rowHeader: table.rowHeader,
    headerRows: table.headerRows,
    columns: table.columns,
    rows,
    tableGroups,
    tableGroup: String(s.get(`${TABLE_GROUP}_input`) ?? ''),
    checkGroups,
    appliedChecks,
    fetchedAt: new Date().toISOString(),
  };
}

const toNumber = (v: string) => {
  const n = Number(v.replace(/,/g, ''));
  return v === '' || Number.isNaN(n) ? null : n;
};

/** Data rows in the export look like: [S No, row label, ...one value per leaf column]. */
function rowsFromExport(sheet: string[][], table: ParsedTable): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const cells of sheet) {
    if (!/^\d+$/.test(cells[0] ?? '') || !cells[1]) continue;
    rows.push({ label: cells[1], values: table.columns.map((_, i) => toNumber(cells[2 + i] ?? '')) });
  }
  return rows;
}
