import { AlertTriangle, ExternalLink, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMeta, useReport } from './api';
import { FilterPanel } from './components/FilterPanel';
import { ReportView } from './components/ReportView';
import { Button, cn, Spinner } from './components/ui';
import { normalise } from './lib/filters';
import { useFilters } from './store';

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path d="M8 21V11m5.33 10V15m5.34 6v-9M24 21v-4" className="stroke-accent-ink" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-ink">Vahan Explorer</p>
        <p className="text-xs text-muted">Vehicle registration reports</p>
      </div>
    </div>
  );
}

function Notice({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-soft px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm break-words text-ink-2">{message}</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

function LoadingReport() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-line" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface text-sm text-muted">
        <Spinner className="size-5 text-accent" />
        Fetching the report from VAHAN — this usually takes a few seconds
      </div>
    </div>
  );
}

export default function App() {
  const meta = useMeta();
  const { draft, applied, init } = useFilters();
  const report = useReport(applied);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (meta.data && !draft) init(meta.data.defaults, (f) => normalise(meta.data, undefined, f));
  }, [meta.data, draft, init]);

  const panel = meta.data && (
    <FilterPanel
      meta={meta.data}
      checkGroups={report.data?.checkGroups ?? meta.data.checkGroups}
      running={report.isFetching}
      onApplied={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="min-h-screen">
      {report.isFetching && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent/15">
          <div className="animate-progress h-full w-1/3 bg-accent" />
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-4 px-4 lg:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <a
              href="https://vahan.parivahan.gov.in/vahan4dashboard/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 text-xs text-muted hover:text-ink sm:inline-flex"
            >
              Data: VAHAN dashboard, MoRTH
              <ExternalLink className="size-3" />
            </a>
            <Button className="lg:hidden" onClick={() => setDrawerOpen(true)} disabled={!meta.data}>
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1680px] gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-22 h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            {panel ?? (
              <div className="space-y-4 p-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-line/70" />
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {meta.isError ? (
            <Notice title="Couldn’t reach the VAHAN dashboard" message={meta.error.message} onRetry={() => meta.refetch()} />
          ) : report.isError ? (
            <Notice title="This report couldn’t be loaded" message={report.error.message} onRetry={() => report.refetch()} />
          ) : report.data ? (
            <ReportView key={report.data.columns.join('|')} report={report.data} fetching={report.isFetching && report.isPlaceholderData} />
          ) : (
            <LoadingReport />
          )}
          <p className="mt-8 text-center text-xs text-faint">
            Unofficial viewer. Figures come from the public VAHAN dashboard of the Ministry of Road Transport &amp; Highways.
          </p>
        </main>
      </div>

      {/* Filters as a drawer on small screens */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', drawerOpen ? 'visible' : 'invisible')} aria-hidden={!drawerOpen}>
        <div className={cn('absolute inset-0 bg-black/40 transition-opacity', drawerOpen ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawerOpen(false)} />
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex w-[min(22rem,90vw)] flex-col bg-surface shadow-xl transition-transform',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-line px-5">
            <p className="font-semibold">Filters</p>
            <button type="button" aria-label="Close filters" onClick={() => setDrawerOpen(false)} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">{drawerOpen && panel}</div>
        </div>
      </div>
    </div>
  );
}
