import type { BaseRecord, CurrencyCode, ID, ISODate } from '../shared/types'

export interface SoftwareProduct extends BaseRecord {
  code: string
  name: string
  description: string
  kind: 'saas' | 'service' | 'licence'
  /** Income category (master data) that revenue from this product rolls up to. */
  incomeCategoryId: ID
  active: boolean
  plans: ProductPlan[]
}

export interface ProductPlan {
  id: ID
  name: string
  monthlyPrice: number
  annualPrice: number
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled'

export interface CustomerSubscription extends BaseRecord {
  customerId: ID
  productId: ID
  planId: ID
  billingCycle: 'monthly' | 'annual'
  seats: number
  /** Price per seat per billing cycle. */
  unitPrice: number
  startDate: ISODate
  renewalDate: ISODate
  cancelledDate?: ISODate
  status: SubscriptionStatus
}

export type CloudProvider = 'AWS' | 'Azure' | 'Google Cloud' | 'DigitalOcean' | 'Cloudflare'
export type CloudCategory = 'compute' | 'storage' | 'database' | 'bandwidth' | 'monitoring' | 'networking' | 'other'

export interface CloudCostEntry extends BaseRecord {
  provider: CloudProvider
  service: string
  category: CloudCategory
  month: ISODate // first day of month
  amount: number
  currency: CurrencyCode
  projectId?: ID
  productId?: ID
  departmentId?: ID
  environment: 'production' | 'staging' | 'development'
}

export interface AiUsageEntry extends BaseRecord {
  provider: string
  model: string
  month: ISODate
  requests: number
  inputTokens: number
  outputTokens: number
  amount: number
  projectId?: ID
  productId?: ID
  useCase: string
}

export interface SoftwareLicence extends BaseRecord {
  name: string
  vendorId: ID
  seats: number
  seatsUsed: number
  costPerSeat: number
  billingCycle: 'monthly' | 'annual'
  startDate: ISODate
  renewalDate: ISODate
  departmentId: ID
  category: 'development' | 'design' | 'productivity' | 'security' | 'infrastructure' | 'finance'
  status: 'active' | 'cancelled' | 'trial'
}
