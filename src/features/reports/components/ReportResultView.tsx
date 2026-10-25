import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { formatCurrency } from '@/lib/formatting'
import { monthLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { CategoryDonut } from '@/features/dashboard/widgets/charts'
import type { CellFormat, ReportChart, ReportColumn, ReportResult, ReportRow } from '../registry'
import { formatCell } from '../lib/reportFormat'

const numericFormats: CellFormat[] = ['currency', 'percent', 'number']

export function ReportTable({ columns, rows, totals, caption }: { columns: ReportColumn[]; rows: ReportRow[]; totals?: ReportRow; caption: string }) {
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <Table aria-label={caption}>
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn('text-muted-foreground text-xs font-medium', numericFormats.includes(c.format ?? 'text') && 'text-right')}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((r, i) => (
              <TableRow key={i} className={cn(r._kind === 'section' && 'bg-muted/30 hover:bg-muted/30', r._kind === 'subtotal' && 'font-semibold')}>
                {columns.map((c, ci) => (
                  <TableCell key={c.key} className={cn('py-2', numericFormats.includes(c.format ?? 'text') && 'tabular text-right', r._kind === 'section' && 'text-xs font-semibold tracking-wide uppercase', ci === 0 && r._kind !== 'section' && r._kind !== 'subtotal' && columns[0]?.key === 'line' && 'pl-6')}>
                    {r._kind === 'section' && ci > 0 ? '' : formatCell(r[c.key], c.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground py-8 text-center text-sm">
                No data for the selected filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {totals ? (
          <TableFooter>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn('font-semibold', numericFormats.includes(c.format ?? 'text') && 'tabular text-right')}>
                  {totals[c.key] === undefined ? '' : formatCell(totals[c.key], c.format)}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  )
}

export function ReportChartView({ chart, title }: { chart: ReportChart; title: string }) {
  const series = chart.series.slice(0, 8)
  const xFmt = chart.xFormat === 'month' ? monthLabel : undefined
  const tableCols = [
    { header: 'Label', value: (r: Record<string, string | number>) => formatCell(r[chart.x], chart.xFormat) },
    ...series.map((s) => ({ header: s.label, value: (r: Record<string, string | number>) => formatCurrency(Number(r[s.key] ?? 0)), align: 'right' as const })),
  ]
  if (chart.type === 'pie') {
    return <CategoryDonut title={title} items={chart.rows.map((r) => ({ name: String(r[chart.x]), value: Number(r[series[0]!.key] ?? 0) }))} />
  }
  return (
    <ChartCard title={title} height={300} table={{ rows: chart.rows, columns: tableCols }}>
      <div className="flex h-full flex-col">
        {series.length > 1 ? <ChartLegend items={series.map((s, i) => ({ label: s.label, color: seriesColor(i) }))} /> : null}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === 'line' ? (
              <LineChart data={chart.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey={chart.x} tickFormatter={xFmt} {...axisProps} />
                <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatCell(l, chart.xFormat)} />} />
                {series.map((s, i) => (
                  <Line key={s.key} dataKey={s.key} name={s.label} stroke={seriesColor(i)} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chart.rows} barGap={2} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey={chart.x} tickFormatter={xFmt ?? ((v: string) => (String(v).length > 14 ? `${String(v).slice(0, 13)}…` : String(v)))} {...axisProps} interval="preserveStartEnd" />
                <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatCell(l, chart.xFormat)} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                {series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={seriesColor(i)}
                    stackId={chart.type === 'stacked' ? 'a' : undefined}
                    radius={chart.type === 'stacked' ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                    stroke={chart.type === 'stacked' ? 'var(--card)' : undefined}
                    maxBarSize={36}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}

export function ReportResultView({ result, title, showChart = true }: { result: ReportResult; title: string; showChart?: boolean }) {
  return (
    <div className="space-y-4">
      {result.summary?.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {result.summary.slice(0, 8).map((s) => (
            <Card key={s.label} className="gap-1 p-4">
              <div className="text-muted-foreground text-xs font-medium capitalize">{s.label}</div>
              <div className="tabular text-lg font-semibold">{formatCell(s.value, s.format)}</div>
            </Card>
          ))}
        </div>
      ) : null}
      {result.check ? (
        <div role="status" className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', result.check.ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
          {result.check.ok ? <CheckCircle2 className="text-success size-4" /> : <XCircle className="text-destructive size-4" />}
          {result.check.message}
        </div>
      ) : null}
      {showChart && result.chart && result.chart.rows.length ? (
        <div className="print:break-inside-avoid">
          <ReportChartView chart={result.chart} title={title} />
        </div>
      ) : null}
      <ReportTable columns={result.columns} rows={result.rows} totals={result.totals} caption={title} />
      {result.notes?.map((n) => (
        <p key={n} className="text-muted-foreground text-xs">
          {n}
        </p>
      ))}
    </div>
  )
}

