import type {
  Budget,
  BudgetStatus,
  CollectionItem,
  CollectionKey,
  CreditNote,
  ExpenseClaim,
  ID,
  Invoice,
  Payment,
  PaymentMethod,
  Project,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseRequest,
  SupplierBill,
  WorkflowDefinition,
  WorkflowRun,
} from '@/domain'

/**
 * Data-access contracts.
 *
 * Every method is async so the demo (localStorage) implementation in
 * `src/services/demo` can later be swapped for REST adapters that call the
 * NestJS backend without changing page components. See
 * docs/FRONTEND_ARCHITECTURE.md → "API integration boundary".
 */

export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>

export interface ListQuery<T> {
  search?: string
  filter?: (item: T) => boolean
}

export interface Repository<T extends { id: ID }> {
  list(query?: ListQuery<T>): Promise<T[]>
  get(id: ID): Promise<T | undefined>
  create(input: CreateInput<T>): Promise<T>
  update(id: ID, patch: UpdateInput<T>): Promise<T>
  remove(id: ID): Promise<void>
}

export type CollectionRepository<K extends CollectionKey> = Repository<CollectionItem<K>>

export interface RecordPaymentInput {
  date: string
  amount: number
  method: PaymentMethod
  bankAccountId: ID
  reference?: string
  notes?: string
}

export interface InvoiceRepository extends Repository<Invoice> {
  issue(id: ID): Promise<Invoice>
  void(id: ID, reason: string): Promise<Invoice>
  duplicate(id: ID): Promise<Invoice>
  /** Simulated receipt — validated against the outstanding balance. */
  recordPayment(id: ID, input: RecordPaymentInput): Promise<Payment>
  createCreditNote(id: ID, input: { amount: number; reason: string; date: string }): Promise<CreditNote>
}

export interface SupplierBillRepository extends Repository<SupplierBill> {
  submitForApproval(id: ID): Promise<SupplierBill>
  approve(id: ID, note?: string): Promise<SupplierBill>
  void(id: ID, reason: string): Promise<SupplierBill>
  recordPayment(id: ID, input: RecordPaymentInput): Promise<Payment>
}

export interface ExpenseRepository extends Repository<ExpenseClaim> {
  submit(id: ID): Promise<ExpenseClaim>
  approve(id: ID, note?: string): Promise<ExpenseClaim>
  reject(id: ID, reason: string): Promise<ExpenseClaim>
  reimburse(ids: ID[], bankAccountId: ID): Promise<Payment | undefined>
  addNote(id: ID, text: string): Promise<ExpenseClaim>
}

export interface PurchaseRequestRepository extends Repository<PurchaseRequest> {
  transition(id: ID, status: PurchaseRequest['status'], note?: string): Promise<PurchaseRequest>
  convertToOrder(id: ID): Promise<PurchaseOrder>
}

export interface PurchaseOrderRepository extends Repository<PurchaseOrder> {
  transition(id: ID, status: PurchaseOrderStatus, note?: string): Promise<PurchaseOrder>
}

export interface ProjectRepository extends Repository<Project> {
  setStatus(id: ID, status: Project['status']): Promise<Project>
}

export interface BudgetRepository extends Repository<Budget> {
  setStatus(id: ID, status: BudgetStatus, note?: string): Promise<Budget>
  duplicate(id: ID, fiscalYear: number): Promise<Budget>
}

export interface WorkflowRepository extends Repository<WorkflowDefinition> {
  publish(id: ID): Promise<WorkflowDefinition>
  recordRun(run: Omit<WorkflowRun, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowRun>
}
