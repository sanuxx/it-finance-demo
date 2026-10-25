import { NAVIGATION, type NavGroup } from '@/app/navigation'
import { useCan } from '@/hooks/useSession'

export function useVisibleNavigation(): NavGroup[] {
  const can = useCan()
  return NAVIGATION.filter((g) => !g.permission || can(g.permission))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length > 0)
}
