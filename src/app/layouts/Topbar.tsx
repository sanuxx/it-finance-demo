import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, Check, ChevronRight, LogOut, Menu, Monitor, Moon, Search, Sun, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { DemoBadge } from '@/components/feedback/Feedback'
import { findNavItem } from '@/app/navigation'
import { ROLE_LABELS, usePreferences, type ThemePreference } from '@/app/state/preferences'
import { useCurrentUser } from '@/hooks/useSession'
import { useCollection, useDb } from '@/hooks/useData'
import { notificationRepository, useDemoStore } from '@/services'
import { searchAll } from '@/lib/search'
import { formatRelative } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { SidebarContent } from './Sidebar'

function Breadcrumbs() {
  const { pathname } = useLocation()
  const match = findNavItem(pathname)
  const isDetail = match && match.item.path !== pathname
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="text-muted-foreground flex items-center gap-1 text-sm">
        <li>
          <Link to="/dashboard" className="hover:text-foreground">
            Home
          </Link>
        </li>
        {match ? (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <li className="truncate">{match.group.label}</li>
            <ChevronRight className="size-3.5" aria-hidden />
            <li className="truncate">
              {isDetail ? (
                <Link to={match.item.path} className="hover:text-foreground">
                  {match.item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium" aria-current="page">
                  {match.item.label}
                </span>
              )}
            </li>
            {isDetail ? (
              <>
                <ChevronRight className="size-3.5" aria-hidden />
                <li className="text-foreground truncate font-medium" aria-current="page">
                  Details
                </li>
              </>
            ) : null}
          </>
        ) : null}
      </ol>
    </nav>
  )
}

function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const db = useDb()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const results = useMemo(() => searchAll(db, query, user.role, 40), [db, query, user.role])
  const grouped = useMemo(() => {
    const m = new Map<string, typeof results>()
    for (const r of results) m.set(r.type, [...(m.get(r.type) ?? []), r])
    return [...m.entries()]
  }, [results])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <>
      <Button variant="outline" className="text-muted-foreground h-9 w-9 justify-start gap-2 px-2.5 sm:w-56 lg:w-72" onClick={() => setOpen(true)} aria-label="Search">
        <Search className="size-4" />
        <span className="hidden flex-1 text-left text-sm font-normal sm:inline">Search records…</span>
        <kbd className="bg-muted hidden rounded border px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search customers, invoices, projects, expenses and pages" shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search customers, invoices, projects, expenses…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim().length >= 2 && !results.length) go(`/search?q=${encodeURIComponent(query)}`)
          }}
        />
        <CommandList>
          {query.trim().length < 2 ? <div className="text-muted-foreground px-4 py-6 text-center text-sm">Type at least two characters.</div> : <CommandEmpty>No matching records.</CommandEmpty>}
          {grouped.map(([type, items]) => (
            <CommandGroup key={type} heading={type}>
              {items.slice(0, 6).map((r) => (
                <CommandItem key={`${r.type}:${r.id}`} value={`${r.type}:${r.id}`} onSelect={() => go(r.to)}>
                  <div className="min-w-0">
                    <div className="truncate">{r.title}</div>
                    {r.subtitle ? <div className="text-muted-foreground truncate text-xs">{r.subtitle}</div> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {results.length ? (
            <CommandGroup heading="More">
              <CommandItem value="__all" onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)}>
                See all results for “{query}”
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}

function Notifications() {
  const notifications = useCollection('notifications')
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell />
          {unread ? <span className="bg-destructive text-[10px] text-white absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 leading-4 font-semibold">{unread}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button variant="ghost" size="xs" onClick={() => notificationRepository.markAllRead()} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex items-start gap-2 rounded-none border-b px-3 py-2.5 last:border-0"
              onSelect={() => {
                notificationRepository.markRead(n.id)
                if (n.link) navigate(n.link)
              }}
            >
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-label={n.read ? undefined : 'Unread'} />
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm leading-snug font-medium">{n.title}</div>
                <div className="text-muted-foreground line-clamp-2 text-xs">{n.body}</div>
                <div className="text-muted-foreground text-[11px]">{formatRelative(n.at)}</div>
              </div>
            </DropdownMenuItem>
          ))}
          {!notifications.length ? <p className="text-muted-foreground p-4 text-center text-sm">You are all caught up.</p> : null}
        </div>
        <div className="border-t p-1">
          <DropdownMenuItem onSelect={() => navigate('/notifications')} className="justify-center text-sm">
            View all notifications
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle() {
  const theme = usePreferences((s) => s.theme)
  const set = usePreferences((s) => s.set)
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${theme}`}>
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => set({ theme: v as ThemePreference })}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const users = useCollection('users')
  const set = usePreferences((s) => s.set)
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label={`Signed in as ${user.name}, ${ROLE_LABELS[user.role]}. Open user menu`}>
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-xs font-semibold">{user.initials}</span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-sm font-medium">{user.name}</span>
            <span className="text-muted-foreground block text-[11px]">{ROLE_LABELS[user.role]}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-muted-foreground text-xs">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs">Switch demo role (UI simulation only)</DropdownMenuLabel>
        {users.map((u) => (
          <DropdownMenuItem key={u.id} onSelect={() => set({ currentUserId: u.id })}>
            <span className="flex-1">
              {ROLE_LABELS[u.role]}
              <span className="text-muted-foreground ml-1 text-xs">· {u.name}</span>
            </span>
            {u.id === user.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/admin/preferences')}>
          <UserCog /> Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/admin/organization')}>
          <Building2 /> Organisation settings
        </DropdownMenuItem>
        <DropdownMenuItem disabled title="There is no real sign-in in this public demo">
          <LogOut /> Sign out (not available in demo)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OrganizationContext() {
  const org = useDemoStore((s) => s.db.organization)
  return (
    <Link to="/admin/organization" className="hover:bg-accent hidden items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm 2xl:flex" title="Organisation context">
      <Building2 className="text-muted-foreground size-4" />
      <span className="max-w-40 truncate">{org.name}</span>
      <span className="text-muted-foreground text-xs">{org.baseCurrency}</span>
    </Link>
  )
}

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMobileOpen(false), [pathname])
  return (
    <header className="bg-background/95 no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-sidebar w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1.5">
        <GlobalSearch />
        <Link to="/admin/demo-data" title="Interactive Demo — Sample Data. All data is fictional and stored only in this browser" aria-label="Interactive Demo — Sample Data">
          <DemoBadge className="hidden md:inline-flex" />
          <DemoBadge compact className="md:hidden" />
        </Link>
        <OrganizationContext />
        <Notifications />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

