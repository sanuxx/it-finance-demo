import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { ROLE_LABELS, usePreferences, type Preferences, type ThemePreference } from '@/app/state/preferences'
import { useCurrentUser } from '@/hooks/useSession'

function Row({ id, label, description, children }: { id: string; label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export default function PreferencesPage() {
  const prefs = usePreferences()
  const user = useCurrentUser()
  const confirm = useConfirm()

  const reset = async () => {
    const { confirmed } = await confirm({ title: 'Reset preferences?', description: 'Theme, layout and display options return to their defaults. Demo data is not affected.', confirmLabel: 'Reset preferences' })
    if (confirmed) {
      prefs.resetPreferences()
      toast.success('Preferences reset')
    }
  }

  return (
    <>
      <PageHeader title="App preferences" description={`Personal settings for this browser. Signed in as ${user.name} (${ROLE_LABELS[user.role]}).`} actions={<Button variant="outline" onClick={reset}><RotateCcw /> Reset preferences</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Appearance">
          <Row id="p-theme" label="Theme" description="System follows your operating system setting.">
            <Select value={prefs.theme} onValueChange={(v) => prefs.set({ theme: v as ThemePreference })}>
              <SelectTrigger id="p-theme" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent>
            </Select>
          </Row>
          <Row id="p-compact" label="Compact tables" description="Tighter rows in data tables.">
            <Switch id="p-compact" checked={prefs.compactTables} onCheckedChange={(c) => prefs.set({ compactTables: c })} />
          </Row>
          <Row id="p-sidebar" label="Collapsed sidebar" description="Show icons only on large screens.">
            <Switch id="p-sidebar" checked={prefs.sidebarCollapsed} onCheckedChange={(c) => prefs.set({ sidebarCollapsed: c })} />
          </Row>
          <Row id="p-banner" label="Demo notice banner" description="The strip explaining that data is fictional and local.">
            <Switch id="p-banner" checked={prefs.showDemoBanner} onCheckedChange={(c) => prefs.set({ showDemoBanner: c })} />
          </Row>
        </Section>
        <Section title="Formats & defaults">
          <Row id="p-date" label="Date format">
            <Select value={prefs.dateFormat} onValueChange={(v) => prefs.set({ dateFormat: v as Preferences['dateFormat'] })}>
              <SelectTrigger id="p-date" className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{(['dd MMM yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'] as const).map((f) => <SelectItem key={f} value={f}>{format(new Date(), f)}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row id="p-preset" label="Default dashboard period">
            <DateRangeSelect value={prefs.dashboardPreset} onChange={(v) => prefs.set({ dashboardPreset: v })} />
          </Row>
          <Row id="p-nav" label="Collapsed navigation groups" description={prefs.collapsedNavGroups.length ? `${prefs.collapsedNavGroups.length} group(s) collapsed in the sidebar` : 'All groups expanded'}>
            <Button id="p-nav" variant="outline" size="sm" disabled={!prefs.collapsedNavGroups.length} onClick={() => prefs.set({ collapsedNavGroups: [] })}>Expand all</Button>
          </Row>
        </Section>
      </div>
    </>
  )
}
