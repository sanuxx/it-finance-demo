# Ledgerline — IT & Software Finance (interactive demo)

A fully interactive, browser-only prototype of a finance management platform for software development companies,
IT service providers, SaaS businesses and technology agencies. It runs as a static site (GitHub Pages) with
**fictional sample data stored in your browser** — there is no backend yet.

> **Interactive Demo — Sample Data.** Payments, emails, approvals, accounting postings and integrations are
> simulated. Nothing here is real accounting, a legally compliant financial statement, a bank transaction or a
> secure ledger. Never enter real credentials or confidential company data.

## What you can do

* Executive, finance, project and SaaS/infrastructure dashboards built from the underlying records (configurable widgets).
* Customers, contracts, quotations, invoices (line items, discounts, VAT, print preview), credit notes, simulated payments with balance checks, recurring billing, revenue recognition and WIP.
* Expenses with approval/rejection, reimbursement runs, purchase requests → purchase orders, supplier bills and payments.
* Project financial profiles (budget, actual, committed, forecast, invoiced vs recognised revenue, margin), cost entries, timesheets, labour costing and utilisation.
* SaaS MRR/ARR/churn, cloud and AI cost allocation, licences, budgets vs actuals, forecasts and scenarios.
* Fixed assets & depreciation, R&D, tax and currency settings, policies.
* Report centre (P&L, cash flow, trial balance, ageing, profitability…) and a custom report builder.
* No-code configuration: master data, custom fields, drag-and-drop form builder, rules builder with test mode, workflow builder with simulation, safe formula builder, document/email templates, dashboard builder.
* Simulated roles (Director, Finance Manager, Accountant, Project Manager, Employee), audit log, import/export, reset.

## Run locally

Requirements: Node.js 20+ (22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173 (on Windows, if the port is reserved: npm run dev -- --port 4180)
```

Other scripts:

```bash
npm run build        # type-check + production build into dist/
npm run preview      # serve the build
npm run lint         # oxlint
npm run typecheck    # tsc -b
npm test             # Vitest unit/component tests
npm run test:e2e     # Playwright (builds and serves under /it-finance-demo/); first run: npx playwright install chromium
```

## Deploy to GitHub Pages

Push to `main` with **Settings → Pages → Source: GitHub Actions** enabled. The workflow in
`.github/workflows/deploy.yml` builds with the correct `/<repository>/` base path and publishes the site.
Details: [docs/GITHUB_PAGES_DEPLOYMENT.md](docs/GITHUB_PAGES_DEPLOYMENT.md).

## Documentation

* [Frontend architecture & backend integration plan](docs/FRONTEND_ARCHITECTURE.md)
* [Demo data](docs/DEMO_DATA.md)
* [GitHub Pages deployment](docs/GITHUB_PAGES_DEPLOYMENT.md)
* [Implementation status](docs/IMPLEMENTATION_STATUS.md)
