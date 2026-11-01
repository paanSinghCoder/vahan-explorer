# Vahan Explorer

A cleaner front end for the VAHAN dashboard's report view
(`vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml`), with the same
filters and tables, saved filters, and CSV export. Unofficial; all figures come from the
public VAHAN dashboard (MoRTH).

## Run

```bash
pnpm install
pnpm dev            # web on http://localhost:5173, API on :5174
```

Production: `pnpm build && pnpm start`, then open http://localhost:5174.

## How it works

The VAHAN page is a JSF/PrimeFaces app with no public API, and it doesn't allow calls
from other origins, so `server/` acts as a small proxy:

- `server/vahan/session.ts` opens a session and replays the requests the page's own
  widgets send (cookies + ViewState), in the order the page requires:
  state → RTO → Y-axis → X-axis → year, then Refresh, the table's vehicle-group
  dropdown, and the side-panel refinements.
- The page only pages 25 rows at a time, so all rows come from its Excel export
  (`server/vahan/xlsx.ts`); headers come from the rendered table.
- Results are cached in memory (reports 30 min, filter options 12 h), and at most
  two VAHAN sessions run at once.

The client (`src/`) is React 19 + TypeScript + Tailwind v4 + TanStack Query + Zustand.
Applied filters and display preferences are saved in localStorage, so the page reopens
with your last report; **Copy link** puts the filters in the URL.

| VAHAN page | Here |
| --- | --- |
| Type (Thousand / Lakh / Crore / Actual) | "Values in" switch (applied instantly) |
| State, RTO | Location |
| Y-Axis, X-Axis | Layout → Rows, Columns |
| Year Type, Year / multi-year list | Period |
| Vehicle Category, Norms, Fuels, Vehicle Class checkboxes | Refine |
| Vehicle-group dropdown in the table header | Tabs above the table |
| Excel export | CSV export |

## Userscript

`vahan-report-filters.user.js` is a separate Tampermonkey/Violentmonkey script for the
original VAHAN report page: it saves the filters you pick there and re-applies them each
time the page opens.

## Caveats

- The old `vahan4dashboard` says it "will be discontinued after 15 August 2026" in favour
  of analytics.parivahan.gov.in. It was still live in November 2026; if it goes away or
  its markup changes, the parsers in `server/vahan/` will need updating.
- The VAHAN server rejects headless Chrome (HTTP 403), but not plain HTTP clients.
