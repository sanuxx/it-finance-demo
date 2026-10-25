import Decimal from 'decimal.js-light'

/**
 * Decimal-safe currency helpers.
 *
 * Amounts are stored as plain numbers in major currency units (e.g. LKR 1250.50)
 * but every arithmetic step goes through decimal.js-light and is rounded to
 * 2 decimal places using ROUND_HALF_UP. This keeps totals reproducible and
 * avoids floating-point drift such as 0.1 + 0.2 = 0.30000000000000004.
 */
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

export type Numeric = number | string | Decimal

const D = (v: Numeric | null | undefined) => new Decimal(v === null || v === undefined || v === '' ? 0 : v)

/** Round to currency precision (2dp, half-up). */
export function round2(value: Numeric): number {
  return D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
}

export function add(...values: Numeric[]): number {
  return round2(values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0)))
}

export function sum<T>(items: readonly T[], pick: (item: T) => Numeric): number {
  return round2(items.reduce<Decimal>((acc, item) => acc.plus(D(pick(item))), new Decimal(0)))
}

export function subtract(a: Numeric, b: Numeric): number {
  return round2(D(a).minus(D(b)))
}

export function multiply(a: Numeric, b: Numeric): number {
  return round2(D(a).times(D(b)))
}

/** Division that returns 0 when the divisor is 0 (safe for ratios such as utilisation). */
export function divide(a: Numeric, b: Numeric, dp = 2): number {
  const divisor = D(b)
  if (divisor.isZero()) return 0
  return D(a).dividedBy(divisor).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber()
}

/** Percentage value (e.g. 12.5 for 12.5%) of `part` over `whole`, null when whole is 0. */
export function percentOf(part: Numeric, whole: Numeric, dp = 1): number | null {
  const w = D(whole)
  if (w.isZero()) return null
  return D(part).dividedBy(w).times(100).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber()
}

/** Apply a percentage rate (e.g. 18 for 18%) to an amount, rounded to 2dp. */
export function applyRate(amount: Numeric, ratePercent: Numeric): number {
  return round2(D(amount).times(D(ratePercent)).dividedBy(100))
}

export function max0(value: Numeric): number {
  const d = D(value)
  return d.isNegative() ? 0 : round2(d)
}

export function isZero(value: Numeric): boolean {
  return D(value).toDecimalPlaces(2).isZero()
}

export function compare(a: Numeric, b: Numeric): -1 | 0 | 1 {
  return D(a).toDecimalPlaces(2).comparedTo(D(b).toDecimalPlaces(2)) as -1 | 0 | 1
}
