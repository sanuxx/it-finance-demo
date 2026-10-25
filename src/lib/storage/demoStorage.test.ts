import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { BACKUP_KEY, DATA_KEY, PREFS_KEY, clearDemoStorage, loadDatabase, readJSON, saveDatabase, writeRaw } from './demoStorage'

const seed = () => buildSeed(new Date(2026, 9, 24))

describe('demo storage', () => {
  beforeEach(() => localStorage.clear())

  it('seeds when nothing is stored and persists it', () => {
    const r = loadDatabase(seed)
    expect(r.status).toBe('seeded')
    expect(readJSON(DATA_KEY)).not.toBeNull()
  })

  it('loads saved changes instead of re-seeding', () => {
    const db = seed()
    db.customers[0]!.name = 'Changed by the user'
    saveDatabase(db)
    const r = loadDatabase(seed)
    expect(r.status).toBe('loaded')
    expect(r.db.customers[0]!.name).toBe('Changed by the user')
  })

  it('recovers from corrupted data and keeps a backup', () => {
    writeRaw(DATA_KEY, '{not json')
    const r = loadDatabase(seed)
    expect(r.status).toBe('recovered')
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{not json')
    expect(r.db.invoices.length).toBeGreaterThan(0)
  })

  it('fills collections missing from older data without losing changes', () => {
    const db = seed() as unknown as Record<string, unknown>
    delete db.savedReports
    ;(db.customers as { name: string }[])[0]!.name = 'Kept'
    localStorage.setItem(DATA_KEY, JSON.stringify(db))
    const r = loadDatabase(seed)
    expect(r.status).toBe('migrated')
    expect(r.db.savedReports.length).toBeGreaterThan(0)
    expect(r.db.customers[0]!.name).toBe('Kept')
  })

  it('leaves data from a newer schema untouched', () => {
    const db = seed()
    const newer = { ...db, meta: { ...db.meta, schemaVersion: 999 } }
    localStorage.setItem(DATA_KEY, JSON.stringify(newer))
    const r = loadDatabase(seed)
    expect(r.status).toBe('recovered')
    expect(readJSON<{ meta: { schemaVersion: number } }>(DATA_KEY)!.meta.schemaVersion).toBe(999)
  })

  it('reset clears only keys in the demo namespace', () => {
    localStorage.setItem(DATA_KEY, '{}')
    localStorage.setItem(PREFS_KEY, '{}')
    localStorage.setItem('another-app:token', 'keep-me')
    clearDemoStorage()
    expect(localStorage.getItem(DATA_KEY)).toBeNull()
    expect(localStorage.getItem(PREFS_KEY)).toBeNull()
    expect(localStorage.getItem('another-app:token')).toBe('keep-me')
  })
})
