import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface State {
  error: Error | null
}

/** Catches render errors so one broken screen never blanks the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg space-y-3 rounded-xl border p-6 text-center">
        <div className="bg-destructive/10 text-destructive mx-auto flex size-10 items-center justify-center rounded-full">
          <TriangleAlert className="size-5" />
        </div>
        <h2 className="font-semibold">This screen ran into a problem</h2>
        <p className="text-muted-foreground text-sm">Your demo data is safe. Try again, or reset the demo from Administration → Demo data if the problem persists.</p>
        <pre className="bg-muted overflow-auto rounded p-2 text-left text-xs">{this.state.error.message}</pre>
        <div className="flex justify-center gap-2">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.hash = '#/dashboard')}>
            Go to dashboard
          </Button>
        </div>
      </div>
    )
  }
}
