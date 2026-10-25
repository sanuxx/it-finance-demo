import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BellOff, CheckCheck, CheckCircle2, ClipboardCheck, Info, Trash2 } from 'lucide-react'
import type { AppNotification } from '@/domain'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/feedback/Feedback'
import { useCollection } from '@/hooks/useData'
import { notificationRepository } from '@/services'
import { formatDateTime, formatRelative } from '@/lib/formatting'
import { cn } from '@/lib/utils'

const ICON: Record<AppNotification['kind'], typeof Info> = { info: Info, warning: AlertTriangle, success: CheckCircle2, approval: ClipboardCheck }
const ICON_CLASS: Record<AppNotification['kind'], string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/10 text-success',
  approval: 'bg-primary/10 text-primary',
}
const KIND_LABEL: Record<AppNotification['kind'], string> = { info: 'Info', warning: 'Warning', success: 'Success', approval: 'Approval' }

type Filter = 'all' | 'unread' | AppNotification['kind']

export default function NotificationsPage() {
  const notifications = useCollection('notifications')
  const [filter, setFilter] = useState<Filter>('all')
  const unread = notifications.filter((n) => !n.read).length
  const list = useMemo(() => notifications.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : n.kind === filter)), [notifications, filter])

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts raised by business rules, workflows and demo activity. Nothing here is sent by email."
        actions={
          <Button variant="outline" size="sm" onClick={() => notificationRepository.markAllRead()} disabled={!unread}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread})</TabsTrigger>
          {(Object.keys(KIND_LABEL) as AppNotification['kind'][]).map((k) => (
            <TabsTrigger key={k} value={k}>
              {KIND_LABEL[k]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {list.length ? (
        <ul className="bg-card divide-y rounded-xl border">
          {list.map((n) => {
            const Icon = ICON[n.kind]
            return (
              <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3.5', !n.read && 'bg-primary/[0.03]')}>
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', ICON_CLASS[n.kind])}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.read ? <span className="bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-semibold uppercase">New</span> : null}
                    <span className="text-muted-foreground text-xs" title={formatDateTime(n.at)}>
                      {KIND_LABEL[n.kind]} · {formatRelative(n.at)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">{n.body}</p>
                  {n.link ? (
                    <Link to={n.link} onClick={() => notificationRepository.markRead(n.id)} className="text-primary mt-1 inline-block text-xs font-medium hover:underline">
                      Open related record
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!n.read ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => notificationRepository.markRead(n.id)} aria-label={`Mark "${n.title}" as read`}>
                      <CheckCheck />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon-sm" onClick={() => notificationRepository.remove(n.id)} aria-label={`Delete "${n.title}"`}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon={<BellOff />} title="No notifications" description={filter === 'all' ? 'Rules and workflows will post alerts here.' : 'Nothing matches this filter.'} />
      )}
    </>
  )
}
