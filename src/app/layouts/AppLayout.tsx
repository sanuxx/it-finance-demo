import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Lock, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { EmptyState } from '@/components/feedback/Feedback'
import { findNavItem } from '@/app/navigation'
import { ROLE_LABELS, usePreferences } from '@/app/state/preferences'
import { useCan, useCurrentUser } from '@/hooks/useSession'
import { useDemoStore } from '@/services'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

/** Simulated route guard — hides screens the demo role may not see. Not security. */
function RoleGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const can = useCan()
  const user = useCurrentUser()
  const set = usePreferences((s) => s.set)
  const match = findNavItem(pathname)
  const blocked = match && ((match.group.permission && !can(match.group.permission)) || (match.item.permission && !can(match.item.permission)))
  if (!blocked) return <>{children}</>
  return (
    <EmptyState
      icon={<Lock />}
      title={`Not available to the ${ROLE_LABELS[user.role]} role`}
      description="This demo simulates role-based screens in the browser only. Switch to a role with access to explore this area — real permissions will be enforced by the future backend."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => set({ currentUserId: 'u-fm' })}>
            Switch to Finance Manager
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/finance/expenses">Go to my expenses</Link>
          </Button>
        </div>
      }
      className="mt-10"
    />
  )
}

function StorageBanner() {
  const storageAvailable = useDemoStore((s) => s.storageAvailable)
  const saveError = useDemoStore((s) => s.saveError)
  if (storageAvailable && !saveError) return null
  return (
    <div role="alert" className="border-warning/40 bg-warning/10 flex items-center gap-2 border-b px-5 py-2 text-xs">
      <TriangleAlert className="text-warning size-4" />
      {!storageAvailable
        ? 'Browser storage is unavailable (private mode or blocked). Your demo changes will be lost when you close this tab.'
        : saveError === 'quota'
          ? 'Browser storage is full, so recent demo changes could not be saved. Export your data or reset the demo from Administration → Demo data.'
          : 'Recent demo changes could not be saved to browser storage.'}
    </div>
  )
}

function DemoFooter() {
  return (
    <footer className="text-muted-foreground no-print mx-auto w-full max-w-[1600px] px-4 pt-2 pb-8 text-xs sm:px-6 lg:px-8">
      Interactive demo · all data is fictional and stored only in this browser — nothing is real money, email or accounting.{' '}
      <Link to="/admin/demo-data" className="text-primary underline-offset-2 hover:underline">
        Manage demo data
      </Link>
    </footer>
  )
}

export function AppLayout() {
  const { pathname } = useLocation()
  const loadMessage = useDemoStore((s) => s.loadMessage)
  const dismiss = useDemoStore((s) => s.dismissLoadMessage)

  useEffect(() => {
    if (loadMessage) {
      toast.warning(loadMessage, { duration: 10000 })
      dismiss()
    }
  }, [loadMessage, dismiss])

  useEffect(() => {
    document.getElementById('main-content')?.scrollTo?.({ top: 0 })
    window.scrollTo?.({ top: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-svh">
      <a href="#main-content" className="focus:bg-primary focus:text-primary-foreground sr-only z-50 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:rounded-md focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <StorageBanner />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <RoleGuard>
                <Outlet />
              </RoleGuard>
            </Suspense>
          </ErrorBoundary>
        </main>
        <DemoFooter />
      </div>
    </div>
  )
}
