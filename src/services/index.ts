/**
 * Service registry — the single import point for data access in feature code.
 *
 * Today every service is backed by the browser-side demo store. When the
 * NestJS API exists, swap individual entries for REST adapters that implement
 * the same interfaces (see src/services/api/README.md and
 * docs/FRONTEND_ARCHITECTURE.md). Page components do not need to change.
 */
export * from './demo/billingRepositories'
export * from './demo/financeRepositories'
export * from './demo/procurementRepositories'
export * from './demo/projectRepositories'
export * from './demo/configurationRepositories'
export { DemoValidationError } from './demo/localRepository'
export { useDemoStore, flushPendingSave, newId, nextNumber } from './demo/demoStore'
export type * from './repositories/types'
