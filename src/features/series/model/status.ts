import type { SeriesStatus } from '../types'

export const statusOrder: SeriesStatus[] = ['watching', 'planned', 'completed']

export const statusMeta: Record<
  SeriesStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  planned: {
    label: 'Pendientes',
    badge: 'bg-warning/90 text-on-warning',
    dot: 'bg-warning',
    description: 'Series guardadas para empezar'
  },
  watching: {
    label: 'En curso',
    badge: 'bg-brand/90 text-ink-bright',
    dot: 'bg-brand-bright',
    description: 'Series que ya has empezado'
  },
  completed: {
    label: 'Completadas',
    badge: 'bg-success-strong/90 text-ink-bright',
    dot: 'bg-success',
    description: 'Series que ya has terminado'
  }
}
