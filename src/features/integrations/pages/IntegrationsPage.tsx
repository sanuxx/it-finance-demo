import { useMemo, useState } from 'react'
import { Banknote, Bot, Cloud, CreditCard, Landmark, Mail, PlugZap, RefreshCw, Settings2, ShieldAlert, Unplug, Users } from 'lucide-react'
import type { IntegrationSetting } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { integrationRepository } from '@/services'
import { formatDateTime, formatRelative, humanize } from '@/lib/formatting'

const CATEGORY_ICON: Record<IntegrationSetting['category'], React.ReactNode> = {
  accounting: <Landmark />,
  banking: <Banknote />,
  cloud: <Cloud />,
  payments: <CreditCard />,
  communication: <Mail />,
  hr: <Users />,
  ai: <Bot />,
}

/** Settings keys that look like secrets are never offered for editing. */
const SECRET_KEY = /(key|secret|token|password|credential)/i

function SettingsDialog({ integration, onClose }: { integration?: IntegrationSetting; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => ({ ...(integration?.settings ?? {}) }))
  const [pending, setPending] = useState(false)
  const connecting = integration?.status === 'not_connected'
  const entries = Object.entries(values).filter(([k]) => !SECRET_KEY.test(k))

  const save = async () => {
    if (!integration) return
    setPending(true)
    const ok = await runWithToast(
      integrationRepository.update(integration.id, {
        settings: values,
        ...(connecting ? { status: 'connected_demo' as const, lastSyncAt: new Date().toISOString() } : {}),
      }),
      connecting ? `${integration.name} connected (simulated)` : 'Settings saved',
    )
    setPending(false)
    if (ok) onClose()
  }

  return (
    <Dialog open={!!integration} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{connecting ? `Connect ${integration?.name}` : `${integration?.name} settings`}</DialogTitle>
          <DialogDescription>{integration?.description}</DialogDescription>
        </DialogHeader>
        <SimulatedNotice tone="warning">
          This is a simulated connection. The demo never asks for — and you should never enter — real API keys, passwords, bank credentials or tokens. No external service is contacted.
        </SimulatedNotice>
        <div className="space-y-4">
          {entries.length ? (
            entries.map(([key, value]) => {
              const id = `int-${key}`
              return typeof value === 'boolean' ? (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={id}>{humanize(key.replace(/([A-Z])/g, ' $1'))}</Label>
                  <Switch id={id} checked={value} onCheckedChange={(v) => setValues((s) => ({ ...s, [key]: v }))} />
                </div>
              ) : (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={id}>{humanize(key.replace(/([A-Z])/g, ' $1'))}</Label>
                  <Input id={id} value={value} onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value }))} />
                </div>
              )
            })
          ) : (
            <p className="text-muted-foreground text-sm">No configurable options in this preview.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={pending}>
            <PlugZap /> {connecting ? 'Connect (demo)' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function IntegrationsPage() {
  const integrations = useCollection('integrations')
  const canManage = usePermission('admin.manage')
  const confirm = useConfirm()
  const [configuring, setConfiguring] = useState<IntegrationSetting | undefined>()

  const counts = useMemo(
    () => ({
      connected: integrations.filter((i) => i.status === 'connected_demo').length,
      available: integrations.filter((i) => i.status === 'not_connected').length,
      soon: integrations.filter((i) => i.status === 'coming_soon').length,
    }),
    [integrations],
  )

  const sync = (i: IntegrationSetting) => runWithToast(integrationRepository.update(i.id, { lastSyncAt: new Date().toISOString() }), `${i.name}: simulated sync complete — no data was fetched`)

  const disconnect = async (i: IntegrationSetting) => {
    const { confirmed } = await confirm({ title: `Disconnect ${i.name}?`, description: 'This only changes the simulated status in this browser. Existing demo records are kept.', confirmLabel: 'Disconnect' })
    if (confirmed) await runWithToast(integrationRepository.update(i.id, { status: 'not_connected', lastSyncAt: undefined }), `${i.name} disconnected`)
  }

  return (
    <>
      <PageHeader title="Integrations" description="A preview of the connections planned for the production platform. Everything on this page is simulated." />
      <SimulatedNotice tone="warning" className="mb-6">
        <span className="inline-flex items-center gap-1 font-medium"><ShieldAlert className="size-3.5" /> No credentials are requested or stored.</span> Connecting an integration here only changes its demo status. Real integrations will be configured securely through the future backend.
      </SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Connected (demo)" value={counts.connected} />
        <StatCard label="Available to connect" value={counts.available} />
        <StatCard label="Coming soon" value={counts.soon} />
        <StatCard label="Total integrations" value={integrations.length} />
      </StatGrid>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((i) => (
          <article key={i.id} className="bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5">{CATEGORY_ICON[i.category]}</div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{i.name}</h2>
                <p className="text-muted-foreground text-xs">{humanize(i.category)}</p>
              </div>
              <StatusBadge status={i.status} />
            </div>
            <p className="text-muted-foreground text-sm">{i.description}</p>
            {i.status === 'connected_demo' ? (
              <p className="text-muted-foreground text-xs" title={formatDateTime(i.lastSyncAt)}>
                Last simulated sync {i.lastSyncAt ? formatRelative(i.lastSyncAt) : 'never'}
              </p>
            ) : i.status === 'coming_soon' ? (
              <p className="text-muted-foreground text-xs">Planned for the production release — not available in this demo.</p>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              {i.status === 'connected_demo' ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => sync(i)} disabled={!canManage}><RefreshCw /> Sync now (simulated)</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfiguring(i)} disabled={!canManage}><Settings2 /> Settings</Button>
                  <Button size="sm" variant="ghost" onClick={() => disconnect(i)} disabled={!canManage}><Unplug /> Disconnect</Button>
                </>
              ) : i.status === 'not_connected' ? (
                <Button size="sm" onClick={() => setConfiguring(i)} disabled={!canManage}><PlugZap /> Connect (demo)</Button>
              ) : (
                <Button size="sm" variant="outline" disabled title="This integration is planned but not part of the demo">Coming soon</Button>
              )}
            </div>
            {!canManage && i.status !== 'coming_soon' ? <p className="text-muted-foreground text-xs">Switch to the Finance Manager or Director role to change integrations.</p> : null}
          </article>
        ))}
      </div>
      <SettingsDialog key={configuring?.id ?? 'none'} integration={configuring} onClose={() => setConfiguring(undefined)} />
    </>
  )
}
