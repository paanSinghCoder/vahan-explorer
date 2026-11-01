// Which choices each filter offers, given the others — mirroring how the Vahan page
// re-renders its dropdowns (state -> RTO -> Y axis -> X axis -> year).
import type { Meta, Option, ReportFilters, StateDetail } from '../../shared/types';

export const ALL = '-1';
export const VCG = 'VCG';
const MONTH_WISE = 'Month Wise';
const MULTI_YEAR_AXES = ['Financial Year', 'Calendar Year'];

export const isMultiYear = (xAxis: string) => MULTI_YEAR_AXES.includes(xAxis);

export function yAxisOptions(meta: Meta, detail: StateDetail | undefined, f: ReportFilters): Option[] {
  const base = meta.yAxis.filter((o) => o.value !== 'State');
  if (f.state === ALL) return meta.yAxis;
  if (f.rto !== ALL) return base;
  return detail?.yAxis ?? base;
}

export function xAxisOptions(meta: Meta, detail: StateDetail | undefined, f: ReportFilters): Option[] {
  return detail?.xAxisByY[f.yAxis] ?? meta.xAxisByY[f.yAxis] ?? [];
}

export function yearOptions(meta: Meta, f: ReportFilters): Option[] {
  return (f.xAxis === MONTH_WISE ? meta.monthWiseYears : meta.years)[f.yearType] ?? [];
}

export function multiYearOptions(meta: Meta, f: ReportFilters): Option[] {
  return meta.multiYears[f.xAxis] ?? [];
}

function pick(options: Option[], value: string, ...fallbacks: string[]): string {
  const has = (v: string) => options.some((o) => o.value === v);
  if (has(value)) return value;
  return fallbacks.find(has) ?? options[0]?.value ?? '';
}

/** Replaces any choice that is no longer offered, so the filters are always valid. */
export function normalise(meta: Meta, detail: StateDetail | undefined, f: ReportFilters): ReportFilters {
  // State-specific choices (RTO, "Rto" axis) can't be checked until the state's details load.
  if (f.state !== ALL && !detail) return f;

  const next: ReportFilters = { ...f, checks: { ...f.checks } };
  if (next.state === ALL || !detail?.rtos.some((o) => o.value === next.rto)) next.rto = ALL;
  next.yAxis = pick(yAxisOptions(meta, detail, next), next.yAxis, meta.defaults.yAxis);
  next.xAxis = pick(xAxisOptions(meta, detail, next), next.xAxis, meta.defaults.xAxis);

  if (isMultiYear(next.xAxis)) {
    const offered = multiYearOptions(meta, next).map((o) => o.value);
    next.years = next.years.filter((y) => offered.includes(y));
    if (!next.years.length) next.years = offered.slice(0, 3);
    next.yearType = '';
    next.year = '';
  } else {
    next.years = [];
    next.yearType = pick(meta.yearTypes, next.yearType, meta.defaults.yearType);
    next.year = pick(yearOptions(meta, next), next.year, meta.defaults.year);
  }
  if (next.xAxis !== VCG) next.tableGroup = '';
  return next;
}

export const sameFilters = (a: ReportFilters | null, b: ReportFilters | null) => JSON.stringify(a) === JSON.stringify(b);

// ---- display labels for the page's raw option text ----

export function stateLabel(o: Option): string {
  if (o.value === ALL) return 'All states';
  return o.label.replace(/\s*\((\d+)\)\s*$/, ' · $1 RTOs');
}

export function rtoLabel(o: Option): string {
  if (o.value === ALL) return 'All RTOs';
  const m = o.label.match(/^(.*?)\s*-\s*([A-Z]{2}\d+)\s*\(/);
  return m ? `${m[2]} · ${m[1]}` : o.label;
}

export function axisLabel(o: Option): string {
  if (o.value === 'Rto') return 'RTO';
  if (o.value === VCG) return 'Vehicle Category Group';
  return o.label;
}

export const yearLabel = (o: Option) => (o.value === 'A' ? 'Till today' : o.label);
