import { useMemo } from 'react'
import type { Option } from '@/components/forms/fields'
import { useCollection, useMasterList } from '@/hooks/useData'

/** Select options shared by procurement, payables and assets screens. */
export function useProcurementOptions() {
  const suppliers = useCollection('suppliers')
  const projects = useCollection('projects')
  const bankAccounts = useCollection('bankAccounts')
  const taxRates = useCollection('taxRates')
  const purchaseOrders = useCollection('purchaseOrders')
  const departments = useMasterList('departments')
  const expenseCategories = useMasterList('expenseCategories')
  const supplierCategories = useMasterList('supplierCategories')
  const assetClasses = useMasterList('assetClasses')
  return useMemo(() => {
    const opt = <T,>(items: T[], value: (t: T) => string, label: (t: T) => string): Option[] => items.map((i) => ({ value: value(i), label: label(i) }))
    return {
      suppliers: opt(suppliers.filter((s) => s.status === 'active'), (s) => s.id, (s) => s.name),
      allSuppliers: opt(suppliers, (s) => s.id, (s) => s.name),
      projects: opt(projects.filter((p) => p.status !== 'cancelled'), (p) => p.id, (p) => `${p.code} · ${p.name}`),
      bankAccounts: opt(bankAccounts.filter((b) => b.active), (b) => b.id, (b) => `${b.name} (${b.accountMask})`),
      purchaseTaxRates: taxRates.filter((t) => t.active && (t.type === 'purchase' || t.type === 'sales')),
      purchaseOrders,
      departments: opt(departments, (d) => d.id, (d) => d.name),
      expenseCategories: opt(expenseCategories, (d) => d.id, (d) => d.name),
      supplierCategories: opt(supplierCategories, (d) => d.id, (d) => d.name),
      assetClasses,
      assetClassOptions: opt(assetClasses, (d) => d.id, (d) => d.name),
    }
  }, [suppliers, projects, bankAccounts, taxRates, purchaseOrders, departments, expenseCategories, supplierCategories, assetClasses])
}
