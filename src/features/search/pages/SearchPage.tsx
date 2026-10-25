import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/feedback/Feedback'
import { useDb } from '@/hooks/useData'
import { useRole } from '@/hooks/useSession'
import { searchAll, type SearchResult } from '@/lib/search'
import { useOnChange } from '@/hooks/useOnChange'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  useOnChange([q], () => setInput(q))
  const db = useDb()
  const role = useRole()
  const results = useMemo(() => searchAll(db, q, role, 200), [db, q, role])
  const grouped = useMemo(() => {
    const m = new Map<SearchResult['type'], SearchResult[]>()
    for (const r of results) m.set(r.type, [...(m.get(r.type) ?? []), r])
    return [...m.entries()]
  }, [results])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setParams(input.trim() ? { q: input.trim() } : {})
  }

  return (
    <>
      <PageHeader title="Search" description="Search across customers, suppliers, projects, invoices, expenses, purchasing, products, reports and pages. Results respect your demo role." />
      <form onSubmit={submit} className="mb-6 flex max-w-xl gap-2" role="search">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input value={input} onChange={(e) => setInput(e.target.value)} className="pl-8" placeholder="e.g. Orchid, INV-2026, cloud" aria-label="Search terms" autoFocus />
        </div>
        <Button type="submit">Search</Button>
      </form>
      {q.trim().length < 2 ? (
        <EmptyState icon={<Search />} title="Type at least two characters" description="Tip: press Ctrl K anywhere to open quick search." />
      ) : !results.length ? (
        <EmptyState icon={<SearchX />} title={`No results for “${q}”`} description="Try a customer name, document number or module name." />
      ) : (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {results.length} result{results.length === 1 ? '' : 's'} for “{q}”
          </p>
          {grouped.map(([type, items]) => (
            <section key={type} aria-labelledby={`sr-${type}`}>
              <h2 id={`sr-${type}`} className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {type} ({items.length})
              </h2>
              <ul className="bg-card divide-y rounded-xl border">
                {items.map((r) => (
                  <li key={`${r.type}:${r.id}`}>
                    <Link to={r.to} className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.title}</div>
                        {r.subtitle ? <div className="text-muted-foreground truncate text-xs">{r.subtitle}</div> : null}
                      </div>
                      <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
