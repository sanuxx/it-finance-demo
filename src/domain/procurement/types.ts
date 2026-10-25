import type { BaseRecord, CurrencyCode, ID, ISODate, StatusChange } from '../shared/types'
import type { LineItem } from '../billing/types'

export type PurchaseRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted'

export interface PurchaseRequest extends BaseRecord {
  number: string
  title: string
  requesterId: ID
  departmentId: ID
  projectId?: ID
  supplierId?: ID
  estimatedAmount: number
  neededBy: ISODate
  justification: string
  status: PurchaseRequestStatus
  history: StatusChange<PurchaseRequestStatus>[]
}

export type PurchaseOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'received' | 'closed' | 'cancelled'

export interface PurchaseOrder extends BaseRecord {
  number: string
  supplierId: ID
  requestId?: ID
  projectId?: ID
  departmentId: ID
  orderDate: ISODate
  expectedDate: ISODate
  currency: CurrencyCode
  lines: LineItem[]
  status: PurchaseOrderStatus
  history: StatusChange<PurchaseOrderStatus>[]
}

export type BillStatus = 'draft' | 'awaiting_approval' | 'approved' | 'partially_paid' | 'paid' | 'void'

export interface SupplierBill extends BaseRecord {
  number: string
  supplierReference: string
  supplierId: ID
  purchaseOrderId?: ID
  projectId?: ID
  departmentId: ID
  categoryId: ID
  billDate: ISODate
  dueDate: ISODate
  currency: CurrencyCode
  subtotal: number
  taxAmount: number
  status: BillStatus
  history: StatusChange<BillStatus>[]
  description: string
}
