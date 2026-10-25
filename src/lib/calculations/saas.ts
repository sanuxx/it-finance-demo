import { addMonths, format, parseISO } from 'date-fns'
import type { CustomerSubscription, DemoDatabase } from '@/domain'
import { divide, multiply, percentOf, subtract, sum } from './money'
import { todayISO } from '@/lib/dates'

/** Monthly recurring revenue contribution of a single subscription. */
export function subscriptionMrr(s: Pick<CustomerSubscription, 'seats' | 'unitPrice' | 'billingCycle'>): number {
  const cycleValue = multiply(s.seats, s.unitPrice)
  return s.billingCycle === 'annual' ? divide(cycleValue, 12) : cycleValue
}

/** Was the subscription generating revenue on the given date? Trials are excluded. */
export function isSubscriptionLive(s: CustomerSubscription, date: string): boolean {
  if (s.status === 'trial') return false
  if (s.startDate > date) return false
  if (s.cancelledDate && s.cancelledDate <= date) return false
  return true
}

export function mrrAt(subs: CustomerSubscription[], date: string, productId?: string): number {
  return sum(
    subs.filter((s) => isSubscriptionLive(s, date) && (!productId || s.productId === productId)),
    subscriptionMrr,
  )
}

export interface SaasMetrics {
  mrr: number
  arr: number
  activeSubscriptions: number
  trialSubscriptions: number
  customers: number
  arpa: number
  /** Logo churn over the trailing 3 months, percent. */
  churnRatePercent: number | null
  /** Net revenue retention estimate over 12 months, percent. Illustrative. */
  nrrPercent: number | null
  renewalsNext30Days: CustomerSubscription[]
}

export function saasMetrics(subs: CustomerSubscription[], asOf: string = todayISO()): SaasMetrics {
  const live = subs.filter((s) => isSubscriptionLive(s, asOf))
  const mrr = sum(live, subscriptionMrr)
  const customers = new Set(live.map((s) => s.customerId)).size
  const threeMonthsAgo = format(addMonths(parseISO(asOf), -3), 'yyyy-MM-dd')
  const liveThen = subs.filter((s) => isSubscriptionLive(s, threeMonthsAgo))
  const churned = liveThen.filter((s) => s.cancelledDate && s.cancelledDate > threeMonthsAgo && s.cancelledDate <= asOf)
  const yearAgo = format(addMonths(parseISO(asOf), -12), 'yyyy-MM-dd')
  const cohort = subs.filter((s) => isSubscriptionLive(s, yearAgo))
  const cohortThen = sum(cohort, subscriptionMrr)
  const cohortNow = sum(
    cohort.filter((s) => isSubscriptionLive(s, asOf)),
    subscriptionMrr,
  )
  const in30 = format(addMonths(parseISO(asOf), 1), 'yyyy-MM-dd')
  return {
    mrr,
    arr: multiply(mrr, 12),
    activeSubscriptions: live.length,
    trialSubscriptions: subs.filter((s) => s.status === 'trial').length,
    customers,
    arpa: customers ? divide(mrr, customers) : 0,
    churnRatePercent: percentOf(churned.length, liveThen.length),
    nrrPercent: percentOf(cohortNow, cohortThen),
    renewalsNext30Days: live.filter((s) => s.renewalDate >= asOf && s.renewalDate <= in30),
  }
}

export function mrrTrend(subs: CustomerSubscription[], months: string[]) {
  return months.map((m) => {
    const endOfMonth = format(addMonths(parseISO(`${m}-01`), 1), 'yyyy-MM-dd')
    const date = subtractDay(endOfMonth)
    return { month: m, mrr: mrrAt(subs, date) }
  })
}

function subtractDay(iso: string) {
  const d = parseISO(iso)
  d.setDate(d.getDate() - 1)
  return format(d, 'yyyy-MM-dd')
}

/** Illustrative product profitability: MRR × months vs. attributed cloud + AI cost. */
export function productProfitability(db: Pick<DemoDatabase, 'products' | 'subscriptions' | 'cloudCosts' | 'aiUsage'>, months: string[]) {
  return db.products
    .filter((p) => p.kind === 'saas')
    .map((p) => {
      const revenue = sum(mrrTrend(db.subscriptions.filter((s) => s.productId === p.id), months), (m) => m.mrr)
      const cloud = sum(
        db.cloudCosts.filter((c) => c.productId === p.id && months.includes(c.month.slice(0, 7))),
        (c) => c.amount,
      )
      const ai = sum(
        db.aiUsage.filter((a) => a.productId === p.id && months.includes(a.month.slice(0, 7))),
        (a) => a.amount,
      )
      const cost = cloud + ai
      return {
        product: p,
        revenue,
        cloud,
        ai,
        grossProfit: subtract(revenue, cost),
        grossMarginPercent: percentOf(subtract(revenue, cost), revenue),
      }
    })
}
