import { CalendarRange } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DATE_PRESET_LABELS, type DatePreset } from '@/lib/dates'

export function DateRangeSelect({ value, onChange, presets, className }: { value: DatePreset; onChange: (v: DatePreset) => void; presets?: DatePreset[]; className?: string }) {
  const list = presets ?? (Object.keys(DATE_PRESET_LABELS) as DatePreset[])
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DatePreset)}>
      <SelectTrigger size="sm" className={className ?? 'h-9 w-44'} aria-label="Date range">
        <CalendarRange className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {list.map((p) => (
          <SelectItem key={p} value={p}>
            {DATE_PRESET_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
