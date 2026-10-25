/** Shared primitives used by every domain module. */

/** ISO date string, `yyyy-MM-dd`. */
export type ISODate = string
/** ISO timestamp string. */
export type ISODateTime = string
export type ID = string

export type CurrencyCode = 'LKR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'SGD' | 'INR'

export interface BaseRecord {
  id: ID
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface StatusChange<S extends string = string> {
  status: S
  at: ISODateTime
  by: string
  note?: string
}

export interface NoteEntry {
  id: ID
  at: ISODateTime
  by: string
  text: string
}

/** Demo attachment metadata only — file bytes are never stored. */
export interface DemoAttachment {
  id: ID
  name: string
  sizeKb: number
  mimeType: string
  addedAt: ISODateTime
}

export type RoleKey = 'director' | 'finance_manager' | 'accountant' | 'project_manager' | 'employee'

export interface DemoUser {
  id: ID
  name: string
  email: string
  role: RoleKey
  title: string
  department: string
  initials: string
}

export interface Organization {
  id: ID
  name: string
  legalName: string
  registrationNo: string
  taxId: string
  baseCurrency: CurrencyCode
  fiscalYearStartMonth: number // 1-12
  address: string
  phone: string
  email: string
  website: string
  timezone: string
}
