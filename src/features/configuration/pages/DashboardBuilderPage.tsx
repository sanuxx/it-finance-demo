import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Eye, GripVertical, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DashboardConfig, DashboardWidget as Widget, WidgetType } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { usePreferences } from '@/app/state/preferences'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { dashboardRepository } from '@/services'
import { defaultDashboard } from '@/data/seed'
import { cn } from '@/lib/utils'
import { SIZE_LABEL, WIDGET_CATALOG, WIDGET_TYPES } from '@/features/dashboard/widgets/catalog'
import { DashboardWidget } from '@/features/dashboard/widgets/DashboardWidget'
import { useDashboardMetrics } from '@/features/dashboard/hooks/useDashboardMetrics'

function newWidgetId() {
  return `w-${Math.random().toString(36).slice(2, 9)}`
}

function SortableRow({
  widget,
  index,
  count,
  selected,
  onSelect,
  onMove,
  onRemove,
  disabled,
}: {
  widget: Widget
  index: number
  count: number
  selected: boolean
  onSelect: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('bg-card flex items-center gap-2 rounded-md border px-2 py-1.5', selected && 'border-primary ring-primary/30 ring-2', isDragging && 'z-10 shadow-lg')}
    >
      <button type="button" className="text-muted-foreground hover:text-foreground cursor-grab rounded p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing" aria-label={`Drag to reorder ${widget.title}. Use space and arrow keys with a keyboard.`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="truncate text-sm font-medium">{widget.title}</div>
        <div className="text-muted-foreground truncate text-xs">
          {WIDGET_CATALOG[widget.type].kind.toUpperCase()} · {SIZE_LABEL[widget.size]}
        </div>
      </button>
      <Button variant="ghost" size="icon-xs" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move ${widget.title} up`}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move ${widget.title} down`}>
        <ArrowDown />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} disabled={disabled} aria-label={`Remove ${widget.title}`}>
        <Trash2 />
      </Button>
    </li>
  )
}

export default function DashboardBuilderPage() {
  const dashboards = useCollection('dashboards')
  const saved = dashboards.find((d) => d.id === 'dash-executive') ?? defaultDashboard(new Date().toISOString())
  const [draft, setDraft] = useState<DashboardConfig>(saved)
  const [selectedId, setSelectedId] = useState<string | undefined>(saved.widgets[0]?.id)
  const [addType, setAddType] = useState<WidgetType>('kpi_mrr')
  const canEdit = usePermission('config.edit')
  const confirm = useConfirm()
  const preset = usePreferences((s) => s.dashboardPreset)
  const metrics = useDashboardMetrics(preset)

  // Pick up external changes (e.g. reset) when there are no local edits.
  const dirty = JSON.stringify(draft.widgets) !== JSON.stringify(saved.widgets) || draft.name !== saved.name
  useEffect(() => {
    if (!dirty) setDraft(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.updatedAt])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const selected = draft.widgets.find((w) => w.id === selectedId)
  const used = useMemo(() => new Set(draft.widgets.map((w) => w.type)), [draft.widgets])

  const update = (widgets: Widget[]) => setDraft((d) => ({ ...d, widgets }))
  const patchSelected = (patch: Partial<Widget>) => update(draft.widgets.map((w) => (w.id === selectedId ? { ...w, ...patch } : w)))

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = draft.widgets.findIndex((w) => w.id === e.active.id)
    const to = draft.widgets.findIndex((w) => w.id === e.over!.id)
    update(arrayMove(draft.widgets, from, to))
  }

  const move = (index: number, dir: -1 | 1) => update(arrayMove(draft.widgets, index, index + dir))

  const add = () => {
    const entry = WIDGET_CATALOG[addType]
    const w: Widget = { id: newWidgetId(), type: addType, title: entry.title, size: entry.size, months: entry.hasMonths ? 12 : undefined }
    update([...draft.widgets, w])
    setSelectedId(w.id)
  }

  const save = async () => {
    if (!draft.name.trim()) return toast.error('Give the dashboard a name.')
    await dashboardRepository.save({ ...draft, name: draft.name.trim() })
    toast.success('Dashboard layout saved in this browser')
  }

  const restore = async () => {
    const { confirmed } = await confirm({ title: 'Restore the default layout?', description: 'Your custom widget selection and order will be replaced with the original executive dashboard.', confirmLabel: 'Restore default', destructive: true })
    if (!confirmed) return
    const def = await dashboardRepository.restoreDefault()
    setDraft(def)
    setSelectedId(def.widgets[0]?.id)
    toast.success('Default dashboard restored')
  }

  return (
    <>
      <PageHeader
        title="Dashboard builder"
        description="Choose widgets for the executive dashboard, arrange them by dragging (or with the arrow buttons), and adjust their size. Changes apply after you save."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <Eye /> Open dashboard
              </Link>
            </Button>
            <Button variant="outline" onClick={restore} disabled={!canEdit}>
              <RotateCcw /> Restore default
            </Button>
            <Button onClick={save} disabled={!canEdit || !dirty}>
              <Save /> {dirty ? 'Save layout' : 'Saved'}
            </Button>
          </>
        }
      />
      {!canEdit ? (
        <SimulatedNotice tone="warning" className="mb-4">
          Your demo role can view but not change dashboard configuration. Switch to Finance Manager or Director from the user menu to edit.
        </SimulatedNotice>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Section title="Dashboard">
            <div className="space-y-1.5">
              <Label htmlFor="dash-name">Name</Label>
              <Input id="dash-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} disabled={!canEdit} />
            </div>
          </Section>
          <Section title="Add a widget">
            <div className="flex gap-2">
              <Select value={addType} onValueChange={(v) => setAddType(v as WidgetType)} disabled={!canEdit}>
                <SelectTrigger className="min-w-0 flex-1" aria-label="Widget to add">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {WIDGET_CATALOG[t].title}
                      {used.has(t) ? ' (in use)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={add} disabled={!canEdit}>
                <Plus /> Add
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">{WIDGET_CATALOG[addType].description}</p>
          </Section>
          <Section title={`Widgets (${draft.widgets.length})`} description="Drag the handle or use the arrows to reorder.">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={draft.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5" aria-label="Dashboard widgets in order">
                  {draft.widgets.map((w, i) => (
                    <SortableRow
                      key={w.id}
                      widget={w}
                      index={i}
                      count={draft.widgets.length}
                      selected={w.id === selectedId}
                      onSelect={() => setSelectedId(w.id)}
                      onMove={(dir) => move(i, dir)}
                      onRemove={() => {
                        update(draft.widgets.filter((x) => x.id !== w.id))
                        if (selectedId === w.id) setSelectedId(undefined)
                      }}
                      disabled={!canEdit}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {!draft.widgets.length ? <p className="text-muted-foreground text-sm">No widgets — add one above.</p> : null}
          </Section>
          {selected ? (
            <Section title="Widget settings" description={WIDGET_CATALOG[selected.type].description}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="w-title">Title</Label>
                  <Input id="w-title" value={selected.title} onChange={(e) => patchSelected({ title: e.target.value })} disabled={!canEdit} maxLength={60} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-size">Size</Label>
                  <Select value={selected.size} onValueChange={(v) => patchSelected({ size: v as Widget['size'] })} disabled={!canEdit}>
                    <SelectTrigger id="w-size" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SIZE_LABEL) as Widget['size'][]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {SIZE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {WIDGET_CATALOG[selected.type].hasMonths ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="w-months">History</Label>
                    <Select value={String(selected.months ?? 12)} onValueChange={(v) => patchSelected({ months: Number(v) })} disabled={!canEdit}>
                      <SelectTrigger id="w-months" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 6, 12, 18, 24].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            Last {n} months
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live preview</h2>
            {dirty ? <span className="text-warning text-xs font-medium">Unsaved changes</span> : <span className="text-muted-foreground text-xs">Matches the saved layout</span>}
          </div>
          <div className="bg-muted/30 rounded-xl border border-dashed p-4" aria-label="Dashboard preview">
            {draft.widgets.length ? (
              <div className="grid grid-cols-4 gap-4">
                {draft.widgets.map((w) => (
                  <div key={w.id} className={cn('contents', w.id === selectedId && '[&>div]:ring-primary/40 [&>div]:rounded-xl [&>div]:ring-2')}>
                    <DashboardWidget widget={w} metrics={metrics} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-10 text-center text-sm">The preview is empty.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
