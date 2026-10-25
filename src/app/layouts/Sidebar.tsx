import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight, Wallet } from 'lucide-react'
import { NAVIGATION, type NavGroup } from '@/app/navigation'
import { usePreferences } from '@/app/state/preferences'
import { useCan } from '@/hooks/useSession'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const BOTTOM_GROUPS = new Set(['config', 'admin'])

export function useVisibleNavigation(): NavGroup[] {
  const can = useCan()
  return NAVIGATION.filter((g) => !g.permission || can(g.permission))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length > 0)
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const groups = useVisibleNavigation()
  const { pathname } = useLocation()
  const collapsedGroups = usePreferences((s) => s.collapsedNavGroups)
  const setPrefs = usePreferences((s) => s.set)
  const top = groups.filter((g) => !BOTTOM_GROUPS.has(g.key))
  const bottom = groups.filter((g) => BOTTOM_GROUPS.has(g.key))

  const isGroupActive = (g: NavGroup) => g.items.some((i) => pathname === i.path || pathname.startsWith(`${i.path}/`))

  const toggleGroup = (key: string) =>
    setPrefs({ collapsedNavGroups: collapsedGroups.includes(key) ? collapsedGroups.filter((k) => k !== key) : [...collapsedGroups, key] })

  const renderGroup = (g: NavGroup) => {
    const Icon = g.icon
    const active = isGroupActive(g)
    if (collapsed) {
      return (
        <Tooltip key={g.key}>
          <TooltipTrigger asChild>
            <NavLink
              to={g.items[0]!.path}
              onClick={onNavigate}
              aria-label={g.label}
              className={cn('mx-auto flex size-9 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60')}
            >
              <Icon className="size-4" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{g.label}</TooltipContent>
        </Tooltip>
      )
    }
    const open = !collapsedGroups.includes(g.key) || active
    return (
      <div key={g.key}>
        <button
          type="button"
          onClick={() => toggleGroup(g.key)}
          aria-expanded={open}
          className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60')}
        >
          <Icon className="size-4 shrink-0 opacity-80" />
          <span className="flex-1 truncate text-left">{g.label}</span>
          <ChevronDown className={cn('size-3.5 opacity-60 transition-transform', !open && '-rotate-90')} />
        </button>
        {open ? (
          <ul className="mt-0.5 mb-1 ml-[15px] space-y-px border-l pl-2.5">
            {g.items.map((i) => (
              <li key={i.path}>
                <NavLink
                  to={i.path}
                  end={i.path === '/dashboard' || i.path === '/config' || i.path === '/projects' || i.path === '/reports' || i.path === '/assets'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'block truncate rounded-md px-2 py-1 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )
                  }
                >
                  {i.label}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" onClick={onNavigate} className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring', collapsed && 'justify-center px-0')}>
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <Wallet className="size-4" />
        </span>
        {!collapsed ? (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">Ledgerline</span>
            <span className="text-muted-foreground block truncate text-[11px]">IT & Software Finance</span>
          </span>
        ) : null}
      </Link>
      <div className="flex-1 overflow-y-auto">
        <nav aria-label="Main" className={cn('space-y-0.5 py-3', collapsed ? 'space-y-1.5 px-2' : 'px-3')}>
          {top.map(renderGroup)}
        </nav>
        {bottom.length ? (
          <nav aria-label="Settings" className={cn('space-y-0.5 border-t py-3', collapsed ? 'space-y-1.5 px-2' : 'px-3')}>
            {!collapsed ? <div className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">Settings</div> : null}
            {bottom.map(renderGroup)}
          </nav>
        ) : null}
      </div>
    </div>
  )
}

export function Sidebar() {
  const collapsed = usePreferences((s) => s.sidebarCollapsed)
  const set = usePreferences((s) => s.set)
  return (
    <aside className={cn('bg-sidebar text-sidebar-foreground border-sidebar-border no-print sticky top-0 hidden h-svh shrink-0 flex-col border-r lg:flex', collapsed ? 'w-16' : 'w-64')}>
      <SidebarContent collapsed={collapsed} />
      <button
        type="button"
        onClick={() => set({ sidebarCollapsed: !collapsed })}
        className="text-muted-foreground hover:text-foreground flex h-10 items-center justify-center gap-2 border-t text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
      </button>
    </aside>
  )
}
