import { format, startOfWeek } from 'date-fns'

/** Normalise any date to the Monday of its week (timesheets are weekly). */
export const weekStart = (iso: string) => format(startOfWeek(new Date(`${iso}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd')
