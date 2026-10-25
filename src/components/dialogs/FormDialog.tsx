import type { FormEventHandler, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/** Dialog containing a form. Pass `onSubmit={form.handleSubmit(save)}`. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Save',
  pending,
  size = 'md',
  footerExtra,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  submitLabel?: string
  pending?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footerExtra?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', size === 'sm' && 'sm:max-w-md', size === 'md' && 'sm:max-w-lg', size === 'lg' && 'sm:max-w-2xl', size === 'xl' && 'sm:max-w-4xl')}>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-4">{children}</div>
          <DialogFooter className="gap-2">
            {footerExtra}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Side drawer for record details. */
export function RecordSheet({ open, onOpenChange, title, description, children, actions, wide }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('w-full gap-0 overflow-y-auto sm:max-w-lg', wide && 'sm:max-w-2xl')}>
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription asChild><div>{description}</div></SheetDescription> : null}
          {actions ? <div className="flex flex-wrap gap-2 pt-2">{actions}</div> : null}
        </SheetHeader>
        <div className="space-y-6 p-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
