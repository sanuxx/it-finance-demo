import { Link } from 'react-router-dom'
import { ArrowRight, Database, FileText, GitBranch, LayoutDashboard, ListPlus, Mail, Settings2, Sigma, SlidersHorizontal, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useDb } from '@/hooks/useData'

export default function ConfigurationHomePage() {
  const db = useDb()
  const cards = [
    { to: '/config/master-data', icon: Database, title: 'Master data', desc: 'Categories, departments, cost codes, payment terms and other reference lists.', stat: `${db.masterData.length} records in 12 lists` },
    { to: '/config/custom-fields', icon: ListPlus, title: 'Custom fields', desc: 'Add extra fields to customers, projects, expenses, invoices and suppliers.', stat: `${db.customFields.filter((f) => f.active).length} active fields` },
    { to: '/config/forms', icon: FileText, title: 'Form builder', desc: 'Drag-and-drop request and intake forms with validation and conditional logic.', stat: `${db.forms.length} forms · ${db.forms.filter((f) => f.status === 'published').length} published` },
    { to: '/config/rules', icon: GitBranch, title: 'Rules builder', desc: 'Condition → action rules that flag, notify and escalate. Test them with sample values.', stat: `${db.rules.filter((r) => r.enabled).length} of ${db.rules.length} rules enabled` },
    { to: '/config/workflows', icon: Workflow, title: 'Workflow builder', desc: 'Multi-stage approval workflows with conditional stages and a simulator.', stat: `${db.workflows.length} workflows · ${db.workflowRuns.length} runs` },
    { to: '/config/formulas', icon: Sigma, title: 'Formula builder', desc: 'Safe calculated fields such as gross margin and budget utilisation.', stat: `${db.formulas.length} formulas` },
    { to: '/config/templates', icon: Mail, title: 'Document & email templates', desc: 'Invoice, receipt, statement, PO and notification templates with placeholders.', stat: `${db.templates.length} templates` },
    { to: '/config/dashboard-builder', icon: LayoutDashboard, title: 'Dashboard builder', desc: 'Choose, configure and arrange executive dashboard widgets.', stat: `${db.dashboards[0]?.widgets.length ?? 0} widgets on the executive dashboard` },
    { to: '/config/preferences', icon: Settings2, title: 'System preferences', desc: 'Numbering, default payment terms and tax, fiscal year and display.', stat: 'Organisation defaults' },
  ]
  return (
    <>
      <PageHeader title="Configuration centre" description="Tailor the platform to how your company works — without code. Every builder here is fully interactive." />
      <SimulatedNotice className="mb-5" tone="demo">
        Changes are local demonstration configuration saved in this browser. Some take effect immediately: enabled rules run when expense claims are submitted and purchase orders are sent for approval, and the dashboard layout drives the executive dashboard.
      </SimulatedNotice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ to, icon: Icon, title, desc, stat }) => (
          <Link key={to} to={to} className="group bg-card hover:border-primary/40 flex flex-col rounded-xl border p-5 shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <ArrowRight className="text-muted-foreground ml-auto size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </div>
            <p className="text-muted-foreground mt-3 flex-1 text-sm">{desc}</p>
            <p className="mt-4 text-xs font-medium">{stat}</p>
          </Link>
        ))}
      </div>
      <p className="text-muted-foreground mt-6 flex items-center gap-1.5 text-xs">
        <SlidersHorizontal className="size-3.5" /> Real configuration will be validated, versioned and enforced by the future NestJS backend.
      </p>
    </>
  )
}
