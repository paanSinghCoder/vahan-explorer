// Filter state: the draft being edited in the panel, and the applied filters the report
// shows. Applied filters and display preferences are saved, so the page reopens with them.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReportFilters } from '../shared/types';
import type { Theme } from './theme';

export type Unit = 'A' | 'T' | 'L' | 'C';

interface Prefs {
  unit: Unit;
  hideEmpty: boolean;
  heatmap: boolean;
  pageSize: number;
  sidebarOpen: boolean;
  theme: Theme;
}

interface FilterState extends Prefs {
  draft: ReportFilters | null;
  applied: ReportFilters | null;
  /** Starts the session from the URL, else the saved filters, else the given defaults. */
  init: (defaults: ReportFilters, normalise: (f: ReportFilters) => ReportFilters) => void;
  setDraft: (patch: Partial<ReportFilters>) => void;
  replaceDraft: (filters: ReportFilters) => void;
  /** Applies the draft (plus an optional patch) and runs the report. */
  apply: (patch?: Partial<ReportFilters>) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
}

const URL_PARAM = 'f';

function encode(f: ReportFilters): string {
  const bytes = new TextEncoder().encode(JSON.stringify(f));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readFiltersFromUrl(): ReportFilters | null {
  const raw = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as ReportFilters;
  } catch {
    return null;
  }
}

export function shareUrl(f: ReportFilters): string {
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, encode(f));
  return url.toString();
}

export const useFilters = create<FilterState>()(
  persist(
    (set, get) => ({
      draft: null,
      applied: null,
      unit: 'A',
      hideEmpty: true,
      heatmap: false,
      pageSize: 50,
      sidebarOpen: true,
      theme: 'system',

      init: (defaults, normalise) => {
        const start = normalise({ ...defaults, ...(readFiltersFromUrl() ?? get().applied ?? {}) });
        set({ draft: start, applied: start });
      },
      setDraft: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : s)),
      replaceDraft: (draft) => set({ draft }),
      apply: (patch) => {
        const draft = get().draft;
        if (!draft) return;
        const next = { ...draft, ...patch };
        set({ draft: next, applied: next });
        window.history.replaceState(null, '', shareUrl(next));
      },
      setPrefs: (patch) => set(patch),
    }),
    {
      // index.html reads state.theme from this key before first paint.
      name: 'vahan-explorer',
      partialize: ({ applied, unit, hideEmpty, heatmap, pageSize, sidebarOpen, theme }) => ({ applied, unit, hideEmpty, heatmap, pageSize, sidebarOpen, theme }),
    },
  ),
);
