# Demo data

All data is **fictional** and generated in the browser by `src/data/seed/buildSeed.ts`. No real company, person,
bank, payroll or tax information is included. Names of public cloud/AI providers appear only as illustrative
cost-line labels.

## The fictional company

**Kelani Byte Labs (Pvt) Ltd** — a Colombo-based software consultancy and SaaS vendor. Base currency **LKR**;
other currencies are configured with illustrative rates.

| Area | Contents |
| --- | --- |
| Customers | 13 (retail, logistics, healthcare, insurance, microfinance, hospitality, education, agritech, energy…) with good, slow and poor payment behaviour |
| Suppliers | 11 (office lease, telecom, design and contractor agencies, auditors, software vendors, hardware) |
| People | 18 fictional employees/contractors with cost and bill rates (no real payroll data) |
| Projects | 11 — fixed price, milestone, T&M, retainer and one internal R&D project; statuses planning, active, on hold, completed; health ranges from on track to over budget |
| Billing | ~180 invoices (milestones, monthly T&M from approved timesheets, retainers, SaaS subscriptions, licences), drafts, part-paid, overdue; credit notes; quotations; recurring schedules |
| Payments | Customer receipts, supplier payments, payroll, card settlements, VAT and reimbursement runs (all simulated) |
| Costs | ~1,500 weekly timesheets, project cost entries and commitments, 52 expense claims, ~40 supplier bills, POs and purchase requests |
| Technology | 6 products (3 services, 2 SaaS, 1 licence), 16 subscriptions incl. cancellations and a trial, 13 months of cloud and AI usage, 9 software licences |
| Planning | FY company opex and revenue budgets, cloud, engineering, sales and people budgets; 3 forecast scenarios |
| Assets & compliance | 10 fixed assets (straight-line and declining balance), R&D expenditure, tax rates, currencies, policies |
| Configuration | Master data lists, custom fields, 2 forms, 5 rules, 4 workflows with runs, 5 formulas, 6 templates, default dashboard, 3 saved reports, 8 integrations |

## Dates

Dates are generated **relative to the day the demo is first opened** (the "anchor date", stored in
`meta.anchorDate`). Dashboards, ageing and due dates therefore always look current. The same anchor always yields
the same dataset (a fixed pseudo-random seed is used), which keeps tests deterministic.

## Coherence guarantees

The seed test (`src/data/seed/seed.test.ts`) checks that:

* invoices, projects, subscriptions and bills reference existing customers/projects/suppliers;
* payments and credit notes never exceed an invoice or bill total;
* stored statuses agree with balances (paid ⇒ zero outstanding);
* simulated bank balances stay non-negative;
* the trailing year is profitable and the dataset fits comfortably in localStorage.

T&M invoices are produced from the approved billable timesheet hours of that month; milestone invoices exist only
for milestones within each project's % complete; card settlements equal that month's cloud + AI + licence costs.

## Derived figures

Nothing on a dashboard or report is typed in. Revenue comes from issued invoices (net of tax, less credit notes);
operating expenses are personnel cost (accrued monthly), licences, depreciation, approved expense claims, approved
supplier bills, cloud and AI usage. Project costs combine timesheet labour at cost rates, direct cost entries,
project-tagged expenses, bills, cloud and AI usage.

## Persistence & reset

* Stored under `localStorage` keys `it-finance-demo:v1:data` and `it-finance-demo:v1:prefs`.
* Data belongs to the current browser only — it is not shared with other users or devices.
* Corrupted data is backed up to `it-finance-demo:v1:corrupt-backup` and replaced by a fresh seed.
* Older stored data is migrated (missing collections are filled in without discarding your changes).
* **Administration → Demo data → Reset** restores the original dataset and touches only `it-finance-demo:*` keys.
