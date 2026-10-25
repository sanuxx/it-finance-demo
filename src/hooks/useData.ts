import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { CollectionItem, CollectionKey, DemoDatabase, ID, MasterListKey } from '@/domain'
import { useDemoStore } from '@/services/demo/demoStore'
import { billBalance, deriveBillStatus, isBillOverdue, type BillBalance } from '@/lib/calculations/bills'
import { invoiceBalance, invoiceDisplayStatus, invoiceTotals, type DocumentTotals, type InvoiceBalance, type InvoiceDisplayStatus } from '@/lib/calculations/invoices'
import { expenseLedger, revenueLedger } from '@/lib/calculations/ledgers'
import { projectFinancials, type ProjectFinancials } from '@/lib/calculations/projects'
import { todayISO, type DateRange } from '@/lib/dates'

/**
 * Read hooks. These are the swap point for a future server-state library
 * (e.g. TanStack Query) once the NestJS API exists.
 */

export function useCollection<K extends CollectionKey>(key: K): DemoDatabase[K] {
  return useDemoStore((s) => s.db[key])
}

export function useRecord<K extends CollectionKey>(key: K, id: ID | undefined): CollectionItem<K> | undefined {
  return useDemoStore((s) => (id ? (s.db[key] as unknown as CollectionItem<K>[]).find((r) => r.id === id) : undefined))
}

/** Select several collections at once with shallow comparison. */
export function useDbSlice<K extends keyof DemoDatabase>(...keys: K[]): Pick<DemoDatabase, K> {
  return useDemoStore(
    useShallow((s) => {
      const out = {} as Pick<DemoDatabase, K>
      for (const k of keys) out[k] = s.db[k]
      return out
    }),
  )
}

/** Full dataset — use sparingly (re-renders on any change). */
export function useDb(): DemoDatabase {
  return useDemoStore((s) => s.db)
}

export function useMasterList(list: MasterListKey, includeInactive = false) {
  const records = useCollection('masterData')
  return useMemo(() => records.filter((r) => r.list === list && (includeInactive || r.active)).sort((a, b) => a.name.localeCompare(b.name)), [records, list, includeInactive])
}

export interface Lookups {
  customer: (id?: ID) => string
  supplier: (id?: ID) => string
  project: (id?: ID) => string
  projectCode: (id?: ID) => string
  employee: (id?: ID) => string
  master: (id?: ID) => string
  user: (id?: ID) => string
  account: (id?: ID) => string
  product: (id?: ID) => string
  bankAccount: (id?: ID) => string
}

/** Id → display-name helpers built once per relevant data change. */
export function useLookups(): Lookups {
  const s = useDbSlice('customers', 'suppliers', 'projects', 'employees', 'masterData', 'users', 'accounts', 'products', 'bankAccounts')
  return useMemo(() => {
    const map = <T extends { id: string }>(items: T[], name: (t: T) => string) => {
      const m = new Map(items.map((i) => [i.id, name(i)]))
      return (id?: ID) => (id ? (m.get(id) ?? '—') : '—')
    }
    return {
      customer: map(s.customers, (c) => c.name),
      supplier: map(s.suppliers, (c) => c.name),
      project: map(s.projects, (p) => p.name),
      projectCode: map(s.projects, (p) => p.code),
      employee: map(s.employees, (e) => e.name),
      master: map(s.masterData, (m) => m.name),
      user: map(s.users, (u) => u.name),
      account: map(s.accounts, (a) => `${a.code} · ${a.name}`),
      product: map(s.products, (p) => p.name),
      bankAccount: map(s.bankAccounts, (b) => b.name),
    }
  }, [s])
}

export interface InvoiceView {
  totals: DocumentTotals
  balance: InvoiceBalance
  displayStatus: InvoiceDisplayStatus
}

/** Totals, balance and display status (incl. derived "overdue") per invoice. */
export function useInvoiceViews(): Map<ID, InvoiceView> {
  const { invoices, payments, creditNotes } = useDbSlice('invoices', 'payments', 'creditNotes')
  return useMemo(() => {
    const today = todayISO()
    return new Map(
      invoices.map((inv) => {
        const balance = invoiceBalance(inv, payments, creditNotes)
        return [inv.id, { totals: invoiceTotals(inv), balance, displayStatus: invoiceDisplayStatus(inv, balance, today) }]
      }),
    )
  }, [invoices, payments, creditNotes])
}

export interface BillView {
  balance: BillBalance
  status: ReturnType<typeof deriveBillStatus>
  overdue: boolean
}

export function useBillViews(): Map<ID, BillView> {
  const { supplierBills, payments } = useDbSlice('supplierBills', 'payments')
  return useMemo(() => {
    const today = todayISO()
    return new Map(
      supplierBills.map((b) => {
        const balance = billBalance(b, payments)
        return [b.id, { balance, status: deriveBillStatus(b, balance), overdue: isBillOverdue(b, balance, today) }]
      }),
    )
  }, [supplierBills, payments])
}

export function useProjectFinancials(): Map<ID, ProjectFinancials> {
  const s = useDbSlice('projects', 'projectCosts', 'timesheets', 'employees', 'expenses', 'supplierBills', 'cloudCosts', 'aiUsage', 'invoices', 'payments', 'creditNotes')
  return useMemo(() => new Map(s.projects.map((p) => [p.id, projectFinancials(p, s)])), [s])
}

/** Normalised revenue & expense ledgers for a date range (see lib/calculations/ledgers.ts). */
export function useLedgers(range: DateRange = {}) {
  const s = useDbSlice('invoices', 'creditNotes', 'products', 'employees', 'licences', 'assets', 'expenses', 'supplierBills', 'cloudCosts', 'aiUsage', 'meta')
  const { from, to } = range
  return useMemo(() => {
    const r = { from, to }
    return { revenue: revenueLedger(s, r), expenses: expenseLedger(s, r) }
  }, [s, from, to])
}
