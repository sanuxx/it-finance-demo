# Implementation status

Last verified: see "Verification" below (commands were actually run; results recorded as observed).

## Implemented

| Area | Screens | Notes |
| --- | --- | --- |
| Overview | Executive, finance, project and SaaS dashboards; approvals inbox; notifications | Widget-based, date-range filter, drill-downs; KPI comparison shown only when the earlier period is inside the seeded history |
| Finance | Revenue, general ledger, journals, chart of accounts, banking, reconciliation, periods, receivables, payables, expenses (+detail), reimbursements, transactions | Ledger/journals are illustrative; closed-period rule enforced in the pages |
| Sales & billing | Customers (+detail), contracts, quotations, invoices (editor, detail, print preview), credit notes, payments, recurring billing, billing schedules, revenue recognition, WIP | Payments validated against outstanding balance; drafts are never receivable |
| Procurement | Suppliers (+detail), purchase requests, purchase orders, supplier bills, vendor spend, supplier subscriptions | Simulated approvals/sending |
| Projects & costing | Projects (+7-tab detail), budgets, cost entries, labour costing, timesheets, utilisation, contract & project profitability, people cost profiles, roles & rates | Cost rates gated by the simulated `costs.sensitive` permission |
| SaaS & technology | Products, subscriptions, MRR/ARR/churn/NRR, cloud, AI usage, licences, infrastructure budgets, product profitability | Churn/NRR flagged as estimates |
| Planning | Budgets (+detail), revenue/expense/cash-flow forecasts, scenarios, cost to complete | Simple illustrative projection, not statistical |
| Assets & compliance | Fixed assets (+detail), depreciation, R&D, tax, currencies, policies | Illustrative, not a tax return |
| Reports | 16 reports, viewer, custom report builder (8 whitelisted datasets), saved reports | CSV/JSON export, print |
| Configuration | Master data, custom fields, form builder (dnd-kit + keyboard), rules builder with test mode, workflow builder with simulation, safe formula builder (no `eval`), templates, dashboard builder, system preferences | Config persisted in localStorage |
| Administration | Users & roles, permission matrix, organisation, import/export (CSV/JSON/backup restore), integrations preview, audit log, preferences, demo data reset | UI-only permissions |
| Platform | App shell, global search (Ctrl+K), notifications, theme, simulated roles, error boundary, versioned storage with migration/corruption recovery, GitHub Pages workflow | |

## Verification (commands run)

| Check | Result |
| --- | --- |
| `npx tsc -p tsconfig.app.json --noEmit` | No errors |
| `npm run lint` (oxlint) | 0 errors, 0 warnings |
| `npm test` (Vitest, 15 files) | 74 tests passed |
| `npm run build` | Succeeds; routes are lazy-loaded chunks (largest: charts ≈ 328 kB / 95 kB gzip, app ≈ 459 kB / 139 kB gzip) |
| `npm run test:e2e` (Playwright, Chromium, served under `/it-finance-demo/`) | 11 passed — including every sidebar route loading without errors or placeholders |
| GitHub Pages deployment | Workflow configured; **not yet deployed** (no repository has been pushed) |

Unit tests cover: money rounding, invoice/credit/payment balances, ageing, budgets (incl. zero budget), depreciation, MRR,
seed integrity (references, no over-allocation, status/balance agreement, non-negative cash), storage (seed, reload,
corruption recovery, migration, newer-schema protection, namespace-only reset), repositories (customer CRUD, invoice
issue → partial → full payment, over-payment rejection, expense submit/approve/reject with rule flagging, reset), the
rules engine, CSV export (escaping, formula-injection guard), base-path resolution, forecasting, report builder
aggregation, formula engine, form validation, workflow simulation and backup import.

E2E covers: start-up and routing, all navigation links, not-found, customer create/validate/edit + persistence after
refresh, invoice create → issue → rejected over-payment → partial payment, expense reject-with-reason and
create → submit → approve, theme switching + persistence, demo reset, CSV download, rules/formula screens, role switching.

## Known limitations

* **Deployment** is configured but unverified until the repository is pushed and the Pages action has run.
* No component-level (React Testing Library) tests beyond the service/library layers; UI behaviour is covered by Playwright.
* Custom-field definitions are managed but not yet rendered on the customer/project/expense/invoice forms.
* Workflow runs are a sandbox simulation; real approvals do not pass through workflow stages. Rules for invoices, bills and
  projects can be authored and tested but only expense submission and PO approval evaluate them automatically.
* System preferences (numbering prefixes, default terms/tax) are stored but not read by other screens yet.
* Journals, ledger, tax summaries and reports are illustrative and not statutory statements; browser storage is not a secure ledger.
* Churn/NRR cannot reflect historical seat/price changes (not recorded).
* Asset disposal changes status only (no gain/loss journal). VAT summary ignores credit notes and exemptions.
* Only desktop Chromium was automated; tablet/mobile layouts were checked visually on selected pages.

## Backend plan

See [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md#api-integration-boundary).
