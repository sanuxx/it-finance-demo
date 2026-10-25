import { describe, expect, it } from 'vitest'
import { toCsv } from './index'

describe('CSV export', () => {
  it('escapes quotes, commas and newlines', () => {
    const csv = toCsv([{ a: 'x, y', b: 'say "hi"', c: 'line\nbreak' }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
      { header: 'C', value: (r) => r.c },
    ])
    expect(csv).toBe('A,B,C\r\n"x, y","say ""hi""","line\nbreak"')
  })
  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    const csv = toCsv([{ v: '=SUM(A1)' }, { v: '-125.5' }], [{ header: 'V', value: (r) => r.v }])
    expect(csv.split('\r\n')).toEqual(['V', "'=SUM(A1)", '-125.5'])
  })
})
