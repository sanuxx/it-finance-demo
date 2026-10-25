import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GLOSSARY } from '@/lib/glossary'
import { cn } from '@/lib/utils'

/** Inline label with a keyboard-accessible definition tooltip. */
export function Term({ term, children, definition, className }: { term: string; children?: ReactNode; definition?: string; className?: string }) {
  const text = definition ?? GLOSSARY[term]
  if (!text) return <>{children ?? term}</>
  return (
    <span className={cn('group/term inline-flex items-center gap-1', className)}>
      {children ?? term}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground rounded-sm opacity-0 transition-opacity [@media(hover:none)]:opacity-50 group-hover/term:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring outline-none" aria-label={`What is ${term}?`}>
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </span>
  )
}
