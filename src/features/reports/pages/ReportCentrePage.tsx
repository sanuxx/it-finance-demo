import { Link } from 'react-router-dom'
import { BarChart3, BookOpen, Boxes, Briefcase, ChevronRight, Coins, FileStack, Landmark, Lock, PieChart, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection } from '@/hooks/useData'
import { useCan } from '@/hooks/useSession'
import { REPORTS, REPORT_GROUPS, type ReportGroup } from '../registry'

const GROUP_ICON: Record<ReportGroup, typeof BookOpen> = {
  'Financial statements': Landmark,
  'Receivables & payables': Coins,
  'Project reports': Briefcase,
  'Customer & product': PieChart,
  'Cost analysis': BarChart3,
  'Budget & forecast': Target,
  Assets: Boxes,
}

export default function ReportCentrePage() {
  const can = useCan()
  const saved = useCollection('savedReports')
  return (
    <>
      <PageHeader
        title="Report centre"
        description="Financial statements, project, customer, product, cost, budget and forecast reports — all calculated from the demo records."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/reports/saved">
                <FileStack /> Saved reports ({saved.length})
              </Link>
            </Button>
            {can('reports.build') ? (
              <Button asChild>
                <Link to="/reports/builder">
                  <Plus /> Build a report
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <SimulatedNotice tone="demo" className="mb-6">
        Reports are illustrative and are not legally compliant financial statements.
      </SimulatedNotice>
      <div className="space-y-8">
        {REPORT_GROUPS.map((group) => {
          const reports = REPORTS.filter((r) => r.group === group)
          if (!reports.length) return null
          const Icon = GROUP_ICON[group]
          return (
            <section key={group} aria-labelledby={`grp-${group}`}>
              <h2 id={`grp-${group}`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Icon className="text-muted-foreground size-4" /> {group}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {reports.map((r) => {
                  const locked = r.permission && !can(r.permission)
                  return (
                    <li key={r.key}>
                      <Link to={`/reports/view/${r.key}`} className="bg-card hover:border-primary/40 hover:bg-accent/30 group flex h-full items-start gap-3 rounded-xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {r.title}
                            {locked ? <Lock className="text-muted-foreground size-3.5" aria-label="Restricted for your role" /> : null}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{r.description}</p>
                          <p className="text-muted-foreground mt-2 text-[11px] uppercase">{r.dateMode === 'range' ? 'Date range filter' : 'As at today'}</p>
                        </div>
                        <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
