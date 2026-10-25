import { createContext, useContext, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Ask for a reason (e.g. rejection). The text is returned from `confirm`. */
  requireReason?: boolean
  reasonLabel?: string
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<{ confirmed: boolean; reason: string }>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
