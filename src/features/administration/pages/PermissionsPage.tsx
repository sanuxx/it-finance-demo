import { Check, Minus } from 'lucide-react'
import type { RoleKey } from '@/domain'
import { PageHeader } from '@/components/layout/PageHeader'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROLE_LABELS } from '@/app/state/preferences'
import { PERMISSION_LABELS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { useRole } from '@/hooks/useSession'
import { cn } from '@/lib/utils'

const ROLES = Object.keys(ROLE_LABELS) as RoleKey[]
const GROUPS: { label: string; prefix: string[] }[] = [
  { label: 'Dashboards & finance', prefix: ['dashboard', 'finance', 'ledger', 'periods'] },
  { label: 'Sales & billing', prefix: ['sales', 'invoices', 'payments'] },
  { label: 'Expenses & procurement', prefix: ['expenses', 'procurement'] },
  { label: 'Projects & people', prefix: ['projects', 'costs', 'timesheets'] },
  { label: 'SaaS, planning & assets', prefix: ['saas', 'budgets', 'assets'] },
  { label: 'Reports, configuration & admin', prefix: ['reports', 'config', 'admin'] },
]

export default function PermissionsPage() {
  const currentRole = useRole()
  const perms = Object.keys(PERMISSION_LABELS) as Permission[]
  return (
    <>
      <PageHeader title="Permissions" description="Which screens and actions each demo role can use." />
      <SimulatedNotice className="mb-5" tone="warning">
        UI simulation only. This matrix controls what the demo interface shows; anyone can switch roles and all data lives in their own browser. The future backend will enforce every permission independently.
      </SimulatedNotice>
      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table aria-label="Role permission matrix">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="min-w-64">Permission</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className={cn('text-center', r === currentRole && 'text-primary')}>
                  {ROLE_LABELS[r]}
                  {r === currentRole ? <span className="block text-[10px] font-normal">(current)</span> : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {GROUPS.map((g) => {
              const rows = perms.filter((p) => g.prefix.includes(p.split('.')[0]!))
              return [
                <TableRow key={g.label} className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={ROLES.length + 1} className="text-xs font-semibold">{g.label}</TableCell>
                </TableRow>,
                ...rows.map((p) => (
                  <TableRow key={p}>
                    <TableCell>
                      <div className="text-sm">{PERMISSION_LABELS[p]}</div>
                      <code className="text-muted-foreground text-[11px]">{p}</code>
                    </TableCell>
                    {ROLES.map((r) => {
                      const ok = ROLE_PERMISSIONS[r].includes(p)
                      return (
                        <TableCell key={r} className={cn('text-center', r === currentRole && 'bg-primary/5')}>
                          {ok ? <Check className="text-success mx-auto size-4" aria-label="Allowed" /> : <Minus className="text-muted-foreground/50 mx-auto size-4" aria-label="Not allowed" />}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )),
              ]
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
