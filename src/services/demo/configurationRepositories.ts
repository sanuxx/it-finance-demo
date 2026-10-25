import type { DashboardConfig, DemoDatabase, WorkflowDefinition, WorkflowRun } from '@/domain'
import { defaultDashboard } from '@/data/seed'
import { SYSTEM_MASTER_IDS } from '@/data/seed/ids'
import type { WorkflowRepository } from '@/services/repositories/types'
import { getDb, newId, useDemoStore } from './demoStore'
import { DemoValidationError, auditEntry, createLocalRepository, nowStamp, replaceIn, withAudit } from './localRepository'

export const masterDataRepository = createLocalRepository('masterData', {
  prefix: 'md',
  entity: 'master_record',
  canDelete: (m) => (SYSTEM_MASTER_IDS.has(m.id) ? 'System records used by calculations cannot be deleted. Deactivate it instead.' : null),
})
export const customFieldRepository = createLocalRepository('customFields', { prefix: 'cf', entity: 'custom_field', label: (f) => f.label })
export const formRepository = createLocalRepository('forms', { prefix: 'form', entity: 'form' })
export const formSubmissionRepository = createLocalRepository('formSubmissions', { prefix: 'sub', entity: 'form_submission', label: (s) => s.id })
export const ruleRepository = createLocalRepository('rules', { prefix: 'rule', entity: 'business_rule' })
export const formulaRepository = createLocalRepository('formulas', { prefix: 'fx', entity: 'formula' })
export const templateRepository = createLocalRepository('templates', { prefix: 'tpl', entity: 'template' })
export const savedReportRepository = createLocalRepository('savedReports', { prefix: 'rep', entity: 'saved_report' })
export const integrationRepository = createLocalRepository('integrations', { prefix: 'int', entity: 'integration' })
export const productRepository = createLocalRepository('products', {
  prefix: 'prod',
  entity: 'product',
  canDelete: (p, db) => (db.subscriptions.some((s) => s.productId === p.id) || db.invoices.some((i) => i.lines.some((l) => l.productId === p.id)) ? 'This product is in use. Deactivate it instead.' : null),
})
export const subscriptionRepository = createLocalRepository('subscriptions', { prefix: 'sub', entity: 'subscription', label: (s) => s.id })
export const cloudCostRepository = createLocalRepository('cloudCosts', { prefix: 'cl', entity: 'cloud_cost', label: (c) => `${c.provider} ${c.service}` })
export const aiUsageRepository = createLocalRepository('aiUsage', { prefix: 'ai', entity: 'ai_usage', label: (a) => `${a.provider} ${a.model}` })
export const licenceRepository = createLocalRepository('licences', { prefix: 'lic', entity: 'software_licence' })
export const userRepository = createLocalRepository('users', { prefix: 'u', entity: 'demo_user', canDelete: (u) => (u.id.startsWith('u-') ? 'Built-in demo users cannot be deleted.' : null) })

const workflowBase = createLocalRepository('workflows', { prefix: 'wf', entity: 'workflow' })

export const workflowRepository: WorkflowRepository = {
  ...workflowBase,
  async publish(id) {
    const wf = getDb().workflows.find((w) => w.id === id)
    if (!wf) throw new DemoValidationError('Workflow not found.')
    if (!wf.stages.length) throw new DemoValidationError('Add at least one stage before publishing.')
    if (!wf.stages.some((s) => s.type === 'approval')) throw new DemoValidationError('A published workflow needs at least one approval stage.')
    const updated: WorkflowDefinition = { ...wf, status: 'published', version: wf.version + 1, updatedAt: nowStamp() }
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'workflows', updated), auditEntry('publish', 'workflow', `Published ${wf.name} v${updated.version} (demo configuration)`, id)))
    return updated
  },
  async recordRun(run) {
    const stamp = nowStamp()
    const record: WorkflowRun = { ...run, id: newId('run'), createdAt: stamp, updatedAt: stamp }
    useDemoStore.getState().mutate((d) => ({ ...d, workflowRuns: [record, ...d.workflowRuns].slice(0, 200) }))
    return record
  },
}

/* ---------------------------------------------------------------- dashboards */

export const dashboardRepository = {
  async get(id = 'dash-executive'): Promise<DashboardConfig> {
    return getDb().dashboards.find((d) => d.id === id) ?? defaultDashboard(nowStamp())
  },
  async save(config: DashboardConfig): Promise<DashboardConfig> {
    const saved = { ...config, updatedAt: nowStamp() }
    useDemoStore.getState().mutate((d) =>
      withAudit(
        { ...d, dashboards: d.dashboards.some((x) => x.id === saved.id) ? d.dashboards.map((x) => (x.id === saved.id ? saved : x)) : [...d.dashboards, saved] },
        auditEntry('update', 'dashboard', `Saved dashboard layout "${saved.name}"`, saved.id),
      ),
    )
    return saved
  },
  async restoreDefault(id = 'dash-executive'): Promise<DashboardConfig> {
    const def = { ...defaultDashboard(nowStamp()), id }
    return dashboardRepository.save(def)
  },
}

/* ------------------------------------------------------------- notifications */

export const notificationRepository = {
  async markRead(id: string) {
    useDemoStore.getState().mutate((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }))
  },
  async markAllRead() {
    useDemoStore.getState().mutate((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }))
  },
  async remove(id: string) {
    useDemoStore.getState().mutate((d) => ({ ...d, notifications: d.notifications.filter((n) => n.id !== id) }))
  },
}

/* --------------------------------------------------------------- organisation */

export const organizationRepository = {
  async get() {
    return getDb().organization
  },
  async update(patch: Partial<DemoDatabase['organization']>) {
    useDemoStore.getState().mutate((d) => withAudit({ ...d, organization: { ...d.organization, ...patch } }, auditEntry('update', 'organization', 'Updated organisation settings')))
    return getDb().organization
  },
}
