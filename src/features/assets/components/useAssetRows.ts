import { useMemo } from 'react'
import type { FixedAsset } from '@/domain'
import { useCollection } from '@/hooks/useData'
import { assetBookValue, monthlyDepreciation } from '@/lib/calculations/depreciation'
import { percentOf } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'

export type AssetRow = FixedAsset & { accumulated: number; bookValue: number; monthly: number; consumed: number | null }

export function useAssetRows(): AssetRow[] {
  const assets = useCollection('assets')
  return useMemo(() => {
    const today = todayISO()
    const month = `${today.slice(0, 7)}-01`
    return assets.map((a) => {
      const { accumulated, bookValue } = assetBookValue(a, today)
      return { ...a, accumulated, bookValue, monthly: monthlyDepreciation(a, month), consumed: a.status === 'disposed' ? null : percentOf(accumulated, a.cost - a.salvageValue) }
    })
  }, [assets])
}

