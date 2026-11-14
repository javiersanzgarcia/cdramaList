import type { Series } from '../../series/types'
import type { Tag } from '../types'
import { DELETED_TAG_TTL, MAX_TAG_NAME_LENGTH } from './constants'

/** Normaliza el nombre visible de una etiqueta. */
export function normalizeTagName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_NAME_LENGTH)
}

/** IDs de etiqueta asignados a una serie, sin duplicados. */
export function normalizeTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))
  ]
}

/** Limpia y valida la lista de etiquetas leída de localStorage o de Drive. */
export function normalizeTags(value: unknown): Tag[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const tags: Tag[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue

    const record = entry as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    const name = normalizeTagName(record.name)
    if (!id || !name || seen.has(id)) continue

    seen.add(id)
    const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now()
    tags.push({
      id,
      name,
      createdAt,
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : createdAt,
      deletedAt: typeof record.deletedAt === 'number' ? record.deletedAt : undefined
    })
  }

  return tags.sort((left, right) => left.name.localeCompare(right.name))
}

export function newTagId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Etiquetas visibles (sin lápidas) de una serie, ordenadas por nombre. */
export function resolveSeriesTags(series: Series, tags: Tag[]): Tag[] {
  const byId = new Map(tags.filter((tag) => !tag.deletedAt).map((tag) => [tag.id, tag]))

  return (series.tagIds ?? [])
    .map((id) => byId.get(id))
    .filter((tag): tag is Tag => Boolean(tag))
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Quita de las series las referencias a etiquetas que ya no existen o están
 * borradas. No cambia `updatedAt`: es una limpieza derivada, no una edición.
 */
export function pruneSeriesTags(series: Series[], tags: Tag[]): Series[] {
  const valid = new Set(tags.filter((tag) => !tag.deletedAt).map((tag) => tag.id))
  let changed = false

  const next = series.map((item) => {
    const current = item.tagIds ?? []
    const filtered = current.filter((id) => valid.has(id))
    if (filtered.length === current.length) return item

    changed = true
    return { ...item, tagIds: filtered }
  })

  return changed ? next : series
}

function earliest(
  current: number | undefined,
  incoming: number | undefined
): number | undefined {
  if (current == null) return incoming
  if (incoming == null) return current
  return Math.min(current, incoming)
}

function mergeName(base: Tag | undefined, current: Tag, incoming: Tag, newer: Tag): string {
  if (!base) return newer.name
  if (current.name === base.name) return incoming.name
  if (incoming.name === base.name) return current.name
  return newer.name
}

/**
 * Combina las etiquetas de dos dispositivos. El nombre se resuelve con la
 * última copia sincronizada como base (LWW si ambos lo cambiaron) y el borrado
 * es pegajoso: si una copia tiene lápida, la etiqueta queda borrada en ambas.
 */
export function mergeTagCollections(local: Tag[], remote: Tag[], base?: Tag[]): Tag[] {
  const byId = new Map(local.map((tag) => [tag.id, tag]))
  const baseById = new Map((base ?? []).map((tag) => [tag.id, tag]))

  for (const incoming of remote) {
    const current = byId.get(incoming.id)
    if (!current) {
      byId.set(incoming.id, incoming)
      continue
    }

    const previous = baseById.get(incoming.id)
    const newer = incoming.updatedAt > current.updatedAt ? incoming : current

    byId.set(incoming.id, {
      ...newer,
      id: current.id,
      name: mergeName(previous, current, incoming, newer),
      createdAt: Math.min(current.createdAt, incoming.createdAt),
      updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
      deletedAt: earliest(current.deletedAt, incoming.deletedAt)
    })
  }

  return pruneDeletedTags(
    [...byId.values()].sort((left, right) => left.name.localeCompare(right.name))
  )
}

/** Elimina las lápidas de etiquetas con más de `maxAgeMs`. */
export function pruneDeletedTags(
  tags: Tag[],
  maxAgeMs: number = DELETED_TAG_TTL,
  now: number = Date.now()
): Tag[] {
  const kept = tags.filter((tag) => tag.deletedAt == null || now - tag.deletedAt < maxAgeMs)
  return kept.length === tags.length ? tags : kept
}
