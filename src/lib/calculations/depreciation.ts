import { addMonths, differenceInCalendarMonths, format, parseISO, startOfMonth } from 'date-fns'
import type { FixedAsset, ISODate } from '@/domain'
import { divide, max0, multiply, round2, subtract } from './money'

/** Months elapsed from the month after purchase up to and including `month`. */
function monthIndex(asset: FixedAsset, month: ISODate): number {
  return differenceInCalendarMonths(startOfMonth(parseISO(month)), startOfMonth(parseISO(asset.purchaseDate)))
}

/**
 * Illustrative depreciation for one month. Depreciation starts the month after
 * purchase. Straight line spreads (cost − salvage) evenly; declining balance uses
 * a double-declining monthly rate and never goes below salvage value.
 */
export function monthlyDepreciation(asset: FixedAsset, month: ISODate): number {
  if (asset.status === 'disposed') return 0
  const idx = monthIndex(asset, month)
  if (idx < 1 || idx > asset.usefulLifeMonths || asset.usefulLifeMonths <= 0) return 0
  const base = subtract(asset.cost, asset.salvageValue)
  if (asset.method === 'straight_line') return divide(base, asset.usefulLifeMonths)
  const opening = bookValueAtMonth(asset, idx - 1)
  const rate = 2 / asset.usefulLifeMonths
  return round2(Math.min(multiply(opening, rate), max0(subtract(opening, asset.salvageValue))))
}

function bookValueAtMonth(asset: FixedAsset, monthsElapsed: number): number {
  let value = asset.cost
  const rate = 2 / asset.usefulLifeMonths
  for (let i = 1; i <= monthsElapsed; i++) {
    if (asset.method === 'straight_line') {
      value = subtract(value, divide(subtract(asset.cost, asset.salvageValue), asset.usefulLifeMonths))
    } else {
      value = subtract(value, Math.min(multiply(value, rate), max0(subtract(value, asset.salvageValue))))
    }
  }
  return Math.max(value, asset.salvageValue)
}

export interface DepreciationRow {
  month: string
  opening: number
  depreciation: number
  closing: number
}

export function depreciationSchedule(asset: FixedAsset): DepreciationRow[] {
  const rows: DepreciationRow[] = []
  let opening = asset.cost
  for (let i = 1; i <= asset.usefulLifeMonths; i++) {
    const month = format(addMonths(startOfMonth(parseISO(asset.purchaseDate)), i), 'yyyy-MM-dd')
    const dep = monthlyDepreciation({ ...asset, status: 'active' }, month)
    const closing = subtract(opening, dep)
    rows.push({ month: month.slice(0, 7), opening, depreciation: dep, closing })
    opening = closing
  }
  return rows
}

export function assetBookValue(asset: FixedAsset, asOf: ISODate): { accumulated: number; bookValue: number } {
  if (asset.status === 'disposed') return { accumulated: 0, bookValue: 0 }
  const elapsed = Math.min(Math.max(monthIndex(asset, asOf), 0), asset.usefulLifeMonths)
  const book = round2(bookValueAtMonth(asset, elapsed))
  return { accumulated: subtract(asset.cost, book), bookValue: book }
}
