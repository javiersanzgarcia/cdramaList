const ISO_DURATION =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

export function parseIsoDuration(iso?: string): number | undefined {
  if (!iso) return undefined

  const match = ISO_DURATION.exec(iso)
  if (!match) return undefined

  const [, days, hours, minutes, seconds] = match
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)

  return total > 0 ? total : undefined
}

export function formatDuration(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined

  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const rest = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }

  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
