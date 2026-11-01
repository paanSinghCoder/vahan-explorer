// Types shared by the API server and the React client.

export interface Option {
  value: string;
  label: string;
}

/** A side-panel refinement (Vehicle Category, Norms, Fuel, Vehicle Class). */
export interface CheckGroup {
  /** Form field name on the Vahan page: VhCatg | norms | fuel | VhClass. */
  name: string;
  label: string;
  options: Option[];
}

export interface ReportFilters {
  state: string;
  rto: string;
  yAxis: string;
  xAxis: string;
  yearType: string;
  year: string;
  /** Used instead of yearType/year when the X axis is Financial Year or Calendar Year. */
  years: string[];
  /** Vehicle Category Group shown by the table; '' keeps the page default. */
  tableGroup: string;
  checks: Record<string, string[]>;
}

export interface Meta {
  defaults: ReportFilters;
  states: Option[];
  /** Y-axis choices when all states are selected (includes "State"). */
  yAxis: Option[];
  xAxisByY: Record<string, Option[]>;
  yearTypes: Option[];
  /** Year choices per year type; Calendar Year includes "A" (Till Today). */
  years: Record<string, Option[]>;
  /** Year choices per year type when the X axis is Month Wise (plain years, no Till Today). */
  monthWiseYears: Record<string, Option[]>;
  /** Multi-select year choices per X axis (Financial Year / Calendar Year). */
  multiYears: Record<string, Option[]>;
  checkGroups: CheckGroup[];
  fetchedAt: string;
}

export interface StateDetail {
  rtos: Option[];
  /** Y-axis choices for a single state (includes "Rto"). */
  yAxis: Option[];
  xAxisByY: Record<string, Option[]>;
}

export interface HeaderCell {
  label: string;
  colSpan: number;
  rowSpan: number;
}

export interface ReportRow {
  label: string;
  values: (number | null)[];
}

export interface ReportResult {
  title: string;
  /** Label of the row dimension, e.g. "Maker". */
  rowHeader: string;
  /** Header rows above the value columns, as the Vahan table draws them. */
  headerRows: HeaderCell[][];
  /** Leaf value-column labels, in order (the last one is usually TOTAL). */
  columns: string[];
  rows: ReportRow[];
  tableGroups: Option[];
  tableGroup: string;
  checkGroups: CheckGroup[];
  appliedChecks: Record<string, string[]>;
  fetchedAt: string;
  tookMs: number;
  cached: boolean;
}

export interface ApiError {
  error: string;
}
