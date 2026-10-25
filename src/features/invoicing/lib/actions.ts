import { format, parseISO } from 'date-fns'
import type { Customer, Invoice, Milestone, Project, RecurringSchedule } from '@/domain'
import { DemoValidationError, invoiceRepository, milestoneRepository, recurringScheduleRepository } from '@/services'
import { newId } from '@/services/demo/demoStore'
import { FREQUENCY_MONTHS, addDaysIso, addMonthsIso, todayIso } from './billing'

/** Create the next draft invoice for a recurring schedule and advance its next run date (simulated). */
export async function generateRecurringInvoice(schedule: RecurringSchedule, customers: Customer[]): Promise<Invoice> {
  if (!schedule.active) throw new DemoValidationError('Activate the schedule before generating invoices.')
  if (schedule.endDate && schedule.nextRunDate > schedule.endDate) throw new DemoValidationError('The schedule has passed its end date.')
  const customer = customers.find((c) => c.id === schedule.customerId)
  const issue = schedule.nextRunDate
  const period = format(parseISO(issue), 'MMMM yyyy')
  const invoice = await invoiceRepository.create({
    number: '',
    customerId: schedule.customerId,
    contractId: schedule.contractId,
    issueDate: issue,
    dueDate: addDaysIso(issue, customer?.paymentTermsDays ?? 30),
    currency: 'LKR',
    lines: [{ id: newId('ln'), description: `${schedule.description} — ${period}`, productId: 'prod-support', quantity: 1, unitPrice: schedule.amount, discountPercent: 0, taxRatePercent: schedule.taxRatePercent }],
    discountPercent: 0,
    notes: `Generated from recurring schedule "${schedule.name}" (simulated run).`,
    recurringScheduleId: schedule.id,
    status: 'draft',
    history: [],
  })
  const next = addMonthsIso(schedule.nextRunDate, FREQUENCY_MONTHS[schedule.frequency])
  await recurringScheduleRepository.update(schedule.id, { nextRunDate: next, active: schedule.endDate ? next <= schedule.endDate : true })
  return invoice
}

/** Create a draft invoice for a milestone and mark the milestone as invoiced. */
export async function invoiceMilestone(milestone: Milestone, project: Project, customers: Customer[]): Promise<Invoice> {
  if (milestone.status === 'invoiced') throw new DemoValidationError('This milestone has already been invoiced.')
  const customer = customers.find((c) => c.id === project.customerId)
  const issue = todayIso()
  const invoice = await invoiceRepository.create({
    number: '',
    customerId: project.customerId,
    projectId: project.id,
    contractId: project.contractId,
    issueDate: issue,
    dueDate: addDaysIso(issue, customer?.paymentTermsDays ?? 30),
    currency: 'LKR',
    lines: [{ id: newId('ln'), description: `${project.name} — milestone: ${milestone.name}`, productId: 'prod-dev', quantity: 1, unitPrice: milestone.amount, discountPercent: 0, taxRatePercent: 18 }],
    discountPercent: 0,
    notes: `Milestone billing for ${project.code}.`,
    status: 'draft',
    history: [],
  })
  await milestoneRepository.update(milestone.id, { status: 'invoiced', invoiceId: invoice.id })
  return invoice
}
