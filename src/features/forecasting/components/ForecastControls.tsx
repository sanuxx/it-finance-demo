import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection } from '@/hooks/useData'
import { formatPercent } from '@/lib/formatting'
import type { ForecastScenario } from '@/domain'

import { HORIZONS } from '../lib/horizons'

export function ScenarioSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const scenarios = useCollection('scenarios')
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-9 w-48" aria-label="Scenario">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {scenarios.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function HorizonSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="h-9 w-32" aria-label="Forecast horizon">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HORIZONS.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {h} months
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function IllustrativeNotice({ scenario }: { scenario?: ForecastScenario }) {
  return (
    <SimulatedNotice tone="demo" className="mb-5">
      <strong>Illustrative projection, not a statistical forecast.</strong> The baseline is the average of the last three complete months of demo revenue and expenses;
      {scenario ? (
        <>
          {' '}
          the <em>{scenario.name}</em> scenario applies {formatPercent(scenario.revenueGrowthPercent)} monthly revenue growth, {formatPercent(scenario.expenseGrowthPercent)} expense growth and a{' '}
          {formatPercent(scenario.collectionRatePercent, 0)} collection rate, plus any one-off items.
        </>
      ) : null}
    </SimulatedNotice>
  )
}
