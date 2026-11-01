import { PanelLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/button';
import { Tooltip } from './ui/overlays';

/** Slim header: sidebar toggle, the report title, and actions on the right. */
export function TopBar({ onToggleSidebar, children }: { onToggleSidebar: () => void; children?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <Tooltip label="Toggle filters (⌘B)">
        <Button variant="ghost" size="icon" aria-label="Toggle filters" onClick={onToggleSidebar}>
          <PanelLeft />
        </Button>
      </Tooltip>
      <span className="h-4 w-px bg-border" />
      {children}
    </header>
  );
}
