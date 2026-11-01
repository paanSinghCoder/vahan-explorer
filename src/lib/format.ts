import type { Unit } from '../store';

export const UNITS: { value: Unit; label: string; divisor: number }[] = [
  { value: 'A', label: 'Actual', divisor: 1 },
  { value: 'T', label: 'Thousand', divisor: 1e3 },
  { value: 'L', label: 'Lakh', divisor: 1e5 },
  { value: 'C', label: 'Crore', divisor: 1e7 },
];

const integer = new Intl.NumberFormat('en-IN');
const decimal = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export function scale(value: number, unit: Unit): number {
  return value / (UNITS.find((u) => u.value === unit)?.divisor ?? 1);
}

/** A table cell value in the chosen unit (Indian digit grouping). */
export function formatValue(value: number | null, unit: Unit): string {
  if (value === null) return '–';
  return unit === 'A' ? integer.format(value) : decimal.format(scale(value, unit));
}

export const formatInteger = (value: number) => integer.format(value);

/** Short form for headline numbers: 2.04 Cr, 41.1 L, 12.3K. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${oneDecimal.format(value / 1e7)} Cr`;
  if (abs >= 1e5) return `${oneDecimal.format(value / 1e5)} L`;
  if (abs >= 1e3) return `${oneDecimal.format(value / 1e3)}K`;
  return integer.format(value);
}

export const formatPercent = (part: number, whole: number) => (whole > 0 ? `${oneDecimal.format((part / whole) * 100)}%` : '–');

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const tidyTitle = (title: string) => title.replace(/\s+,/g, ',').replace(/\s+/g, ' ').replace(/\(\s*\)/, '').trim();
