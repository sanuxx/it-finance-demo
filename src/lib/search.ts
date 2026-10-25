import type { DemoDatabase, RoleKey } from '@/domain'
import { NAV_INDEX } from '@/app/navigation'
import { can } from '@/lib/permissions'
import { formatCurrency } from '@/lib/formatting'
import { invoiceTotals } from '@/lib/calculations/invoices'

export interface SearchResult {
  id: string
  type: 'Page' | 'Customer' | 'Supplier' | 'Project' | 'Invoice' | 'Expense' | 'Purchase order' | 'Supplier bill' | 'Contract' | 'Person' | 'Product' | 'Report'
  title: string
  subtitle?: string
  to: string
}

/** Search across navigation and the main demo records (respects simulated permissions). */
export function searchAll(db: DemoDatabase, query: string, role: RoleKey, limit = 50): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const hit = (...values: (string | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q))
  const out: SearchResult[] = []
  const customerName = new Map(db.customers.map((c) => [c.id, c.name]))
  const supplierName = new Map(db.suppliers.map((s) => [s.id, s.name]))

  for (const { group, item } of NAV_INDEX) {
    if ((group.permission && !can(role, group.permission)) || (item.permission && !can(role, item.permission))) continue
    if (hit(item.label, item.description, group.label)) out.push({ id: `nav:${item.path}`, type: 'Page', title: item.label, subtitle: group.label, to: item.path })
  }
  if (can(role, 'sales.view')) {
    for (const c of db.customers) if (hit(c.name, c.code, c.contactName, c.industry)) out.push({ id: c.id, type: 'Customer', title: c.name, subtitle: `${c.code} · ${c.industry}`, to: `/sales/customers/${c.id}` })
    for (const i of db.invoices)
      if (hit(i.number, customerName.get(i.customerId), ...i.lines.map((l) => l.description)))
        out.push({ id: i.id, type: 'Invoice', title: i.number, subtitle: `${customerName.get(i.customerId)} · ${formatCurrency(invoiceTotals(i).total)}`, to: `/sales/invoices/${i.id}` })
    for (const c of db.contracts) if (hit(c.number, c.title)) out.push({ id: c.id, type: 'Contract', title: c.title, subtitle: c.number, to: '/sales/contracts' })
  }
  if (can(role, 'procurement.view')) {
    for (const s of db.suppliers) if (hit(s.name, s.code)) out.push({ id: s.id, type: 'Supplier', title: s.name, subtitle: s.code, to: `/procurement/suppliers/${s.id}` })
    for (const p of db.purchaseOrders) if (hit(p.number, supplierName.get(p.supplierId))) out.push({ id: p.id, type: 'Purchase order', title: p.number, subtitle: supplierName.get(p.supplierId), to: '/procurement/purchase-orders' })
    for (const b of db.supplierBills) if (hit(b.number, b.description, supplierName.get(b.supplierId))) out.push({ id: b.id, type: 'Supplier bill', title: `${b.number} — ${b.description}`, subtitle: supplierName.get(b.supplierId), to: '/procurement/bills' })
  }
  if (can(role, 'projects.view')) {
    for (const p of db.projects) if (hit(p.name, p.code, customerName.get(p.customerId))) out.push({ id: p.id, type: 'Project', title: `${p.code} · ${p.name}`, subtitle: customerName.get(p.customerId), to: `/projects/${p.id}` })
  }
  if (can(role, 'expenses.submit')) {
    for (const e of db.expenses) if (hit(e.number, e.description)) out.push({ id: e.id, type: 'Expense', title: `${e.number} — ${e.description}`, subtitle: formatCurrency(e.amount), to: `/finance/expenses/${e.id}` })
  }
  if (can(role, 'costs.sensitive')) {
    for (const e of db.employees) if (hit(e.name, e.code)) out.push({ id: e.id, type: 'Person', title: e.name, subtitle: e.code, to: '/resources/employees' })
  }
  if (can(role, 'saas.view')) {
    for (const p of db.products) if (hit(p.name, p.code)) out.push({ id: p.id, type: 'Product', title: p.name, subtitle: p.code, to: '/saas/products' })
  }
  if (can(role, 'reports.view')) {
    for (const r of db.savedReports) if (hit(r.name, r.description)) out.push({ id: r.id, type: 'Report', title: r.name, subtitle: 'Saved report', to: `/reports/builder?id=${r.id}` })
  }
  return out.slice(0, limit)
}
