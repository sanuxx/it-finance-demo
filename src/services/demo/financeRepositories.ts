import type { ExpenseClaim, Payment } from '@/domain'
import { add, round2, sum } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import { evaluateRules, type RuleContext } from '@/lib/rules/engine'
import type { ExpenseRepository } from '@/services/repositories/types'
import { getDb, newId, nextNumber, useDemoStore } from './demoStore'
import { DemoValidationError, auditEntry, createLocalRepository, getActor, nowStamp, replaceIn, withAudit, withNotification } from './localRepository'
import { projectFinancials } from '@/lib/calculations/projects'

const expenseBase = createLocalRepository('expenses', {
  prefix: 'exp',
  entity: 'expense',
  label: (e) => e.number,
  canDelete: (e) => (e.status === 'draft' || e.status === 'rejected' ? null : 'Only draft or rejected claims can be deleted.'),
})

function findExpense(id: string): ExpenseClaim {
  const e = getDb().expenses.find((x) => x.id === id)
  if (!e) throw new DemoValidationError('Expense claim not found.')
  return e
}

/** Build the rule context for an expense, including project budget consumption. */
export function expenseRuleContext(e: Pick<ExpenseClaim, 'amount' | 'categoryId' | 'projectId' | 'departmentId' | 'status' | 'billable'>): RuleContext {
  const db = getDb()
  const project = e.projectId ? db.projects.find((p) => p.id === e.projectId) : undefined
  return {
    amount: e.amount,
    categoryId: e.categoryId,
    projectId: e.projectId ?? '',
    departmentId: e.departmentId,
    status: e.status,
    billable: e.billable,
    budgetConsumptionPercent: project ? (projectFinancials(project, db).budgetConsumptionPercent ?? 0) : undefined,
  }
}

function transition(e: ExpenseClaim, status: ExpenseClaim['status'], note?: string): ExpenseClaim {
  const actor = getActor()
  return { ...e, status, updatedAt: nowStamp(), history: [...e.history, { status, at: nowStamp(), by: actor.name, note }] }
}

export const expenseRepository: ExpenseRepository = {
  ...expenseBase,
  async create(input) {
    if (!(input.amount > 0)) throw new DemoValidationError('Amount must be greater than zero.')
    const db = getDb()
    const actor = getActor()
    return expenseBase.create({
      ...input,
      number: nextNumber(db.expenses.map((e) => e.number), 'EXP-', 4),
      status: 'draft',
      history: [{ status: 'draft', at: nowStamp(), by: actor.name }],
      notes: input.notes ?? [],
      receipts: input.receipts ?? [],
    })
  },
  async update(id, patch) {
    const e = findExpense(id)
    if (e.status !== 'draft' && e.status !== 'rejected' && (patch.amount !== undefined || patch.categoryId || patch.date)) {
      throw new DemoValidationError('Submitted or approved claims cannot be edited.')
    }
    return expenseBase.update(id, patch)
  },
  async submit(id) {
    const e = findExpense(id)
    if (e.status !== 'draft' && e.status !== 'rejected') throw new DemoValidationError('Only draft or rejected claims can be submitted.')
    const db = getDb()
    const evaluations = evaluateRules(db.rules, 'expense', expenseRuleContext({ ...e, status: 'submitted' })).filter((r) => r.triggered)
    const flagged = evaluations.some((r) => r.rule.actions.some((a) => a.type === 'flag_for_review' || a.type === 'escalate_approval'))
    const note = evaluations.length ? `Rules triggered: ${evaluations.map((r) => r.rule.name).join(', ')}` : undefined
    const updated = { ...transition(e, 'submitted', note), flaggedForReview: flagged || e.flaggedForReview }
    useDemoStore.getState().mutate((d) => {
      let next = withAudit(replaceIn(d, 'expenses', updated), auditEntry('submit', 'expense', `Submitted ${e.number} (${formatCurrency(e.amount)})`, id))
      for (const ev of evaluations) {
        for (const action of ev.rule.actions) {
          if (action.type === 'notify' || action.type === 'escalate_approval' || action.type === 'budget_warning' || action.type === 'flag_for_review') {
            next = withNotification(next, {
              title: `${ev.rule.name}`,
              body: `${e.number}: ${action.message}`,
              kind: action.type === 'budget_warning' ? 'warning' : 'approval',
              link: `/finance/expenses/${e.id}`,
            })
          }
        }
      }
      return next
    })
    return updated
  },
  async approve(id, note) {
    const e = findExpense(id)
    if (e.status !== 'submitted') throw new DemoValidationError('Only submitted claims can be approved.')
    const updated = transition(e, 'approved', note)
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'expenses', updated), auditEntry('approve', 'expense', `Approved ${e.number} (simulated approval)`, id)))
    return updated
  },
  async reject(id, reason) {
    const e = findExpense(id)
    if (e.status !== 'submitted') throw new DemoValidationError('Only submitted claims can be rejected.')
    if (!reason.trim()) throw new DemoValidationError('A reason is required when rejecting a claim.')
    const updated = transition(e, 'rejected', reason)
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'expenses', updated), auditEntry('reject', 'expense', `Rejected ${e.number}: ${reason}`, id)))
    return updated
  },
  async reimburse(ids, bankAccountId) {
    const db = getDb()
    const claims = db.expenses.filter((e) => ids.includes(e.id) && e.status === 'approved')
    if (!claims.length) throw new DemoValidationError('Select at least one approved claim to reimburse.')
    const amount = sum(claims, (c) => c.amount)
    const stamp = nowStamp()
    const payment: Payment = {
      id: newId('pay'),
      number: nextNumber(db.payments.map((p) => p.number), 'PAY-', 5),
      direction: 'outgoing',
      category: 'reimbursement',
      date: stamp.slice(0, 10),
      amount: round2(amount),
      currency: 'LKR',
      method: 'bank_transfer',
      reference: `Reimbursement run — ${claims.length} claim(s) (simulated)`,
      bankAccountId,
      createdAt: stamp,
      updatedAt: stamp,
    }
    useDemoStore.getState().mutate((d) => {
      let next: typeof d = { ...d, payments: [...d.payments, payment] }
      for (const c of claims) next = replaceIn(next, 'expenses', transition(c, 'reimbursed', `Included in ${payment.number} (simulated — no money moved)`))
      return withAudit(next, auditEntry('reimburse', 'expense', `Simulated reimbursement of ${claims.length} claim(s) totalling ${formatCurrency(add(amount))}`))
    })
    return payment
  },
  async addNote(id, text) {
    const e = findExpense(id)
    if (!text.trim()) throw new DemoValidationError('Note cannot be empty.')
    const updated: ExpenseClaim = { ...e, updatedAt: nowStamp(), notes: [...e.notes, { id: newId('note'), at: nowStamp(), by: getActor().name, text: text.trim() }] }
    useDemoStore.getState().mutate((d) => replaceIn(d, 'expenses', updated))
    return updated
  },
}

export const accountRepository = createLocalRepository('accounts', {
  prefix: 'acc',
  entity: 'account',
  label: (a) => `${a.code} ${a.name}`,
  canDelete: (a, db) => (db.journalEntries.some((j) => j.lines.some((l) => l.accountId === a.id)) ? 'This account has journal lines. Deactivate it instead.' : null),
})
export const journalRepository = createLocalRepository('journalEntries', {
  prefix: 'je',
  entity: 'journal_entry',
  label: (j) => j.number,
  canDelete: (j) => (j.status === 'draft' ? null : 'Posted journals cannot be deleted. Reverse them instead.'),
})
export const bankAccountRepository = createLocalRepository('bankAccounts', { prefix: 'bank', entity: 'bank_account' })
export const bankStatementRepository = createLocalRepository('bankStatementLines', { prefix: 'bsl', entity: 'bank_statement_line', label: (l) => l.description })
export const periodRepository = createLocalRepository('periods', { prefix: 'per', entity: 'financial_period' })
export const assetRepository = createLocalRepository('assets', { prefix: 'asset', entity: 'fixed_asset', label: (a) => a.tag })
export const rdRepository = createLocalRepository('rdExpenditure', { prefix: 'rd', entity: 'rd_expenditure', label: (r) => r.description })
export const taxRateRepository = createLocalRepository('taxRates', { prefix: 'tax', entity: 'tax_rate' })
export const currencyRepository = createLocalRepository('currencies', { prefix: 'cur', entity: 'currency', label: (c) => c.code })
export const policyRepository = createLocalRepository('policies', { prefix: 'pol', entity: 'policy', label: (p) => p.title })
