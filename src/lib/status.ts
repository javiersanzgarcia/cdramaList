import type { WatchStatus } from '../types'

export const statusOrder: WatchStatus[] = ['watching', 'planned', 'completed']

export const statusMeta: Record<WatchStatus, { label: string; badge: string; dot: string }> = {
  watching: {
    label: 'Viendo',
    badge: 'bg-rose-500/90 text-white',
    dot: 'bg-rose-400',
  },
  planned: {
    label: 'Pendiente',
    badge: 'bg-amber-400/90 text-amber-950',
    dot: 'bg-amber-400',
  },
  completed: {
    label: 'Visto',
    badge: 'bg-emerald-500/90 text-white',
    dot: 'bg-emerald-400',
  },
}
