import { useMemo } from 'react'
import type { ExpenseClaim } from '@/domain'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { useCurrentUser, usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { expenseRepository } from '@/services'
import { formatCurrency } from '@/lib/formatting'

/** Employee profile that belongs to the signed-in demo user (matched by name), if any. */
export function useMyEmployeeId(): string | undefined {
  const user = useCurrentUser()
  const employees = useCollection('employees')
  return employees.find((e) => e.name === user.name)?.id
}

/**
 * Claims visible to the current demo role. Employees only see their own claims;
 * approvers and finance see everyone's. (UI simulation only.)
 */
export function useVisibleExpenses(): { claims: ExpenseClaim[]; scope: 'mine' | 'all' } {
  const all = useCollection('expenses')
  const user = useCurrentUser()
  const mine = useMyEmployeeId()
  const canApprove = usePermission('expenses.approve')
  const canFinance = usePermission('finance.view')
  return useMemo(() => {
    if (user.role === 'employee' || (!canApprove && !canFinance)) return { claims: all.filter((e) => e.employeeId === mine), scope: 'mine' as const }
    return { claims: all, scope: 'all' as const }
  }, [all, user.role, mine, canApprove, canFinance])
}

export function useExpenseActions() {
  const confirm = useConfirm()
  return {
    async submit(e: ExpenseClaim) {
      const { confirmed } = await confirm({ title: `Submit ${e.number} for approval?`, description: `${formatCurrency(e.amount)} — ${e.description}. Business rules configured in the Configuration centre will be evaluated.`, confirmLabel: 'Submit claim' })
      if (!confirmed) return
      const r = await runWithToast(expenseRepository.submit(e.id))
      if (r) runWithToast(Promise.resolve(), r.flaggedForReview ? `${e.number} submitted — flagged for review by business rules` : `${e.number} submitted for approval`)
      return r
    },
    async approve(e: ExpenseClaim) {
      const { confirmed } = await confirm({ title: `Approve ${e.number}?`, description: `${formatCurrency(e.amount)} — ${e.description}. Simulated approval: this does not authorise a real payment.`, confirmLabel: 'Approve' })
      if (confirmed) return runWithToast(expenseRepository.approve(e.id), `${e.number} approved`)
    },
    async reject(e: ExpenseClaim) {
      const { confirmed, reason } = await confirm({ title: `Reject ${e.number}?`, description: 'The claimant can edit and resubmit a rejected claim.', confirmLabel: 'Reject claim', destructive: true, requireReason: true, reasonLabel: 'Reason for rejection' })
      if (confirmed) return runWithToast(expenseRepository.reject(e.id, reason), `${e.number} rejected`)
    },
    async bulkApprove(claims: ExpenseClaim[]) {
      const eligible = claims.filter((c) => c.status === 'submitted')
      const { confirmed } = await confirm({ title: `Approve ${eligible.length} claim(s)?`, description: `Total ${formatCurrency(eligible.reduce((s, c) => s + c.amount, 0))}. Only submitted claims are affected.`, confirmLabel: 'Approve selected' })
      if (!confirmed) return
      for (const c of eligible) await expenseRepository.approve(c.id, 'Bulk approval')
      runWithToast(Promise.resolve(), `${eligible.length} claim(s) approved`)
    },
    async bulkReject(claims: ExpenseClaim[]) {
      const eligible = claims.filter((c) => c.status === 'submitted')
      const { confirmed, reason } = await confirm({ title: `Reject ${eligible.length} claim(s)?`, confirmLabel: 'Reject selected', destructive: true, requireReason: true, reasonLabel: 'Reason (applied to all)' })
      if (!confirmed) return
      for (const c of eligible) await expenseRepository.reject(c.id, reason)
      runWithToast(Promise.resolve(), `${eligible.length} claim(s) rejected`)
    },
    async remove(e: ExpenseClaim) {
      const { confirmed } = await confirm({ title: `Delete ${e.number}?`, description: 'Only draft or rejected claims can be deleted. This cannot be undone.', destructive: true, confirmLabel: 'Delete claim' })
      if (confirmed) return runWithToast(expenseRepository.remove(e.id).then(() => true), `${e.number} deleted`)
    },
  }
}
