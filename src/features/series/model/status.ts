import type { SeriesStatus } from '../types'

export const statusOrder: SeriesStatus[] = ['watching', 'planned', 'completed']

export const statusMeta: Record<
  SeriesStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  watching: {
    label: 'En curso',
    badge: 'bg-rose-500/90 text-white',
    dot: 'bg-rose-400',
    description: 'Series que ya has empezado',
  },
  planned: {
    label: 'Pendientes',
    badge: 'bg-amber-400/90 text-amber-950',
    dot: 'bg-amber-400',
    description: 'Series guardadas para empezar',
  },
  completed: {
    label: 'Completadas',
    badge: 'bg-emerald-500/90 text-white',
    dot: 'bg-emerald-400',
    description: 'Series que ya has terminado',
  },
}
