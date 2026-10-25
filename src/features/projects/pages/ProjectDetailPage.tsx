import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Pencil } from 'lucide-react'
import type { ProjectStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, EstimateTag } from '@/components/feedback/Feedback'
import { useDbSlice, useLookups, useProjectFinancials, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { projectRepository } from '@/services'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import { OverviewTab } from '../components/detail/OverviewTab'
import { BudgetTab } from '../components/detail/BudgetTab'
import { CostsTab } from '../components/detail/CostsTab'
import { BillingTab } from '../components/detail/BillingTab'
import { TeamTab } from '../components/detail/TeamTab'
import { MilestonesTab } from '../components/detail/MilestonesTab'
import { ActivityTab } from '../components/detail/ActivityTab'
import { BILLING_MODEL_LABELS, PROJECT_STATUS_LABELS } from '../lib/labels'
import { projectCostLines } from '../lib/projectCosts'

const TABS = ['overview', 'budget', 'costs', 'billing', 'team', 'milestones', 'activity'] as const

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const project = useRecord('projects', id)
  const fins = useProjectFinancials()
  const lookups = useLookups()
  const canEdit = usePermission('projects.edit')
  const costDb = useDbSlice('projectCosts', 'timesheets', 'employees', 'expenses', 'supplierBills', 'cloudCosts', 'aiUsage')
  const [editOpen, setEditOpen] = useState(false)
  const lines = useMemo(() => (project ? projectCostLines(project, costDb) : []), [project, costDb])
  const tab = TABS.includes(params.get('tab') as (typeof TABS)[number]) ? (params.get('tab') as string) : 'overview'

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="It may have been deleted, or the demo data was reset."
        action={
          <Button asChild size="sm">
            <Link to="/projects">Back to projects</Link>
          </Button>
        }
        className="mt-10"
      />
    )
  }
  const fin = fins.get(project.id)!

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground mb-2 -ml-2">
        <Link to="/projects">
          <ArrowLeft /> Projects
        </Link>
      </Button>
      <PageHeader
        title={project.name}
        description={`${project.code} · ${project.isInternal ? 'Internal project' : lookups.customer(project.customerId)} · ${BILLING_MODEL_LABELS[project.billingModel]} · PM ${lookups.employee(project.managerId)}`}
        meta={
          <>
            <StatusBadge status={project.status} />
            <StatusBadge status={fin.health} />
            <EstimateTag label="Forecasts are illustrative" />
          </>
        }
        actions={
          canEdit ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Status <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[])
                    .filter((s) => s !== project.status)
                    .map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => runWithToast(projectRepository.setStatus(project.id, s), `Status changed to ${PROJECT_STATUS_LABELS[s].toLowerCase()}`)}>
                        Mark {PROJECT_STATUS_LABELS[s].toLowerCase()}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setEditOpen(true)}>
                <Pencil /> Edit project
              </Button>
            </>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="mb-4 overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="costs">Cost breakdown</TabsTrigger>
            <TabsTrigger value="billing">Revenue & billing</TabsTrigger>
            <TabsTrigger value="team">Team costing</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="activity">Financial activity</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <OverviewTab project={project} fin={fin} lines={lines} />
        </TabsContent>
        <TabsContent value="budget">
          <BudgetTab project={project} fin={fin} canEdit={canEdit} onEdit={() => setEditOpen(true)} />
        </TabsContent>
        <TabsContent value="costs">
          <CostsTab project={project} fin={fin} lines={lines} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab project={project} fin={fin} />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab project={project} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="milestones">
          <MilestonesTab project={project} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab project={project} />
        </TabsContent>
      </Tabs>
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
    </>
  )
}
