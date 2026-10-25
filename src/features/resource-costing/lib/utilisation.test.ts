import type { EmployeeProfile, TimesheetEntry } from '@/domain'
import { capacityHours, countableTimesheets, utilisationByPerson } from './utilisation'

const emp = (over: Partial<EmployeeProfile> = {}): EmployeeProfile => ({
  id: 'e1', code: 'E-1', name: 'Test Person', email: 't@example.test', roleId: 'role-se', departmentId: 'dept-engineering', employmentType: 'employee',
  monthlyCost: 320_000, hourlyCostRate: 2_000, hourlyBillRate: 7_500, capacityHoursPerWeek: 40, startDate: '2020-01-01', active: true,
  createdAt: '', updatedAt: '', ...over,
})
const ts = (over: Partial<TimesheetEntry>): TimesheetEntry => ({ id: Math.random().toString(), employeeId: 'e1', projectId: 'p', date: '2026-03-02', hours: 10, billable: true, description: '', status: 'approved', createdAt: '', updatedAt: '', ...over })

describe('utilisation', () => {
  it('computes weekly capacity and pro-rates for new starters', () => {
    expect(capacityHours(emp(), '2026-03-02', '2026-03-08')).toBe(40)
    expect(capacityHours(emp({ startDate: '2026-03-05' }), '2026-03-02', '2026-03-08')).toBeCloseTo(22.86, 2)
    expect(capacityHours(emp({ startDate: '2026-04-01' }), '2026-03-02', '2026-03-08')).toBe(0)
    expect(capacityHours(emp({ active: false }), '2026-03-02', '2026-03-08')).toBe(0)
  })

  it('ignores draft and rejected timesheets and handles zero capacity safely', () => {
    const sheets = [ts({}), ts({ status: 'draft' }), ts({ status: 'rejected' }), ts({ billable: false, hours: 5 })]
    expect(countableTimesheets(sheets)).toHaveLength(2)
    const [row] = utilisationByPerson([emp()], sheets, '2026-03-02', '2026-03-08')
    expect(row!.hours).toBe(15)
    expect(row!.billableHours).toBe(10)
    expect(row!.cost).toBe(30_000)
    expect(row!.utilisationPercent).toBe(37.5)
    expect(row!.billableUtilisationPercent).toBe(25)
    const [none] = utilisationByPerson([emp({ startDate: '2027-01-01' })], sheets, '2026-03-02', '2026-03-08')
    expect(none!.utilisationPercent).toBeNull()
  })
})
