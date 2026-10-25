import { useFieldArray, useWatch, type Control, type FieldErrors } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import type { LineItem } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Money } from '@/components/data-display/DetailList'
import { useCollection } from '@/hooks/useData'
import { documentTotals, lineTotals } from '@/lib/calculations/invoices'
import { formatCurrency, formatPercent } from '@/lib/formatting'
import { blankLine } from '../lib/billing'
import type { LinesForm } from '../lib/lineSchema'

const NONE = '__none__'

function NumInput({ value, onChange, label, step = 'any', invalid }: { value: number | undefined; onChange: (v: number | undefined) => void; label: string; step?: string; invalid?: boolean }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      aria-label={label}
      aria-invalid={invalid}
      className="tabular h-8 text-right"
      value={value === undefined || Number.isNaN(value) ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  )
}

/** Editable invoice/quotation lines with live line and document totals. */
export function LineItemsEditor({ control, errors, showDocumentDiscount = true, currency = 'LKR' }: { control: Control<LinesForm>; errors?: FieldErrors<LinesForm>; showDocumentDiscount?: boolean; currency?: string }) {
  const products = useCollection('products')
  const { fields, append, remove, update } = useFieldArray({ control, name: 'lines', keyName: 'key' })
  const lines = (useWatch({ control, name: 'lines' }) ?? []) as LineItem[]
  const docDiscount = (useWatch({ control, name: 'discountPercent' }) as number | undefined) ?? 0
  const safe = lines.map((l) => ({ ...l, quantity: l?.quantity || 0, unitPrice: l?.unitPrice || 0, discountPercent: l?.discountPercent || 0, taxRatePercent: l?.taxRatePercent || 0 }))
  const totals = documentTotals(safe, showDocumentDiscount ? docDiscount || 0 : 0)
  const lineErrors = errors?.lines as unknown as (Record<string, { message?: string }> | undefined)[] | undefined
  const rootError = (errors?.lines as { message?: string; root?: { message?: string } } | undefined)?.message ?? (errors?.lines as { root?: { message?: string } } | undefined)?.root?.message

  const set = (i: number, patch: Partial<LineItem>) => update(i, { ...(lines[i] ?? fields[i]!), ...patch } as LineItem)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Line items</caption>
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Product / service</th>
              <th className="px-2 py-2 text-left font-medium">Description</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Unit price</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Disc %</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Tax %</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Net</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const l = lines[i] ?? (f as unknown as LineItem)
              const err = lineErrors?.[i]
              return (
                <tr key={f.key} className="border-t align-top">
                  <td className="px-2 py-1.5">
                    <Select
                      value={l.productId ?? NONE}
                      onValueChange={(v) => {
                        const product = products.find((p) => p.id === v)
                        set(i, { productId: v === NONE ? undefined : v, description: l.description || product?.name || '' })
                      }}
                    >
                      <SelectTrigger size="sm" className="h-8 w-44" aria-label={`Product for line ${i + 1}`}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No product</SelectItem>
                        {products
                          .filter((p) => p.active)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input className="h-8" aria-label={`Description for line ${i + 1}`} aria-invalid={!!err?.description} value={l.description ?? ''} onChange={(e) => set(i, { description: e.target.value })} />
                    {err?.description?.message ? <p className="text-destructive mt-1 text-xs">{err.description.message}</p> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput label={`Quantity line ${i + 1}`} value={l.quantity} invalid={!!err?.quantity} onChange={(v) => set(i, { quantity: v as number })} />
                    {err?.quantity?.message ? <p className="text-destructive mt-1 text-xs">{err.quantity.message}</p> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput label={`Unit price line ${i + 1}`} value={l.unitPrice} invalid={!!err?.unitPrice} onChange={(v) => set(i, { unitPrice: v as number })} />
                    {err?.unitPrice?.message ? <p className="text-destructive mt-1 text-xs">{err.unitPrice.message}</p> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput label={`Discount percent line ${i + 1}`} value={l.discountPercent} invalid={!!err?.discountPercent} onChange={(v) => set(i, { discountPercent: v as number })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput label={`Tax percent line ${i + 1}`} value={l.taxRatePercent} invalid={!!err?.taxRatePercent} onChange={(v) => set(i, { taxRatePercent: v as number })} />
                  </td>
                  <td className="tabular px-2 py-2.5 text-right">{formatCurrency(lineTotals(safe[i] ?? l).net, currency)}</td>
                  <td className="px-1 py-1.5">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={fields.length <= 1} aria-label={`Remove line ${i + 1}`}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rootError ? <p className="text-destructive text-xs" role="alert">{rootError}</p> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}>
          <Plus /> Add line
        </Button>
        <dl className="w-full space-y-1.5 text-sm sm:w-80">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal (after line discounts)</dt>
            <dd><Money value={totals.subtotal} currency={currency} /></dd>
          </div>
          {showDocumentDiscount ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Invoice discount ({formatPercent(docDiscount || 0)})</dt>
              <dd><Money value={-totals.documentDiscount} currency={currency} /></dd>
            </div>
          ) : null}
          {totals.taxByRate.map((t) => (
            <div key={t.rate} className="flex justify-between">
              <dt className="text-muted-foreground">Tax {formatPercent(t.rate, 0)} on {formatCurrency(t.taxable, currency)}</dt>
              <dd><Money value={t.tax} currency={currency} /></dd>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd><Money value={totals.total} currency={currency} /></dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
