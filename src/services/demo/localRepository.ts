import type { AppNotification, AuditEntry, CollectionItem, CollectionKey, DemoDatabase, ID, RoleKey } from '@/domain'
import { usePreferences } from '@/app/state/preferences'
import type { CollectionRepository, CreateInput, ListQuery, UpdateInput } from '@/services/repositories/types'
import { getDb, newId, useDemoStore } from './demoStore'

/** The simulated signed-in user, used to stamp audit entries and history. */
export function getActor(): { name: string; role: RoleKey } {
  const id = usePreferences.getState().currentUserId
  const users = useDemoStore.getState().db.users
  const user = users.find((u) => u.id === id) ?? users[0]
  return { name: user?.name ?? 'Demo user', role: user?.role ?? 'finance_manager' }
}

export function nowStamp(): string {
  return new Date().toISOString()
}

/** Error thrown for validation failures that should be shown to the user. */
export class DemoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DemoValidationError'
  }
}

export function auditEntry(action: string, entity: string, summary: string, entityId?: ID): AuditEntry {
  const actor = getActor()
  return { id: newId('au'), at: nowStamp(), actor: actor.name, role: actor.role, action, entity, entityId, summary }
}

/** Append audit entries (newest first, capped to keep storage small). */
export function withAudit(db: DemoDatabase, ...entries: AuditEntry[]): DemoDatabase {
  return { ...db, auditLog: [...entries.reverse(), ...db.auditLog].slice(0, 500) }
}

export function withNotification(db: DemoDatabase, n: Omit<AppNotification, 'id' | 'at' | 'read'>): DemoDatabase {
  return { ...db, notifications: [{ id: newId('n'), at: nowStamp(), read: false, ...n }, ...db.notifications].slice(0, 100) }
}

/** Resolve after the current tick to mimic an async API without artificial delay. */
export const resolved = <T,>(value: T): Promise<T> => Promise.resolve(value)

function matchesSearch(item: unknown, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return Object.values(item as Record<string, unknown>).some((v) => (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(needle))
}

/**
 * Generic browser-side repository over one collection of the demo dataset.
 * `entityLabel` is used in audit-log messages.
 */
export function createLocalRepository<K extends CollectionKey>(
  key: K,
  options: { prefix: string; entity: string; label?: (item: CollectionItem<K>) => string; canDelete?: (item: CollectionItem<K>, db: DemoDatabase) => string | null },
): CollectionRepository<K> {
  type T = CollectionItem<K>
  const describe = (item: T) => options.label?.(item) ?? (item as { name?: string; number?: string }).name ?? (item as { number?: string }).number ?? item.id
  const items = () => getDb()[key] as unknown as T[]
  const write = (db: DemoDatabase, next: T[]) => ({ ...db, [key]: next }) as DemoDatabase

  return {
    async list(query?: ListQuery<T>) {
      let out = items()
      if (query?.filter) out = out.filter(query.filter)
      if (query?.search) out = out.filter((i) => matchesSearch(i, query.search!))
      return out
    },
    async get(id: ID) {
      return items().find((i) => i.id === id)
    },
    async create(input: CreateInput<T>) {
      const stamp = nowStamp()
      const record = { ...input, id: newId(options.prefix), createdAt: stamp, updatedAt: stamp } as unknown as T
      useDemoStore.getState().mutate((db) => withAudit(write(db, [record, ...(db[key] as unknown as T[])]), auditEntry('create', options.entity, `Created ${options.entity.replace(/_/g, ' ')} ${describe(record)}`, record.id)))
      return record
    },
    async update(id: ID, patch: UpdateInput<T>) {
      const existing = items().find((i) => i.id === id)
      if (!existing) throw new DemoValidationError('Record not found — it may have been deleted.')
      const updated = { ...existing, ...patch, id, updatedAt: nowStamp() } as T
      useDemoStore.getState().mutate((db) =>
        withAudit(
          write(
            db,
            (db[key] as unknown as T[]).map((i) => (i.id === id ? updated : i)),
          ),
          auditEntry('update', options.entity, `Updated ${options.entity.replace(/_/g, ' ')} ${describe(updated)}`, id),
        ),
      )
      return updated
    },
    async remove(id: ID) {
      const existing = items().find((i) => i.id === id)
      if (!existing) return
      const blocked = options.canDelete?.(existing, getDb())
      if (blocked) throw new DemoValidationError(blocked)
      useDemoStore.getState().mutate((db) =>
        withAudit(
          write(
            db,
            (db[key] as unknown as T[]).filter((i) => i.id !== id),
          ),
          auditEntry('delete', options.entity, `Deleted ${options.entity.replace(/_/g, ' ')} ${describe(existing)}`, id),
        ),
      )
    },
  }
}

/** Replace one record inside a collection (helper for domain-specific operations). */
export function replaceIn<K extends CollectionKey>(db: DemoDatabase, key: K, record: CollectionItem<K>): DemoDatabase {
  const list = db[key] as unknown as { id: string }[]
  return { ...db, [key]: list.map((i) => (i.id === record.id ? record : i)) } as DemoDatabase
}
