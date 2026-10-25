import { create } from 'zustand'
import type { CollectionKey, DemoDatabase } from '@/domain'
import { buildSeed } from '@/data/seed'
import {
  DATA_KEY,
  clearDemoStorage,
  loadDatabase,
  saveDatabase,
  safeParse,
  type LoadStatus,
  type StorageErrorKind,
} from '@/lib/storage/demoStorage'

/**
 * Single in-memory copy of the demo dataset, persisted to localStorage.
 *
 * Components never touch this directly for writes — they go through the
 * repositories in `src/services`. Reads use the hooks in `src/hooks/useData.ts`.
 */
export interface DemoState {
  db: DemoDatabase
  loadStatus: LoadStatus
  loadMessage?: string
  storageAvailable: boolean
  saveError?: StorageErrorKind
  lastSavedAt?: string
  /** Apply an immutable update to the dataset. */
  mutate: (updater: (db: DemoDatabase) => DemoDatabase) => void
  /** Replace the whole dataset (used by import and reset). */
  replace: (db: DemoDatabase) => void
  /** Restore the original fictional dataset. */
  reset: () => void
  dismissLoadMessage: () => void
}

const initial = loadDatabase(() => buildSeed())

export const useDemoStore = create<DemoState>()((set) => ({
  db: initial.db,
  loadStatus: initial.status,
  loadMessage: initial.message,
  storageAvailable: initial.storageAvailable,
  mutate: (updater) => set((s) => ({ db: updater(s.db) })),
  replace: (db) => set({ db }),
  reset: () => {
    clearDemoStorage()
    const db = buildSeed()
    set({ db, loadStatus: 'seeded', loadMessage: undefined, saveError: undefined })
    persistNow(db)
  },
  dismissLoadMessage: () => set({ loadMessage: undefined }),
}))

/* ---------------------------------------------------------------- persistence */

let saveTimer: ReturnType<typeof setTimeout> | undefined
let pendingDb: DemoDatabase | undefined
let applyingRemote = false

function persistNow(db: DemoDatabase) {
  pendingDb = undefined
  if (!useDemoStore.getState().storageAvailable) return
  const result = saveDatabase(db)
  useDemoStore.setState(result.ok ? { saveError: undefined, lastSavedAt: new Date().toISOString() } : { saveError: result.error })
}

export function flushPendingSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = undefined
  if (pendingDb) persistNow(pendingDb)
}

useDemoStore.subscribe((state, prev) => {
  if (state.db === prev.db || applyingRemote) return
  pendingDb = state.db
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flushPendingSave, 250)
})

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingSave)
  window.addEventListener('pagehide', flushPendingSave)
  // Keep several open tabs in sync: another tab saved newer demo data.
  window.addEventListener('storage', (event) => {
    if (event.key !== DATA_KEY) return
    const next = safeParse<DemoDatabase>(event.newValue)
    applyingRemote = true
    if (next && next.meta) useDemoStore.setState({ db: next })
    else if (event.newValue === null) useDemoStore.setState({ db: buildSeed() })
    applyingRemote = false
  })
}

/* ------------------------------------------------------------------ helpers */

export function getDb(): DemoDatabase {
  return useDemoStore.getState().db
}

/** Immutable update of a single collection. */
export function updateCollection<K extends CollectionKey>(key: K, updater: (items: DemoDatabase[K]) => DemoDatabase[K]) {
  useDemoStore.getState().mutate((db) => ({ ...db, [key]: updater(db[key]) }))
}

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}-${random}`
}

/** Next sequential document number, e.g. nextNumber(['INV-2026-0012'], 'INV-2026-', 4) → 'INV-2026-0013'. */
export function nextNumber(existing: string[], prefix: string, pad = 4): string {
  let max = 0
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue
    const value = Number(n.slice(prefix.length).replace(/\D/g, ''))
    if (Number.isFinite(value) && value > max) max = value
  }
  return `${prefix}${String(max + 1).padStart(pad, '0')}`
}
