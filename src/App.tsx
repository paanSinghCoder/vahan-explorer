import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useMeta, useReport } from './api';
import { FilterSidebar } from './components/FilterSidebar';
import { ReportView } from './components/ReportView';
import { TopBar } from './components/TopBar';
import { Button } from './components/ui/button';
import { Spinner } from './components/ui/controls';
import { Sheet, TooltipProvider } from './components/ui/overlays';
import { normalise } from './lib/filters';
import { cn } from './lib/utils';
import { useFilters } from './store';
import { useFilterSync } from './useFilterSync';

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="m-4 flex items-start gap-3 rounded-lg border border-destructive/40 px-4 py-3 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-destructive">{title}</p>
        <p className="mt-0.5 break-words text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw />
        Retry
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="h-[58px] animate-pulse rounded-lg bg-muted" />
      <div className="h-8 w-60 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
        <Spinner />
        Fetching the report from VAHAN…
      </div>
    </div>
  );
}

export default function App() {
  const meta = useMeta();
  const { draft, applied, init, sidebarOpen, setPrefs } = useFilters();
  const report = useReport(applied);
  const [sheetOpen, setSheetOpen] = useState(false);
  useFilterSync(meta.data);

  useEffect(() => {
    if (meta.data && !draft) init(meta.data.defaults, (f) => normalise(meta.data, undefined, f));
  }, [meta.data, draft, init]);

  const toggleSidebar = useCallback(() => {
    if (isDesktop()) setPrefs({ sidebarOpen: !useFilters.getState().sidebarOpen });
    else setSheetOpen((open) => !open);
  }, [setPrefs]);

  // ⌘B / Ctrl+B, as in shadcn's sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar]);

  const filters = () =>
    meta.data ? (
      <FilterSidebar meta={meta.data} checkGroups={report.data?.checkGroups ?? meta.data.checkGroups} running={report.isFetching} />
    ) : (
      <div className="space-y-3 p-4 pt-16">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );

  let content;
  if (meta.isError) {
    content = (
      <>
        <TopBar onToggleSidebar={toggleSidebar} />
        <ErrorState title="Couldn’t reach the VAHAN dashboard" message={meta.error.message} onRetry={() => meta.refetch()} />
      </>
    );
  } else if (report.isError) {
    content = (
      <>
        <TopBar onToggleSidebar={toggleSidebar} />
        <ErrorState title="This report couldn’t be loaded" message={report.error.message} onRetry={() => report.refetch()} />
      </>
    );
  } else if (report.data) {
    content = (
      <ReportView
        key={report.data.columns.join('|')}
        report={report.data}
        fetching={report.isFetching && report.isPlaceholderData}
        onToggleSidebar={toggleSidebar}
      />
    );
  } else {
    content = (
      <>
        <TopBar onToggleSidebar={toggleSidebar}>
          <span className="text-sm text-muted-foreground">Loading…</span>
        </TopBar>
        <LoadingState />
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh overflow-hidden">
        <aside
          aria-label="Filters"
          className={cn('hidden shrink-0 overflow-hidden bg-sidebar transition-[width] duration-200 md:block', sidebarOpen ? 'w-64 border-r' : 'w-0')}
          inert={!sidebarOpen}
        >
          <div className="h-full w-64">{filters()}</div>
        </aside>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Filters">
          {filters()}
        </Sheet>

        <div className="relative flex min-w-0 flex-1 flex-col">
          {report.isFetching && (
            <div className="absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden">
              <div className="animate-progress h-full w-1/3 bg-primary/70" />
            </div>
          )}
          {content}
        </div>
      </div>
    </TooltipProvider>
  );
}
