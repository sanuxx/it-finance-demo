import { create } from 'zustand'
import type { RoleKey } from '@/domain'
import { PREFS_KEY, readJSON, writeJSON } from '@/lib/storage/demoStorage'
import type { DatePreset } from '@/lib/dates'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Preferences {
  theme: ThemePreference
  sidebarCollapsed: boolean
  /** Demo user whose role drives the simulated permissions. */
  currentUserId: string
  dashboardPreset: DatePreset
  /** Collapsed navigation groups in the sidebar. */
  collapsedNavGroups: string[]
  compactTables: boolean
  dateFormat: 'dd MMM yyyy' | 'yyyy-MM-dd' | 'dd/MM/yyyy'
  showDemoBanner: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  sidebarCollapsed: false,
  currentUserId: 'u-fm',
  dashboardPreset: 'last_6_months',
  collapsedNavGroups: ['config', 'admin'],
  compactTables: false,
  dateFormat: 'dd MMM yyyy',
  showDemoBanner: true,
}

interface PreferencesState extends Preferences {
  set: (patch: Partial<Preferences>) => void
  resetPreferences: () => void
}

const stored = readJSON<Partial<Preferences>>(PREFS_KEY) ?? {}

export const usePreferences = create<PreferencesState>()((set) => ({
  ...DEFAULT_PREFERENCES,
  ...stored,
  set: (patch) => set(patch),
  resetPreferences: () => set({ ...DEFAULT_PREFERENCES }),
}))

usePreferences.subscribe((state) => {
  const { set: _set, resetPreferences: _reset, ...prefs } = state
  void _set
  void _reset
  writeJSON(PREFS_KEY, prefs)
})

export const ROLE_LABELS: Record<RoleKey, string> = {
  director: 'Company Director',
  finance_manager: 'Finance Manager',
  accountant: 'Accountant',
  project_manager: 'Project Manager',
  employee: 'Employee',
}
