import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight, Wallet } from 'lucide-react'
import type { NavGroup } from '@/app/navigation'
import { usePreferences } from '@/app/state/preferences'
import { useVisibleNavigation } from './useVisibleNavigation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const BOTTOM_GROUPS = new Set(['config', 'admin'])

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const groups = useVisibleNavigation()
  const { pathname } = useLocation()
  const top = groups.filter((g) => !BOTTOM_GROUPS.has(g.key))
  const bottom = groups.filter((g) => BOTTOM_GROUPS.has(g.key))

  const isGroupActive = (g: NavGroup) => g.items.some((i) => pathname === i.path || pathname.startsWith(`${i.path}/`))
  const activeKey = groups.find(isGroupActive)?.key ?? null

  // Accordion: only one section is open at a time. It follows the current page until the user picks another.
  const [choice, setChoice] = useState<{ forActive: string | null; open: string | null }>({ forActive: null, open: null })
  const openKey = choice.forActive === activeKey ? choice.open : activeKey
  const toggleGroup = (key: string) => setChoice({ forActive: activeKey, open: openKey === key ? null : key })

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
              className={cn('mx-auto flex size-10 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60')}
            >
              <Icon className="size-[18px]" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{g.label}</TooltipContent>
        </Tooltip>
      )
    }
    const open = openKey === g.key
    return (
      <div key={g.key}>
        <button
          type="button"
          onClick={() => toggleGroup(g.key)}
          aria-expanded={open}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          )}
        >
          <Icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'opacity-70')} />
          <span className="flex-1 truncate text-left">{g.label}</span>
          <ChevronDown className={cn('size-3.5 opacity-40 transition-transform', !open && '-rotate-90')} />
        </button>
        {open ? (
          <ul className="mt-0.5 mb-2 space-y-0.5 pl-[2.625rem]">
            {g.items.map((i) => (
              <li key={i.path}>
                <NavLink
                  to={i.path}
                  end={i.path === '/dashboard' || i.path === '/config' || i.path === '/projects' || i.path === '/reports' || i.path === '/assets'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'block truncate rounded-lg px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                      isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
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
      <Link to="/dashboard" onClick={onNavigate} className={cn('flex h-16 shrink-0 items-center gap-3 px-5 outline-none focus-visible:ring-2 focus-visible:ring-ring', collapsed && 'justify-center px-0')}>
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-sm">
          <Wallet className="size-[18px]" />
        </span>
        {!collapsed ? (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold">Ledgerline</span>
            <span className="text-muted-foreground block truncate text-xs">Finance for tech teams</span>
          </span>
        ) : null}
      </Link>
      <div className="flex-1 overflow-y-auto pb-4">
        <nav aria-label="Main" className={cn('space-y-0.5 pt-2', collapsed ? 'space-y-1.5 px-3' : 'px-3')}>
          {top.map(renderGroup)}
        </nav>
        {bottom.length ? (
          <nav aria-label="Settings" className={cn('mt-4 space-y-0.5', collapsed ? 'space-y-1.5 px-3' : 'px-3')}>
            {!collapsed ? <div className="text-muted-foreground px-3 pb-1 text-[11px] font-medium tracking-wider uppercase">Settings</div> : <div className="bg-border mx-2 my-2 h-px" />}
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
    <aside className={cn('bg-sidebar text-sidebar-foreground border-sidebar-border/60 no-print sticky top-0 hidden h-svh shrink-0 flex-col border-r lg:flex', collapsed ? 'w-[4.5rem]' : 'w-[16.5rem]')}>
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
