# Reliability Index Explorer

Frontend application for inspecting a thin-file credit decision score derived from bank transactions. The UI is built for analysts and product teams who need to understand how the Reliability Index was computed, inspect raw transaction behavior, and validate live updates without losing context.

## Stack

- Bun
- Vite
- React 19
- TypeScript
- Tailwind CSS v4
- Jotai
- Recharts
- `@tanstack/react-virtual`
- `react-tourlight`
- `react-icons`

## Setup

### Prerequisites

- Bun `>= 1.3`

### Install

```bash
bun install
```

### Run locally

```bash
bun run dev
```

### Production build

```bash
bun run build
```

### Preview production build

```bash
bun run preview
```

## What the app does

- Discovers available users and data range from the API root endpoint.
- Loads reliability score and full scoring-window transactions for the selected user/date.
- Visualizes:
  - reliability overview
  - score driver breakdown
  - transaction explorer
  - monthly cashflow timeline
  - human-readable explanation panel
- Supports live SSE transaction updates behind a user-controlled `Live updates` toggle.
- Preserves transaction filters and current tab.

## Assumptions

- Default user comes from the first user returned by the discovery endpoint.
- Default scoring date is the API discovery `data_range.to` value, so first load uses the freshest available window.
- The scoring window is six months ending at the selected `from` date, matching the backend contract.
- Analysts benefit more from a full-window transaction fetch than backend pagination because charts, filters, explanations, and derived summaries all need a consistent local dataset.
- The backend does not expose per-signal score points for all four scoring components, so the frontend derives a visual breakdown for the first three documented metrics and infers the residual contribution as `Resilience Adjustments`.

## Trade-offs

- Full-window fetch over paginated fetching:
  - Chosen because the app needs local, synchronized derived views.
  - Trade-off is a larger initial payload for wide windows or larger users.

- Client-side sort/filter/search:
  - Chosen for responsiveness and consistent analyst behavior after load.
  - Trade-off is more work in the browser and higher memory use.

- SSE updates mutate the local transaction collection and trigger a debounced reliability refetch:
  - Chosen because the score is backend-owned and should not be recomputed client-side as source of truth.
  - Trade-off is an extra network request after live events.

- Lazy-loaded heavy panels:
  - Chosen to keep initial bundle smaller.
  - Trade-off is a small first-open loading boundary on some tabs.

- Light-theme redesign inspired by the provided dark references:
  - Chosen to preserve structure and analyst-oriented density while following the requested theme shift.

## Limitations

- The score breakdown is partly inferred because the backend only returns the final score, metrics, and textual drivers, not exact component point allocations.
- SSE behavior was implemented against the documented event names and payload contract; if the stream sends unusual heartbeat or malformed events, the client currently ignores only what it can safely parse.
- Large datasets are handled with virtualization in the table, but all transactions in the scoring window still live in memory.
- No dedicated test suite has been added yet.
- Fonts are imported from the network in CSS; for stricter production environments these should be self-hosted.

## Architecture Notes

### Frontend structure

- `src/App.tsx`
  - App shell
  - URL-synced tab bootstrap and history handling
  - discovery bootstrap
  - dashboard data orchestration via hooks
  - live-tour trigger
  - top-level loading/error/empty states

- `src/components`
  - `AppHeader.tsx`
    - top navigation bar for cross-cutting controls
    - owns the user selector sourced from discovery data
    - owns the live-mode toggle and compact live connection status chip
    - does not fetch data itself; receives state and setters from App shell
  - `DashboardHero.tsx`
    - top-of-page summary block for the currently selected user
    - owns the date-range controls, current score badge, and tab strip
    - enforces simple date guardrails in the UI by constraining input min/max values 
  - `OverviewPanel.tsx`
    - default landing tab focused on fast score inspection
    - renders the circular reliability index gauge and score band summary
    - computes and displays KPI cards such as average income, average expenses, coverage ratio, good months, and negative-balance days
    - surfaces backend-provided textual drivers and classifies them into positive vs risk styling
  - `ScoreBreakdownPanel.tsx`
    - dedicated tab for score derivation transparency
    - renders the four published score families as card-style progress bars 
  - `TransactionExplorer.tsx`
    - analyst workflow tab for inspecting the raw transaction set in the active date window
    - owns client-side search, category filtering, direction filtering, and sort state
    - uses `useDeferredValue` so free-text search stays responsive while typing
    - uses `@tanstack/react-virtual` to render only visible rows while keeping the full filtered dataset available in memory
    - formats merchant display, category labels, and signed amounts for tabular review
  - `CashflowPanel.tsx`
    - month-level trend view built from derived `monthlyCashflow`
    - combines Recharts bars and a line to show income, expenses, and net trend together
    - includes a supporting month-by-month table with income, expenses, net, and essential-expense coverage ratio
    - stays presentational by relying on precomputed monthly buckets from `scoring.ts`
  - `ExplanationPanel.tsx`
    - narrative interpretation tab aimed at non-technical review 
    - closes with the composite score so the narrative and the numeric result stay visually tied together

- `src/hooks`
  - `useDashboardData.ts`: discovery, reliability, and transaction fetch lifecycle
  - `useLiveTransactions.ts`: SSE connection lifecycle, event normalization, local data patching

- `src/lib`
  - `api.ts`: REST and SSE base URL helpers
  - `categories.ts`: transaction categorization and essential-expense tagging
  - `format.ts`: formatting utilities
  - `scoring.ts`: derived views, score signal shaping, SSE transaction patching

- `src/state/app.ts`
  - small global atoms for app-level UI state

- `src/types/app.ts`
  - shared API and derived-view typing

### State management decisions

Jotai is used only for small, shared UI state:

- selected user
- selected date range
- active tab
- live mode toggle
- first-run tour persistence

Reasoning:

- These values are cross-cutting and benefit from global access/persistence.
- The fetched data itself stays local to `AppShell` because it is loaded and coordinated from one place.
- This avoids over-centralizing the entire data model in atoms when ordinary React state is enough.

### Data fetching strategy

Discovery:

- Fetch `GET /`
- derive default user and clamp persisted date values to the API `data_range`

Primary dashboard data:

- reliability and transactions are fetched in separate effects
- reliability: `GET /api/users/{userId}/reliability?from=selectedTo`
- transactions: `GET /api/users/{userId}/transactions?from=selectedFrom&to=selectedTo`

Scaling strategy:

- Fetch the full selected date window once
- sort/filter/search in memory
- virtualize the transaction list for rendering performance

Live updates:

- SSE is opt-in via toggle
- subscribe to `/api/users/{userId}/transaction-events`
- patch the local transaction collection incrementally
- debounce a reliability refetch after updates so score and explanations remain backend-truthful

Abort behavior:

- `AbortController` is used in effects
- aborted requests are explicitly ignored so React cleanup does not surface false API errors

### Component design approach

- `AppShell` owns orchestration.
- Panels are presentational and consume already-shaped data.
- Heavy panels are lazy loaded to reduce initial cost.
- `OverviewPanel` is eager-loaded because it is the default tab.
- Shared derivation logic stays out of components so:
  - calculations are easier to reason about
  - SSE patching is reusable
  - component code stays focused on rendering

The main rendering split is:

- overview: high-level score, KPI cards, and backend driver summaries
- score breakdown: visualized four-signal score derivation
- transactions: operational inspection workflow
- cashflow: trend and month-level stability view
- explanation: non-technical narrative and score rationale

## Diagram

### Component architecture

```text
App
└── SpotlightProvider
    └── AppShell
        ├── SpotlightTour
        ├── AppHeader
        │   ├── User selector
        │   ├── Live toggle
        │   └── Live status chip
        ├── DashboardHero
        │   ├── Date range controls
        │   ├── Current score summary
        │   └── Tabs
        ├── ScreenState
        │   ├── LoadingScreen
        │   ├── ErrorScreen
        │   └── EmptyScreen
        └── Active Panel (inside Suspense)
            ├── OverviewPanel
            ├── ScoreBreakdownPanel
            ├── TransactionExplorer
            ├── CashflowPanel
            └── ExplanationPanel
```

### Data flow

```text
URL search param (?view=...)
    └── normalize activeTab
            │
            ▼
      AppShell state
            │
            └── DashboardHero tab controls

Discovery API
    └── defaults userId + date range
            │
            ▼
      AppShell state
            │
            ├── fetch reliability for selectedTo
            ├── fetch transactions for selectedFrom..selectedTo
            ├── buildMonthlyCashflow()
            ├── buildScoreSignals()
            └── buildNarrativeSignals()
            │
            ▼
         UI panels
            │
            └── transaction filters/sort/search
                (inside TransactionExplorer)

SSE transaction events
    └── applyTransactionEvent()
            ├── update local transactions
            └── debounce reliability refetch
```

### State responsibilities

```text
Jotai atoms
  - selectedUserId
  - selectedFrom
  - selectedTo
  - activeTab
  - liveMode
  - liveTourSeen

React local state in AppShell
  - discovery payload
  - reliability payload
  - transactions collection
  - loading/error flags
  - reliabilityRefreshKey

Derived state
  - URL-normalized active tab
  - live connection status
  - monthly cashflow
  - score signal visualization
  - explanation narrative
```

