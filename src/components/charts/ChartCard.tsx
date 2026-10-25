import { useState, type ReactNode } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface ChartTableColumn<R> {
  header: string
  value: (row: R) => ReactNode
  align?: 'left' | 'right'
}

/**
 * Card wrapper for every chart. Provides the accessible "view as table"
 * alternative required for charts (identity is never colour alone).
 */
export function ChartCard<R>({
  title,
  description,
  actions,
  children,
  table,
  height = 280,
  className,
  footer,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  table?: { rows: R[]; columns: ChartTableColumn<R>[] }
  height?: number
  className?: string
  footer?: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={cn('bg-card text-card-foreground flex flex-col rounded-2xl shadow-sm ring-1 ring-foreground/[0.06]', className)}>
      <div className="flex items-start justify-between gap-2 px-6 pt-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {table ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} aria-label={asTable ? 'Show chart' : 'Show data as table'} title={asTable ? 'Show chart' : 'Show data as table'}>
              {asTable ? <BarChart3 /> : <Table2 />}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="px-3 pt-3 pb-4">
        {asTable && table ? (
          <div className="max-h-[320px] overflow-auto px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((c) => (
                    <TableHead key={c.header} className={cn('text-xs', c.align === 'right' && 'text-right')}>
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((r, i) => (
                  <TableRow key={i}>
                    {table.columns.map((c) => (
                      <TableCell key={c.header} className={cn('py-1.5 text-xs', c.align === 'right' && 'tabular text-right')}>
                        {c.value(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>
      {footer ? <div className="text-muted-foreground border-t px-5 py-2.5 text-xs">{footer}</div> : null}
    </section>
  )
}
