import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { EmployeeProfile, TimesheetEntry } from '@/domain'
import { multiply, percentOf, round2 } from '@/lib/calculations/money'

/** Timesheets that count towards cost and utilisation (submitted or approved). */
export function countableTimesheets(timesheets: TimesheetEntry[], from?: string, to?: string): TimesheetEntry[] {
  return timesheets.filter((t) => (t.status === 'approved' || t.status === 'submitted') && (!from || t.date >= from) && (!to || t.date <= to))
}

/** Available hours in [from, to] given weekly capacity, pro-rated from the person's start date. */
export function capacityHours(e: Pick<EmployeeProfile, 'capacityHoursPerWeek' | 'startDate' | 'active'>, from: string, to: string): number {
  if (!e.active) return 0
  const start = e.startDate > from ? e.startDate : from
  if (start > to) return 0
  const days = differenceInCalendarDays(parseISO(to), parseISO(start)) + 1
  return round2((e.capacityHoursPerWeek * days) / 7)
}

export interface PersonUtilisation {
  employee: EmployeeProfile
  capacity: number
  hours: number
  billableHours: number
  cost: number
  utilisationPercent: number | null
  billableUtilisationPercent: number | null
}

export function utilisationByPerson(employees: EmployeeProfile[], timesheets: TimesheetEntry[], from: string, to: string): PersonUtilisation[] {
  const rows = countableTimesheets(timesheets, from, to)
  return employees.map((employee) => {
    const mine = rows.filter((t) => t.employeeId === employee.id)
    const hours = mine.reduce((s, t) => s + t.hours, 0)
    const billableHours = mine.filter((t) => t.billable).reduce((s, t) => s + t.hours, 0)
    const capacity = capacityHours(employee, from, to)
    return {
      employee,
      capacity,
      hours,
      billableHours,
      cost: multiply(hours, employee.hourlyCostRate),
      utilisationPercent: percentOf(hours, capacity),
      billableUtilisationPercent: percentOf(billableHours, capacity),
    }
  })
}
