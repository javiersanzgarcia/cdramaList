import type { Dispatch, SetStateAction } from 'react'
import {
  normalizeTagIds,
  normalizeTagName,
  newTagId,
  pruneDeletedTags,
  pruneSeriesTags
} from './model/tags'
import type { Series } from '../series/types'
import type { Tag } from './types'

interface UseTagActionsOptions {
  tags: Tag[]
  setTags: Dispatch<SetStateAction<Tag[]>>
  setSeries: Dispatch<SetStateAction<Series[]>>
}

/**
 * Acciones sobre las etiquetas globales. Las series guardan solo el id, así que
 * renombrar una etiqueta no necesita reescribir ninguna serie.
 */
export function useTagActions({ tags, setTags, setSeries }: UseTagActionsOptions) {
  function findByName(name: string, exceptId?: string): Tag | undefined {
    const key = name.toLocaleLowerCase()
    return tags.find(
      (tag) => !tag.deletedAt && tag.id !== exceptId && tag.name.toLocaleLowerCase() === key
    )
  }

  /** Crea una etiqueta y devuelve su id, o `null` si el nombre no es válido. */
  function createTag(value: string): string | null {
    const name = normalizeTagName(value)
    if (!name) return null

    const existing = findByName(name)
    if (existing) return existing.id

    const now = Date.now()
    const tag: Tag = { id: newTagId(), name, createdAt: now, updatedAt: now }
    setTags((current) => [...current, tag])
    return tag.id
  }

  /** Renombra una etiqueta; las series la muestran actualizada al instante. */
  function renameTag(id: string, value: string): boolean {
    const name = normalizeTagName(value)
    if (!name) return false
    if (findByName(name, id)) return false

    setTags((current) =>
      current.map((tag) =>
        tag.id === id && !tag.deletedAt && tag.name !== name
          ? { ...tag, name, updatedAt: Date.now() }
          : tag
      )
    )
    return true
  }

  /** Borra una etiqueta con lápida y la quita de todas las series. */
  function deleteTag(id: string): void {
    const now = Date.now()
    const nextTags = pruneDeletedTags(
      tags.map((tag) =>
        tag.id === id && !tag.deletedAt ? { ...tag, deletedAt: now, updatedAt: now } : tag
      )
    )

    setTags(nextTags)
    setSeries((current) => pruneSeriesTags(current, nextTags))
  }

  /** Añade o quita una etiqueta de una serie concreta. */
  function toggleSeriesTag(seriesId: string, tagId: string): void {
    const now = Date.now()

    setSeries((current) =>
      current.map((item) => {
        if (item.id !== seriesId) return item

        const currentIds = normalizeTagIds(item.tagIds)
        const tagIds = currentIds.includes(tagId)
          ? currentIds.filter((id) => id !== tagId)
          : [...currentIds, tagId]

        return { ...item, tagIds, updatedAt: now }
      })
    )
  }

  return { createTag, renameTag, deleteTag, toggleSeriesTag }
}
