# Frontend architecture

Ledgerline is a browser-only prototype of an IT & software finance platform. It is structured so the planned
NestJS + PostgreSQL backend can be connected without rewriting page components.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | React 19, TypeScript (strict), Vite |
| Routing | React Router (`HashRouter`) — works on static hosting without rewrite rules |
| UI | Tailwind CSS v4, shadcn/ui (Radix primitives), Lucide icons |
| Tables | TanStack Table v9 (wrapped by `components/data-display/DataTable.tsx`) |
| Forms | React Hook Form + Zod v4 |
| Charts | Recharts (wrapped by `components/charts`) |
| Drag & drop | dnd-kit (form, workflow and dashboard builders) |
| State | Zustand (demo dataset store + UI preferences) |
| Money | `decimal.js-light` via `lib/calculations/money.ts` (2 dp, half-up) |
| Tests | Vitest + Testing Library (unit/component), Playwright (browser) |

## Layers

```text
src/
  app/            App, router (routes.tsx), navigation map, shell layouts, UI preference store
  components/     Shared presentation: ui/ (shadcn), layout, data-display, forms, dialogs, charts, feedback
  features/<x>/   One folder per module: pages/ (route components), components/, lib/ (module helpers)
  domain/         Typed business entities (no UI, no storage) + the DemoDatabase shape
  lib/
    calculations/ Pure, deterministic finance maths shared by every screen
    storage/      Versioned localStorage service (namespace it-finance-demo:v1:*)
    rules/        Constrained business-rule evaluator (data, never code)
    formatting/   Currency, number, percent and date formatting
    export/       CSV / JSON generation
    permissions   Simulated role → permission matrix (UI only)
  services/
    repositories/ Data-access interfaces (async, backend-agnostic)
    demo/         LocalStorage-backed implementations + the Zustand dataset store
    api/          Reserved for future REST adapters (README only — no network calls exist)
  hooks/          Read hooks (useData.ts), session/permission hooks, action/toast helper
  data/seed/      Deterministic fictional dataset generator
```

Rules the codebase follows:

* **Pages never touch `localStorage`.** Reads go through `hooks/useData.ts`; writes go through repositories
  exported from `src/services/index.ts`.
* **Every displayed number is derived** from the stored records using `lib/calculations`. For example the
  dashboard, the P&L report, budget utilisation and the cost analysis all use the same
  `revenueLedger()` / `expenseLedger()` functions, and invoice balances always come from `invoiceBalance()`.
* **Repositories enforce business rules** (cannot over-allocate a payment, cannot edit an issued invoice,
  rejection needs a reason, system master data cannot be deleted…) and throw `DemoValidationError`, which the
  UI shows as a toast via `useAction()` / `runWithToast()`.
* **Every mutation writes an audit entry** (`auditLog`) stamped with the simulated user and role.
* **Simulated operations are labelled** (payments, emails, approvals, postings, integrations).

## Data flow

```text
Page ──read──▶ useCollection / useInvoiceViews / useLedgers … ──▶ useDemoStore (Zustand)
  │                                                                 ▲
  └─write─▶ invoiceRepository.recordPayment(…) ── validate ── mutate┘──▶ debounced save → localStorage
```

`useDemoStore` holds one immutable `DemoDatabase`. Mutations replace only the affected collections, so selectors
re-render only the views that depend on them. Saves are debounced (250 ms) and flushed on `pagehide`; a
`storage` event listener keeps several open tabs in sync.

## API integration boundary

`src/services/repositories/types.ts` defines the contracts (`Repository<T>`, `InvoiceRepository`,
`ExpenseRepository`, `SupplierBillRepository`, `PurchaseOrderRepository`, `ProjectRepository`,
`BudgetRepository`, `WorkflowRepository`, …). All methods return promises, mirroring HTTP calls.

Planned REST mapping (illustrative):

| Repository | Resource | Notable commands |
| --- | --- | --- |
| `customerRepository` | `/customers` | — |
| `invoiceRepository` | `/invoices` | `POST /invoices/:id/issue`, `/void`, `/payments`, `/credit-notes` |
| `paymentRepository` | `/payments` | — |
| `expenseRepository` | `/expense-claims` | `/submit`, `/approve`, `/reject`, `POST /reimbursement-runs` |
| `supplierBillRepository` | `/supplier-bills` | `/submit`, `/approve`, `/payments` |
| `purchaseRequestRepository` / `purchaseOrderRepository` | `/purchase-requests`, `/purchase-orders` | `/transition`, `/convert` |
| `projectRepository`, `projectCostRepository`, `milestoneRepository`, `timesheetRepository` | `/projects/…` | `/status` |
| `budgetRepository` | `/budgets` | `/status`, `/duplicate` |
| `formRepository`, `ruleRepository`, `workflowRepository`, `formulaRepository`, `templateRepository` | `/config/…` | `/publish`, `/runs` |
| `dashboardRepository`, `savedReportRepository` | `/me/dashboards`, `/reports/saved` | — |

To connect the backend:

1. Add `services/api/httpClient.ts` (base URL from `VITE_API_BASE_URL`, auth token, error mapping).
2. Implement the interfaces as REST adapters and switch the exports in `services/index.ts` one resource at a time.
3. Replace the hooks in `hooks/useData.ts` with TanStack Query hooks calling the same repositories
   (pagination/filtering can move server-side through `ListQuery`).
4. Move derived calculations that must be authoritative (balances, ledger postings, budget actuals) to the
   backend; keep the frontend functions for previews.
5. Enforce authorisation on the server. `lib/permissions.ts` only shapes the UI.

Domain types are intentionally independent of any Prisma schema; adapters translate between DTOs and these types.

## Routing & deployment

`HashRouter` keeps every route (`/#/sales/invoices/inv-12`) working on GitHub Pages: refreshes, deep links and
history all resolve to `index.html`. Vite's `base` is computed in `vite.config.ts` (`resolveBasePath`) so assets
load from `/<repository>/` in the Pages build and `/` locally. Feature pages are lazy-loaded per route.

## Accessibility & UX conventions

* Status badges always pair text with colour; charts have a "view as table" toggle and legends.
* Dialogs, menus and sheets are Radix-based (focus trapping, Escape, ARIA); tables are real `<table>` elements
  with sortable header buttons and `aria-sort`.
* Drag-and-drop builders offer keyboard Move up/down alternatives.
* `prefers-reduced-motion` disables animations; light and dark themes share the same tokens.
