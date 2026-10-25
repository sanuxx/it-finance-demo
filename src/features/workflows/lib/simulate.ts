import type { WorkflowDefinition, WorkflowRunStep, WorkflowStage, WorkflowStageCondition } from '@/domain'

export type StageDecision = 'approved' | 'rejected'

export interface SimulationResult {
  steps: WorkflowRunStep[]
  outcome: 'approved' | 'rejected'
}

const OPERATOR_LABEL: Record<WorkflowStageCondition['operator'], string> = { gte: '≥', lt: '<', eq: '=' }

export function describeCondition(c: WorkflowStageCondition): string {
  return `${c.field} ${OPERATOR_LABEL[c.operator]} ${typeof c.value === 'number' ? c.value.toLocaleString('en-LK') : c.value}`
}

export function conditionHolds(c: WorkflowStageCondition, sample: Record<string, string | number>): boolean {
  const actual = sample[c.field]
  if (c.operator === 'eq') return String(actual ?? '') === String(c.value)
  const a = Number(actual)
  const b = Number(c.value)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return c.operator === 'gte' ? a >= b : a < b
}

/**
 * Walk the stages in order. A stage whose condition fails is skipped with a
 * reason. Approval/review stages take the decision chosen for that stage
 * (default approve); the first rejection ends the run. Notification stages
 * always "notify". Browser-side simulation only — authorises nothing.
 */
export function simulateWorkflow(
  workflow: Pick<WorkflowDefinition, 'stages'>,
  sample: Record<string, string | number>,
  decisions: Record<string, StageDecision> = {},
  at: () => string = () => new Date().toISOString(),
): SimulationResult {
  const steps: WorkflowRunStep[] = []
  let rejected = false
  for (const stage of workflow.stages) {
    const base = { stageId: stage.id, stageName: stage.name, assigneeRole: stage.assigneeRole, at: at() }
    if (rejected) {
      steps.push({ ...base, outcome: 'skipped', reason: 'Not reached — an earlier stage rejected the request' })
      continue
    }
    if (stage.condition && !conditionHolds(stage.condition, sample)) {
      steps.push({ ...base, outcome: 'skipped', reason: `Condition not met (${describeCondition(stage.condition)})` })
      continue
    }
    if (stage.type === 'notification') {
      steps.push({ ...base, outcome: 'notified', reason: 'Simulated notification — nothing was sent' })
      continue
    }
    const decision = decisions[stage.id] ?? 'approved'
    steps.push({ ...base, outcome: decision })
    if (decision === 'rejected') rejected = true
  }
  return { steps, outcome: rejected ? 'rejected' : 'approved' }
}

export function stageNeedsDecision(stage: WorkflowStage): boolean {
  return stage.type !== 'notification'
}
