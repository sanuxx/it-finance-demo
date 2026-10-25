import { useCallback } from 'react'
import type { DemoUser, RoleKey } from '@/domain'
import { usePreferences } from '@/app/state/preferences'
import { useDemoStore } from '@/services/demo/demoStore'
import { can as canRole, type Permission } from '@/lib/permissions'

/** The simulated signed-in demo user. */
export function useCurrentUser(): DemoUser {
  const id = usePreferences((s) => s.currentUserId)
  const users = useDemoStore((s) => s.db.users)
  return users.find((u) => u.id === id) ?? users[0]!
}

export function useRole(): RoleKey {
  return useCurrentUser().role
}

/** UI-only permission check (see src/lib/permissions.ts). */
export function useCan(): (permission: Permission) => boolean {
  const role = useRole()
  return useCallback((permission: Permission) => canRole(role, permission), [role])
}

export function usePermission(permission: Permission): boolean {
  return canRole(useRole(), permission)
}
