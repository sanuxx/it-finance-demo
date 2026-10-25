import type { DemoDatabase } from '@/domain'

/**
 * Centralised, versioned browser storage for the demo.
 *
 * All keys live under the `it-finance-demo:` namespace so a reset can never
 * touch anything outside this application. Nothing sensitive is ever stored.
 */
export const STORAGE_NAMESPACE = 'it-finance-demo'
export const STORAGE_VERSION = 'v1'
export const DATA_KEY = `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:data`
export const PREFS_KEY = `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:prefs`
export const BACKUP_KEY = `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:corrupt-backup`

export type StorageErrorKind = 'unavailable' | 'quota' | 'unknown'

export interface StorageResult {
  ok: boolean
  error?: StorageErrorKind
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const probe = `${STORAGE_NAMESPACE}:probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

export function isStorageAvailable(): boolean {
  return getStorage() !== null
}

function classify(error: unknown): StorageErrorKind {
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22)) {
    return 'quota'
  }
  return 'unknown'
}

export function readRaw(key: string): string | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): StorageResult {
  const storage = getStorage()
  if (!storage) return { ok: false, error: 'unavailable' }
  try {
    storage.setItem(key, value)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: classify(error) }
  }
}

/** Parse JSON without throwing. */
export function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function readJSON<T>(key: string): T | null {
  return safeParse<T>(readRaw(key))
}

export function writeJSON(key: string, value: unknown): StorageResult {
  let serialised: string
  try {
    serialised = JSON.stringify(value)
  } catch {
    return { ok: false, error: 'unknown' }
  }
  return writeRaw(key, serialised)
}

/** Remove every key belonging to this demo — and only those keys. */
export function clearDemoStorage(): StorageResult {
  const storage = getStorage()
  if (!storage) return { ok: false, error: 'unavailable' }
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith(`${STORAGE_NAMESPACE}:`)) keys.push(key)
    }
    keys.forEach((k) => storage.removeItem(k))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: classify(error) }
  }
}

/** Approximate size of the demo's stored data in kilobytes. */
export function storageUsageKb(): number {
  const storage = getStorage()
  if (!storage) return 0
  let chars = 0
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && key.startsWith(`${STORAGE_NAMESPACE}:`)) chars += key.length + (storage.getItem(key)?.length ?? 0)
  }
  return Math.round((chars * 2) / 1024)
}

/* ------------------------------------------------------------------ database */

export type LoadStatus = 'seeded' | 'loaded' | 'migrated' | 'recovered'

export interface LoadResult {
  db: DemoDatabase
  status: LoadStatus
  storageAvailable: boolean
  /** Human-readable explanation when data had to be repaired or reset. */
  message?: string
}

type Migration = (db: Record<string, unknown>) => Record<string, unknown>

/**
 * Schema migrations keyed by the version they upgrade *from*.
 * Add an entry here whenever `SCHEMA_VERSION` is bumped.
 */
export const MIGRATIONS: Record<number, Migration> = {}

function looksLikeDatabase(value: unknown): value is Record<string, unknown> & { meta: { schemaVersion: number } } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const meta = v.meta as Record<string, unknown> | undefined
  return !!meta && typeof meta.schemaVersion === 'number' && Array.isArray(v.invoices) && Array.isArray(v.customers)
}

/**
 * Upgrade a stored dataset to the current schema. Collections introduced in
 * later versions are filled from a fresh seed so existing user changes are kept.
 */
export function migrateDatabase(stored: Record<string, unknown> & { meta: { schemaVersion: number } }, fresh: DemoDatabase): { db: DemoDatabase; migrated: boolean } {
  let current: Record<string, unknown> = stored
  let version = stored.meta.schemaVersion
  let migrated = false
  while (version < fresh.meta.schemaVersion) {
    const step = MIGRATIONS[version]
    if (step) current = step(current)
    version++
    migrated = true
  }
  for (const [key, value] of Object.entries(fresh)) {
    if (!(key in current) || (Array.isArray(value) && !Array.isArray(current[key]))) {
      current[key] = value
      migrated = true
    }
  }
  const meta = { ...(current.meta as DemoDatabase['meta']), schemaVersion: fresh.meta.schemaVersion }
  return { db: { ...(current as unknown as DemoDatabase), meta }, migrated }
}

/**
 * Load the dataset, seeding only when nothing compatible exists.
 * Corrupted data is backed up under a separate key before re-seeding.
 */
export function loadDatabase(seed: () => DemoDatabase): LoadResult {
  const available = isStorageAvailable()
  if (!available) {
    return { db: seed(), status: 'seeded', storageAvailable: false, message: 'Browser storage is unavailable, so changes will last only until this tab is closed.' }
  }
  const raw = readRaw(DATA_KEY)
  if (raw === null) {
    const db = seed()
    writeJSON(DATA_KEY, db)
    return { db, status: 'seeded', storageAvailable: true }
  }
  const parsed = safeParse<unknown>(raw)
  if (!looksLikeDatabase(parsed)) {
    writeRaw(BACKUP_KEY, raw)
    const db = seed()
    writeJSON(DATA_KEY, db)
    return { db, status: 'recovered', storageAvailable: true, message: 'Stored demo data could not be read and was replaced with the original sample dataset. A backup copy was kept in this browser.' }
  }
  const fresh = seed()
  if (parsed.meta.schemaVersion > fresh.meta.schemaVersion) {
    // Data from a newer build: keep it untouched and run on a fresh in-memory copy.
    return { db: fresh, status: 'recovered', storageAvailable: true, message: 'Stored demo data was created by a newer version of this demo and was left untouched.' }
  }
  const { db, migrated } = migrateDatabase(parsed, fresh)
  if (migrated) writeJSON(DATA_KEY, db)
  return { db, status: migrated ? 'migrated' : 'loaded', storageAvailable: true }
}

export function saveDatabase(db: DemoDatabase): StorageResult {
  return writeJSON(DATA_KEY, db)
}
