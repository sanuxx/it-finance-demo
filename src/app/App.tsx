import { useEffect } from 'react'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Compass } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { ConfirmProvider } from '@/components/dialogs/ConfirmDialog'
import { EmptyState } from '@/components/feedback/Feedback'
import { usePreferences } from '@/app/state/preferences'
import { useCurrentUser } from '@/hooks/useSession'
import { can } from '@/lib/permissions'
import { AppLayout } from './layouts/AppLayout'
import { ROUTES } from './routes'

function useThemeClass() {
  const theme = usePreferences((s) => s.theme)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!media?.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media?.addEventListener?.('change', apply)
    return () => media?.removeEventListener?.('change', apply)
  }, [theme])
  return theme
}

/** Land each demo role on a screen it can use. */
function HomeRedirect() {
  const user = useCurrentUser()
  const to = can(user.role, 'dashboard.executive') ? '/dashboard' : can(user.role, 'projects.edit') ? '/dashboard/projects' : '/finance/expenses'
  return <Navigate to={to} replace />
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="The address you opened does not match any screen in this demo."
      action={
        <Button asChild size="sm">
          <Link to="/">Back to the dashboard</Link>
        </Button>
      }
      className="mt-10"
    />
  )
}

export default function App() {
  const theme = useThemeClass()
  return (
    <TooltipProvider delayDuration={250}>
      <ConfirmProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomeRedirect />} />
              {ROUTES.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </HashRouter>
        <Toaster richColors closeButton position="bottom-right" theme={theme} />
      </ConfirmProvider>
    </TooltipProvider>
  )
}
