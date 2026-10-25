import { useMemo } from 'react'
import { useDb } from '@/hooks/useData'
import { presetRange, todayISO, type DatePreset } from '@/lib/dates'
import { computeDashboardMetrics } from '../lib/metrics'

/** All executive figures for a date preset, computed once per data change. */
export function useDashboardMetrics(preset: DatePreset) {
  const db = useDb()
  return useMemo(() => computeDashboardMetrics(db, presetRange(preset), todayISO()), [db, preset])
}
