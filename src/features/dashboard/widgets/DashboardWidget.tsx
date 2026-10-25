import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CircleDollarSign, Clock, Landmark, PiggyBank, Receipt, Repeat, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import type { DashboardWidget as Widget } from '@/domain'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { Section } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { useCollection, useLookups } from '@/hooks/useData'
import { formatCurrency, formatDate, formatPercent, formatRelative, humanize } from '@/lib/formatting'
import { lastNMonths } from '@/lib/dates'
import { round2 } from '@/lib/calculations/money'
import { cn } from '@/lib/utils'
import { change, type DashboardMetrics } from '../lib/metrics'
import { APPROVAL_KIND_LABEL } from '../lib/approvals'
import { CategoryDonut, IncomeExpenseChart, MonthlyBars } from './charts'
import { SIZE_CLASS } from './catalog'

export function DashboardWidget({ widget, metrics }: { widget: Widget; metrics: DashboardMetrics }) {
  return <div className={cn('min-w-0', SIZE_CLASS[widget.size])}>{renderWidget(widget, metrics)}</div>
}

function renderWidget(w: Widget, m: DashboardMetrics) {
  const cmp = (a: number, b: number) => (m.hasComparison ? change(a, b) : null)
  switch (w.type) {
    case 'kpi_revenue':
      return <StatCard label={w.title} term="Invoiced revenue" icon={<TrendingUp />} value={formatCurrency(m.current.revenue, 'LKR', { compact: true })} delta={cmp(m.current.revenue, m.previous.revenue)} hint={formatCurrency(m.current.revenue)} to="/finance/revenue" />
    case 'kpi_expenses':
      return <StatCard label={w.title} icon={<TrendingDown />} value={formatCurrency(m.current.expenses, 'LKR', { compact: true })} delta={cmp(m.current.expenses, m.previous.expenses)} invertDelta hint={formatCurrency(m.current.expenses)} to="/reports/view/expenses-by-category" />
    case 'kpi_profit':
      return <StatCard label={w.title} term="Net profit" icon={<PiggyBank />} value={formatCurrency(m.current.profit, 'LKR', { compact: true })} delta={cmp(m.current.profit, m.previous.profit)} hint="Before tax · illustrative" to="/reports/view/profit-and-loss" />
    case 'kpi_margin':
      return <StatCard label={w.title} term="Net profit" value={formatPercent(m.current.marginPercent)} hint={m.previous.marginPercent !== null && m.hasComparison ? `Previous period ${formatPercent(m.previous.marginPercent)}` : 'Net profit ÷ revenue'} to="/reports/view/profit-and-loss" />
    case 'kpi_cash':
      return <StatCard label={w.title} term="Cash position" icon={<Landmark />} value={formatCurrency(m.cash, 'LKR', { compact: true })} hint="Simulated bank balances today" to="/finance/banking" />
    case 'kpi_receivables':
      return <StatCard label={w.title} term="Accounts receivable" icon={<Receipt />} value={formatCurrency(m.receivables.outstanding, 'LKR', { compact: true })} hint={`${m.receivables.count} open invoice(s)`} to="/finance/receivables" />
    case 'kpi_payables':
      return <StatCard label={w.title} term="Accounts payable" icon={<Wallet />} value={formatCurrency(m.payables.outstanding, 'LKR', { compact: true })} hint={`${m.payables.count} open bill(s)${m.payables.overdueCount ? ` · ${m.payables.overdueCount} overdue` : ''}`} to="/finance/payables" />
    case 'kpi_overdue':
      return <StatCard label={w.title} icon={<Clock />} value={<span className={m.overdue.count ? 'text-destructive' : undefined}>{m.overdue.count}</span>} hint={`${formatCurrency(m.overdue.amount)} overdue`} to="/sales/invoices?status=overdue" />
    case 'kpi_budget':
      return (
        <StatCard
          label={w.title}
          term="Budget utilisation"
          icon={<CircleDollarSign />}
          value={formatPercent(m.budget.utilisationPercent)}
          hint={m.budget.total ? `${formatCurrency(m.budget.actual, 'LKR', { compact: true })} of ${formatCurrency(m.budget.total, 'LKR', { compact: true })} approved` : 'No approved company budget this year'}
          to="/planning/budgets"
        />
      )
    case 'kpi_mrr':
      return <StatCard label={w.title} term="MRR" icon={<Repeat />} value={formatCurrency(m.mrr, 'LKR', { compact: true })} hint={`ARR ${formatCurrency(m.mrr * 12, 'LKR', { compact: true })}`} to="/saas/metrics" />
    case 'chart_income_expense':
      return <IncomeExpenseChart title={w.title} data={m.monthly.slice(-(w.months ?? 12))} />
    case 'chart_revenue_mix':
      return <CategoryDonut title={w.title} description="Revenue by income category for the selected period." items={m.revenueMix.map((r) => ({ name: r.name, value: r.amount }))} />
    case 'chart_cloud_trend':
      return <CloudTrend title={w.title} months={w.months ?? 12} />
    case 'table_top_projects':
      return <TopProjects title={w.title} metrics={m} />
    case 'table_recent_transactions':
      return <RecentTransactions title={w.title} metrics={m} />
    case 'list_pending_approvals':
      return <PendingApprovals title={w.title} metrics={m} />
    case 'list_upcoming_obligations':
      return <Obligations title={w.title} metrics={m} />
    case 'list_activity':
      return <Activity title={w.title} />
    default:
      return null
  }
}

function CloudTrend({ title, months }: { title: string; months: number }) {
  const cloud = useCollection('cloudCosts')
  const ai = useCollection('aiUsage')
  const data = useMemo(() => {
    const keys = lastNMonths(months)
    return keys.map((month) => ({
      month,
      cloud: round2(cloud.filter((c) => c.month.startsWith(month)).reduce((s, c) => s + c.amount, 0)),
      ai: round2(ai.filter((c) => c.month.startsWith(month)).reduce((s, c) => s + c.amount, 0)),
    }))
  }, [cloud, ai, months])
  return <MonthlyBars title={title} description="Current month is month-to-date." data={data} series={[{ key: 'cloud', label: 'Cloud' }, { key: 'ai', label: 'AI & API' }]} stacked />
}

function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="text-primary text-xs font-medium hover:underline">
      {label}
    </Link>
  )
}

function TopProjects({ title, metrics }: { title: string; metrics: DashboardMetrics }) {
  const rows = metrics.projects.slice(0, 6)
  return (
    <Section title={title} description="Estimated profit = contract value − forecast cost (direct-cost margin, illustrative)." actions={<ViewAll to="/projects/profitability" />} className="h-full">
      <ul className="-my-2 divide-y">
        {rows.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {p.code} · {p.customer}
                </div>
              </div>
              <StatusBadge status={p.fin.health} />
              <div className="w-28 text-right">
                <Money value={p.fin.estimatedProfit} compact className="text-sm font-medium" />
                <div className="text-muted-foreground text-xs">{formatPercent(p.fin.estimatedMarginPercent)} margin</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function RecentTransactions({ title, metrics }: { title: string; metrics: DashboardMetrics }) {
  const l = useLookups()
  return (
    <Section title={title} description="Simulated — no money was moved." actions={<ViewAll to="/finance/transactions" />} className="h-full">
      <ul className="-my-2 divide-y">
        {metrics.recentPayments.slice(0, 7).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', p.direction === 'incoming' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
              <Banknote className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{p.customerId ? l.customer(p.customerId) : p.supplierId ? l.supplier(p.supplierId) : (p.reference ?? humanize(p.category))}</div>
              <div className="text-muted-foreground truncate text-xs">
                {formatDate(p.date)} · {humanize(p.category)}
              </div>
            </div>
            <span className={cn('tabular text-sm font-medium', p.direction === 'incoming' ? 'text-success' : '')}>
              {p.direction === 'incoming' ? '+' : '−'}
              {formatCurrency(p.amount)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function PendingApprovals({ title, metrics }: { title: string; metrics: DashboardMetrics }) {
  const items = metrics.approvals
  return (
    <Section title={title} description={`${items.length} waiting · simulated approvals`} actions={<ViewAll to="/approvals" label="Open inbox" />} className="h-full">
      {items.length ? (
        <ul className="-my-2 divide-y">
          {items.slice(0, 6).map((a) => (
            <li key={`${a.kind}:${a.id}`}>
              <Link to={a.link} className="hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    <span className="font-medium">{a.number}</span> · {a.title}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {APPROVAL_KIND_LABEL[a.kind]} · {a.requester} · {formatDate(a.date)}
                  </div>
                </div>
                {a.flagged ? <Badge variant="outline" className="border-warning/40 text-[10px]">Flagged</Badge> : null}
                <Money value={a.amount} className="text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Nothing is waiting for approval.</p>
      )}
    </Section>
  )
}

function Obligations({ title, metrics }: { title: string; metrics: DashboardMetrics }) {
  return (
    <Section title={title} description="Due in the next 30 days, plus anything overdue." className="h-full">
      <ul className="-my-2 divide-y">
        {metrics.obligations.slice(0, 7).map((o) => (
          <li key={o.id}>
            <Link to={o.link} className="hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
              <div className="w-16 shrink-0 text-xs">
                <div className={cn('font-medium', o.overdue && 'text-destructive')}>{formatDate(o.date, 'dd MMM')}</div>
                {o.overdue ? <div className="text-destructive">Overdue</div> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{o.label}</div>
                <div className="text-muted-foreground truncate text-xs">{o.detail}</div>
              </div>
              <div className="text-right">
                <Money value={o.amount} className="text-sm" />
                {o.estimate ? <div className="text-muted-foreground text-[10px] uppercase">Estimate</div> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Activity({ title }: { title: string }) {
  const log = useCollection('auditLog')
  return (
    <Section title={title} actions={<ViewAll to="/admin/audit-log" />} className="h-full">
      <ul className="-my-1 space-y-3">
        {log.slice(0, 7).map((a) => (
          <li key={a.id} className="flex gap-3 text-sm">
            <span className="bg-primary/60 mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
            <div className="min-w-0">
              <div className="leading-snug">{a.summary}</div>
              <div className="text-muted-foreground text-xs">
                {a.actor} · {formatRelative(a.at)}
              </div>
            </div>
          </li>
        ))}
        {!log.length ? <li className="text-muted-foreground text-sm">No activity yet.</li> : null}
      </ul>
    </Section>
  )
}

