import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './useConfirm'

/** Promise-based confirmation dialog: `const { confirmed, reason } = await confirm({...})`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [reason, setReason] = useState('')
  const resolver = useRef<((v: { confirmed: boolean; reason: string }) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    setReason('')
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (confirmed: boolean) => {
    resolver.current?.({ confirmed, reason })
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description ? <AlertDialogDescription asChild><div>{options.description}</div></AlertDialogDescription> : null}
          </AlertDialogHeader>
          {options?.requireReason ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-reason">{options.reasonLabel ?? 'Reason'}</Label>
              <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{options?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(options?.destructive && buttonVariants({ variant: 'destructive' }))}
              disabled={options?.requireReason && !reason.trim()}
              onClick={(e) => {
                e.preventDefault()
                close(true)
              }}
            >
              {options?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
