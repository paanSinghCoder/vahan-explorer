// Keeps the draft filters valid and applies them automatically, once per app.
import { useEffect } from 'react';
import type { Meta } from '../shared/types';
import { useStateDetail } from './api';
import { ALL, normalise, sameFilters } from './lib/filters';
import { useFilters } from './store';

/** Quiet period before a change runs the report, so quick successive clicks become one run. */
const APPLY_DELAY_MS = 500;

export function useFilterSync(meta: Meta | undefined) {
  const { draft, applied, replaceDraft, apply } = useFilters();
  const detailQuery = useStateDetail(draft?.state);
  const detail = draft && draft.state !== ALL ? detailQuery.data : undefined;

  // Replace choices that are no longer offered as dependent options load or change.
  useEffect(() => {
    if (!meta || !draft) return;
    const next = normalise(meta, detail, draft);
    if (!sameFilters(next, draft)) replaceDraft(next);
  }, [meta, detail, draft, replaceDraft]);

  // Apply once the draft has settled: valid, and the chosen state's options have loaded.
  useEffect(() => {
    if (!meta || !draft || sameFilters(draft, applied)) return;
    const stateReady = draft.state === ALL || !!detail || detailQuery.isError;
    if (!stateReady || !sameFilters(normalise(meta, detail, draft), draft)) return;
    const timer = setTimeout(() => apply(), APPLY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [meta, draft, applied, detail, detailQuery.isError, apply]);
}
