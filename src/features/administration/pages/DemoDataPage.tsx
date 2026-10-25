import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, HardDrive, RotateCcw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DetailList } from '@/components/data-display/DetailList'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { usePreferences } from '@/app/state/preferences'
import { useDb } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useDemoStore } from '@/services'
import { STORAGE_NAMESPACE, STORAGE_VERSION, storageUsageKb } from '@/lib/storage/demoStorage'
import { exportJson, timestampedName } from '@/lib/export'
import { formatDate, formatDateTime, formatNumber, humanize } from '@/lib/formatting'
import { collectionKeys } from '../lib/dataTransfer'

const STATUS_TEXT = {
  seeded: 'Fresh sample dataset created in this browser',
  loaded: 'Loaded your saved demo data',
  migrated: 'Saved data upgraded to the current format',
  recovered: 'Stored data was unreadable and replaced with the sample dataset',
} as const

export default function DemoDataPage() {
  const db = useDb()
  const loadStatus = useDemoStore((s) => s.loadStatus)
  const storageAvailable = useDemoStore((s) => s.storageAvailable)
  const lastSavedAt = useDemoStore((s) => s.lastSavedAt)
  const saveError = useDemoStore((s) => s.saveError)
  const canManage = usePermission('admin.manage')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [alsoPrefs, setAlsoPrefs] = useState(false)
  const usage = useMemo(() => storageUsageKb(), [db]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => collectionKeys(db).map((k) => ({ key: k, count: (db[k] as unknown[]).length })).sort((a, b) => b.count - a.count), [db])
  const total = counts.reduce((s, c) => s + c.count, 0)

  const reset = async () => {
    const { confirmed } = await confirm({
      title: 'Reset all demo data?',
      description: (
        <div className="space-y-2">
          <p>Every change you made in this browser — new invoices, payments, expenses, projects, forms, rules, workflows, reports and dashboard layouts — will be permanently discarded and the original fictional dataset restored.</p>
          <p>Only keys under <code>{STORAGE_NAMESPACE}:</code> in this browser are affected. Consider downloading a backup first.</p>
        </div>
      ),
      confirmLabel: 'Reset demo data',
      destructive: true,
    })
    if (!confirmed) return
    useDemoStore.getState().reset()
    if (alsoPrefs) usePreferences.getState().resetPreferences()
    toast.success('Demo data reset to the original sample dataset')
    navigate('/')
  }

  return (
    <>
      <PageHeader title="Demo data" description="Manage the browser-side dataset that powers this interactive demo." />
      <SimulatedNotice className="mb-5" tone="demo">
        All records are fictional and stored only in this browser’s local storage under keys starting with <code>{`${STORAGE_NAMESPACE}:${STORAGE_VERSION}:`}</code>. They are not shared with other people, browsers or devices, and nothing is sent to a server.
      </SimulatedNotice>
      <StatGrid className="mb-5">
        <StatCard label="Records" term="Demo records" value={formatNumber(total)} hint={`${counts.length} collections`} />
        <StatCard label="Storage used" term="Storage used" value={`${formatNumber(usage)} KB`} hint="Approximate, of ~5 MB browser quota" />
        <StatCard label="Sample data anchored" term="Anchor date" value={formatDate(db.meta.anchorDate)} hint="Seed dates are relative to this day" />
        <StatCard label="Last saved" term="Last saved" value={lastSavedAt ? formatDateTime(lastSavedAt) : '—'} hint={saveError ? 'Last save failed' : storageAvailable ? 'Saved automatically' : 'Storage unavailable'} />
      </StatGrid>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Section title="Status">
            <DetailList
              columns={1}
              items={[
                { label: 'Load status', value: STATUS_TEXT[loadStatus] },
                { label: 'Browser storage', value: storageAvailable ? (saveError ? `Available, but saving failed (${saveError})` : 'Available — changes persist across refreshes') : 'Unavailable — changes are lost when the tab closes' },
                { label: 'Dataset created', value: formatDateTime(db.meta.seededAt) },
                { label: 'Schema version', value: `v${db.meta.schemaVersion}` },
                { label: 'Storage keys', value: <code className="text-xs">{`${STORAGE_NAMESPACE}:${STORAGE_VERSION}:data`} · {`${STORAGE_NAMESPACE}:${STORAGE_VERSION}:prefs`}</code> },
              ]}
            />
          </Section>
          <Section title="Reset" description="Restore the original fictional dataset and default configuration.">
            <div className="space-y-4">
              <Button variant="outline" onClick={() => exportJson(timestampedName('it-finance-demo-backup'), db)}><Download /> Download backup first</Button>
              <div className="flex items-center gap-2">
                <Checkbox id="reset-prefs" checked={alsoPrefs} onCheckedChange={(v) => setAlsoPrefs(!!v)} disabled={!canManage} />
                <Label htmlFor="reset-prefs" className="font-normal">Also reset my preferences (theme, layout, demo user)</Label>
              </div>
              <Button variant="destructive" onClick={reset} disabled={!canManage}><RotateCcw /> Reset demo data…</Button>
              {!canManage ? <p className="text-muted-foreground flex items-center gap-1.5 text-xs"><ShieldAlert className="size-3.5" /> Switch to the Finance Manager or Director demo role to reset.</p> : null}
            </div>
          </Section>
        </div>
        <Section title={<span className="flex items-center gap-1.5"><HardDrive className="size-4" /> Records by collection</span>}>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {counts.map((c) => (
              <li key={c.key} className="flex justify-between border-b border-dashed py-1">
                <span className="text-muted-foreground">{humanize(c.key.replace(/([A-Z])/g, ' $1').toLowerCase())}</span>
                <span className="tabular font-medium">{formatNumber(c.count)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}
