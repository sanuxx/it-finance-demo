import type { CollectionKey, DemoDatabase } from '@/domain'
import { buildSeed, SCHEMA_VERSION } from '@/data/seed'
import { migrateDatabase } from '@/lib/storage/demoStorage'
import type { ExportColumn } from '@/lib/export'

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024

export function collectionKeys(db: DemoDatabase): CollectionKey[] {
  return (Object.keys(db) as (keyof DemoDatabase)[]).filter((k) => Array.isArray(db[k])) as CollectionKey[]
}

/** CSV columns for an arbitrary collection: the union of top-level keys; nested values as JSON. */
export function columnsFor(rows: Record<string, unknown>[]): ExportColumn<Record<string, unknown>>[] {
  const keys: string[] = []
  for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k)
  return keys.map((k) => ({
    header: k,
    value: (r) => {
      const v = r[k]
      if (v === null || v === undefined) return ''
      return typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean)
    },
  }))
}

export type ImportResult = { ok: true; db: DemoDatabase; counts: number; migrated: boolean } | { ok: false; error: string }

/** Validate and migrate a JSON backup. Never executes anything from the file. */
export function parseBackup(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'The file is larger than 8 MB.' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'The file does not contain a demo dataset object.' }
  const obj = parsed as Record<string, unknown>
  const meta = obj.meta as Record<string, unknown> | undefined
  if (!meta || typeof meta.schemaVersion !== 'number') return { ok: false, error: 'Missing "meta.schemaVersion" — this does not look like a backup from this demo.' }
  if (meta.schemaVersion > SCHEMA_VERSION) return { ok: false, error: `The backup was created by a newer version (schema ${meta.schemaVersion}).` }
  if (!obj.organization || typeof obj.organization !== 'object') return { ok: false, error: 'Missing organisation details.' }
  const fresh = buildSeed()
  for (const key of collectionKeys(fresh)) {
    if (key in obj && !Array.isArray(obj[key])) return { ok: false, error: `"${key}" must be a list.` }
    const list = obj[key]
    if (Array.isArray(list) && list.some((x) => !x || typeof x !== 'object' || typeof (x as { id?: unknown }).id !== 'string')) {
      return { ok: false, error: `Every record in "${key}" needs a text id.` }
    }
  }
  if (!Array.isArray(obj.invoices) || !Array.isArray(obj.customers)) return { ok: false, error: 'The backup must include customers and invoices.' }
  const { db, migrated } = migrateDatabase(obj as Record<string, unknown> & { meta: { schemaVersion: number } }, fresh)
  const counts = collectionKeys(db).reduce((s, k) => s + (db[k] as unknown[]).length, 0)
  return { ok: true, db, counts, migrated }
}
