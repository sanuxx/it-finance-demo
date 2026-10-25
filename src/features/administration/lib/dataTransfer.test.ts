import { buildSeed } from '@/data/seed'
import { columnsFor, parseBackup } from './dataTransfer'

describe('backup import', () => {
  it('accepts a backup exported from the demo', () => {
    const db = buildSeed(new Date(2026, 9, 24))
    const r = parseBackup(JSON.stringify(db))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.db.invoices.length).toBe(db.invoices.length)
  })
  it('rejects invalid or foreign files with a clear message', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'The file is not valid JSON.' })
    expect(parseBackup('[]').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ meta: { schemaVersion: 1 }, organization: {}, invoices: 'x', customers: [] })).ok).toBe(false)
    expect(parseBackup(JSON.stringify({ meta: { schemaVersion: 99 }, organization: {} })).ok).toBe(false)
  })
  it('flattens nested values for CSV', () => {
    const cols = columnsFor([{ id: 'a', lines: [{ x: 1 }] }, { id: 'b', extra: true }])
    expect(cols.map((c) => c.header)).toEqual(['id', 'lines', 'extra'])
    expect(cols[1]!.value({ id: 'a', lines: [{ x: 1 }] })).toBe('[{"x":1}]')
  })
})
