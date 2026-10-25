import { Link } from 'react-router-dom'
import { LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { EmptyState } from '@/components/feedback/Feedback'
import { usePreferences } from '@/app/state/preferences'
import { useCollection } from '@/hooks/useData'
import { useCurrentUser, usePermission } from '@/hooks/useSession'
import { DATE_PRESET_LABELS } from '@/lib/dates'
import { defaultDashboard } from '@/data/seed'
import { DashboardWidget } from '../widgets/DashboardWidget'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { useNow } from '@/hooks/useNow'

export default function ExecutiveDashboardPage() {
  const now = useNow()
  const preset = usePreferences((s) => s.dashboardPreset)
  const set = usePreferences((s) => s.set)
  const dashboards = useCollection('dashboards')
  const user = useCurrentUser()
  const canConfigure = usePermission('config.edit')
  const config = dashboards.find((d) => d.id === 'dash-executive') ?? defaultDashboard(now.toISOString())
  const metrics = useDashboardMetrics(preset)

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${user.name.split(' ')[0]}`}
        description={`Executive overview for ${DATE_PRESET_LABELS[preset].toLowerCase()}. Every figure is calculated from the demo records — click a card to see the records behind it.`}
        actions={
          <>
            <DateRangeSelect value={preset} onChange={(v) => set({ dashboardPreset: v })} />
            {canConfigure ? (
              <Button variant="outline" size="sm" className="h-9" asChild>
                <Link to="/config/dashboard-builder">
                  <LayoutGrid /> Customise
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {config.widgets.length ? (
        <div className="grid grid-cols-4 gap-4">
          {config.widgets.map((w) => (
            <DashboardWidget key={w.id} widget={w} metrics={metrics} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="This dashboard has no widgets"
          description="Add widgets in the dashboard builder."
          action={
            <Button size="sm" asChild>
              <Link to="/config/dashboard-builder">
                <Plus /> Add widgets
              </Link>
            </Button>
          }
        />
      )}
      <p className="text-muted-foreground mt-6 text-xs">
        {metrics.hasComparison ? 'Changes compare with the equally long period immediately before. ' : ''}Revenue is invoiced revenue net of tax; expenses include accrued personnel, licence and depreciation costs. Figures are illustrative and not statutory financial statements.
      </p>
    </>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}
