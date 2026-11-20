import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { APP_NAME } from '../../shared/lib/constants'
import { buildSnapshot } from '../../features/sync/model/drive'
import {
  mergeSeriesCollections,
  normalizeSeries,
  isSeries
} from '../../features/series/model/series'
import { mergeTagCollections, normalizeTags } from '../../features/tags/model/tags'
import type { Series } from '../../features/series/types'
import type { Tag } from '../../features/tags/types'
import type { PlayerState } from '../types'
import type { Filter, SeriesSort } from '../../features/series/types'
import type { ChapterCandidate } from '../../features/discovery/types'

interface UseAppPersistenceOptions {
  allSeries: Series[]
  allTags: Tag[]
  updateSeries: (updater: (current: Series[]) => Series[]) => void
  setTags: Dispatch<SetStateAction<Tag[]>>
  setTagFilter: Dispatch<SetStateAction<string>>
  setListFilter: Dispatch<SetStateAction<Filter>>
  setListQuery: Dispatch<SetStateAction<string>>
  setListSort: Dispatch<SetStateAction<SeriesSort>>
  setTagManagerOpen: Dispatch<SetStateAction<boolean>>
  setSelectedSeriesId: Dispatch<SetStateAction<string | null>>
  setPlayer: Dispatch<SetStateAction<PlayerState | null>>
  setReviewQueue: Dispatch<SetStateAction<string[]>>
  setReviewCandidates: Dispatch<SetStateAction<Record<string, ChapterCandidate[]>>>
  setReviewActiveId: Dispatch<SetStateAction<string | null>>
  setAddOpen: Dispatch<SetStateAction<boolean>>
  setAddTargetId: Dispatch<SetStateAction<string | null>>
}

/**
 * Acciones de persistencia local de la app: reinicio, exportación e importación
 * de datos (incluidas lápidas para que los borrados se propaguen).
 */
export function useAppPersistence({
  allSeries,
  allTags,
  updateSeries,
  setTags,
  setTagFilter,
  setListFilter,
  setListQuery,
  setListSort,
  setTagManagerOpen,
  setSelectedSeriesId,
  setPlayer,
  setReviewQueue,
  setReviewCandidates,
  setReviewActiveId,
  setAddOpen,
  setAddTargetId
}: UseAppPersistenceOptions) {
  const reset = useCallback(() => {
    updateSeries(() => [])
    setTags([])
    setTagFilter('all')
    setListFilter('all')
    setListQuery('')
    setListSort('recent')
    setTagManagerOpen(false)
    setSelectedSeriesId(null)
    setPlayer(null)
    setReviewQueue([])
    setReviewCandidates({})
    setReviewActiveId(null)
    setAddOpen(false)
    setAddTargetId(null)
  }, [
    setAddOpen,
    setAddTargetId,
    setListFilter,
    setListQuery,
    setListSort,
    setPlayer,
    setReviewActiveId,
    setReviewCandidates,
    setReviewQueue,
    setSelectedSeriesId,
    setTagFilter,
    setTagManagerOpen,
    setTags,
    updateSeries
  ])

  const exportData = useCallback(() => {
    // Se exporta también lo borrado (con lápida) para que al importar en otro
    // dispositivo no reaparezca. Las etiquetas viajan con las series.
    const payload = buildSnapshot(allSeries, allTags)

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${APP_NAME}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }, [allSeries, allTags])

  const importData = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as unknown

        let raw: unknown[] | null = null
        let rawTags: unknown[] = []

        if (Array.isArray(parsed)) {
          raw = parsed
        } else if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { series?: unknown }).series)
        ) {
          const record = parsed as { series: unknown[]; tags?: unknown }
          raw = record.series
          rawTags = Array.isArray(record.tags) ? record.tags : []
        }

        if (!raw) throw new Error('Formato no reconocido')

        const imported = raw.filter(isSeries).map(normalizeSeries)
        if (imported.length === 0) throw new Error('Sin series válidas')

        const importedTags = normalizeTags(rawTags)
        updateSeries((current) => mergeSeriesCollections(current, imported))
        if (importedTags.length > 0) {
          setTags((current) => mergeTagCollections(current, importedTags))
        }

        const importedCount = imported.filter((item) => !item.deletedAt).length
        window.alert(
          `Se ${importedCount === 1 ? 'ha importado 1 serie' : `han importado ${importedCount} series`}.`
        )
      } catch {
        window.alert(
          'No se pudo importar el archivo. Asegúrate de que es una copia exportada por CdramaList.'
        )
      }
    },
    [setTags, updateSeries]
  )

  return { reset, exportData, importData }
}
