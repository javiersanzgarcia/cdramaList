import { useRef } from 'react'
import type { ChapterCandidate, SeriesRefreshResult } from '../discovery/types'
import { candidateToPart } from '../discovery/model/youtubeDrafts'
import { discoverSeriesUpdates } from '../discovery/model/seriesUpdates'
import { fetchVideosByIds } from '../discovery/model/youtubeApi'
import { YOUTUBE_CHANNEL_FALLBACK } from '../discovery/model/constants'
import { reorderParts, sortParts } from './model/parts'
import {
  applyPartDurations,
  applyPartMeta,
  clearRemovedParts,
  createSeries,
  filterRemovedParts,
  learnKeywordConfidence,
  mergeAliasesWithParts,
  mergeParts,
  mergeSeries,
  reconcileCompletedStatus
} from './model/series'
import type {
  Part,
  PartMetaPatch,
  RefreshFavoritesResult,
  Series,
  SeriesDraft,
  SeriesStatus,
  UseSeriesActionsOptions
} from './types'

export function useSeriesActions({
  series,
  setSeries,
  apiKey,
  semanticEndpoint,
  drive,
  setSelectedSeriesId,
  setPlayer,
  setAddTargetId,
  setAddOpen
}: UseSeriesActionsOptions) {
  // Evita que el lote de favoritas se lance dos veces mientras sigue en curso,
  // aunque la vista que lo inició se haya desmontado y vuelto a montar.
  const favoritesRunningRef = useRef(false)
  // Vídeos cuya duración ya se ha intentado obtener en esta sesión. Evita
  // repetir la petición en cada apertura (y la duplicidad entre la ficha y el
  // reproductor), sobre todo cuando YouTube no devuelve metadatos.
  const durationAttemptsRef = useRef(new Set<string>())

  function updateSeries(updater: (current: Series[]) => Series[]) {
    setSeries((current) => updater(current))
  }

  function openSeries(item: Series) {
    // Abrir la serie no cuenta como progreso: solo reproducir una parte
    // cambia el estado automático a «en curso».
    setSelectedSeriesId(item.id)
  }

  function playSeries(item: Series, index: number) {
    const safeIndex = Math.min(
      Math.max(index, 0),
      Math.max(item.parts.length - 1, 0)
    )

    setPlayer({ seriesId: item.id, index: safeIndex })
    // Reproducir no elige estado: «en curso»/«completada» se deducen del
    // progreso y de `lastOpenedAt`, así que un estado manual nunca se pisa.
    updateSeries((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? { ...existing, lastOpenedAt: Date.now(), updatedAt: Date.now() }
          : existing
      )
    )
  }

  function toggleFavorite(id: string) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, favorite: !item.favorite, updatedAt: Date.now() }
          : item
      )
    )
  }

  /** Cambia la portada de la serie por la de otra de sus partes. */
  function setSeriesThumbnail(id: string, thumbnail: string) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, thumbnail, updatedAt: Date.now() } : item
      )
    )
  }

  function setSeriesStatus(id: string, status: SeriesStatus) {
    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== id) return item

        const partIds = item.parts.map((part) => part.videoId)
        const watchedAll =
          partIds.length > 0 &&
          partIds.every((videoId) => item.watched.includes(videoId))

        // «Completada» da por vistas todas las partes; cualquier otro estado
        // deja de estarlo, para que el estado y el progreso no se contradigan
        // (una serie no completada nunca puede estar al 100 %).
        const watched =
          status === 'completed'
            ? [...new Set([...item.watched, ...partIds])]
            : watchedAll
              ? []
              : item.watched

        const sameWatched =
          watched.length === item.watched.length &&
          watched.every((videoId) => item.watched.includes(videoId))
        if (status === item.status && sameWatched) return item

        return { ...item, status, watched, updatedAt: Date.now() }
      })
    )
  }

  function updateAliases(id: string, aliases: string[]) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === id ? { ...item, aliases, updatedAt: Date.now() } : item
      )
    )
  }

  function updatePartMeta(
    seriesId: string,
    videoId: string,
    patch: PartMetaPatch
  ) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === seriesId ? applyPartMeta(item, videoId, patch) : item
      )
    )
  }

  async function fillMissingDurations(item: Series): Promise<void> {
    if (!apiKey) return

    const missing = item.parts.filter(
      (part) =>
        part.durationSeconds == null &&
        !durationAttemptsRef.current.has(part.videoId)
    )
    if (missing.length === 0) return

    const videoIds = missing.map((part) => part.videoId)
    // Se marcan antes de pedirlas para que abrir la ficha y el reproductor a la
    // vez no lance la misma petición dos veces.
    for (const videoId of videoIds) durationAttemptsRef.current.add(videoId)

    try {
      const metas = await fetchVideosByIds(videoIds, apiKey)
      if (metas.size === 0) return

      updateSeries((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? applyPartDurations(existing, metas)
            : existing
        )
      )
    } catch {
      // La duración es informativa: si falla (por ejemplo, sin conexión) se
      // permite reintentar más tarde en vez de darla por perdida.
      for (const videoId of videoIds) {
        durationAttemptsRef.current.delete(videoId)
      }
    }
  }

  function updateTitle(id: string, title: string) {
    const nextTitle = title.trim().replace(/\s+/g, ' ')
    if (nextTitle.length < 2) return

    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== id || nextTitle === item.title) return item

        return {
          ...item,
          title: nextTitle,
          aliases: mergeAliasesWithParts(item.aliases, item.parts, nextTitle),
          updatedAt: Date.now()
        }
      })
    )
  }

  function setWatched(seriesId: string, videoId: string, watched: boolean) {
    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== seriesId) return item

        const already = item.watched.includes(videoId)
        if (already === watched) return item

        const nextWatched = watched
          ? [...item.watched, videoId]
          : item.watched.filter((id) => id !== videoId)
        const coversAll =
          item.parts.length > 0 &&
          item.parts.every((part) => nextWatched.includes(part.videoId))

        return {
          ...item,
          watched: nextWatched,
          // El estado se deduce del progreso: al cubrir (o dejar de cubrir)
          // todas las partes se descarta el estado manual para que no quede una
          // serie «completada» a medias. Otro estado manual se respeta.
          status:
            coversAll || item.status === 'completed' ? undefined : item.status,
          updatedAt: Date.now()
        }
      })
    )
  }

  function movePart(seriesId: string, fromIndex: number, toIndex: number) {
    updateSeries((current) =>
      current.map((item) =>
        item.id === seriesId
          ? {
              ...item,
              parts: reorderParts(item.parts, fromIndex, toIndex),
              updatedAt: Date.now()
            }
          : item
      )
    )
  }

  function removePart(seriesId: string, videoId: string) {
    updateSeries((current) =>
      current.map((item) => {
        if (item.id !== seriesId) return item
        if (!item.parts.some((part) => part.videoId === videoId)) return item

        const parts = item.parts.filter((part) => part.videoId !== videoId)
        const watched = item.watched.filter((id) => id !== videoId)
        const removedAt = Date.now()

        return {
          ...item,
          parts,
          // La parte quitada deja de contar como vista aunque lo estuviera.
          watched,
          // Lápida de la parte: impide que el merge de la sincronización la
          // re-añada desde otra copia que todavía la tenga. Se levanta sola si
          // la parte se vuelve a añadir después.
          removedParts: { ...(item.removedParts ?? {}), [videoId]: removedAt },
          // Además no se vuelve a proponer en las búsquedas de capítulos.
          discardedCandidates: [
            ...new Set([...(item.discardedCandidates ?? []), videoId])
          ],
          // Al cambiar las partes, un «completada» manual puede haber dejado de
          // cubrir la serie; el automático se recalcula solo con seriesStatus.
          status: reconcileCompletedStatus(item.status, watched, parts),
          updatedAt: removedAt
        }
      })
    )
  }

  function handleSave(draft: SeriesDraft, title: string, parts: Part[]) {
    const existing = draft.existingSeriesId
      ? series.find((item) => item.id === draft.existingSeriesId)
      : undefined

    if (existing) {
      updateSeries((current) =>
        current.map((item) =>
          item.id === existing.id
            ? mergeSeries(item, draft, title, parts)
            : item
        )
      )
      setSelectedSeriesId(existing.id)
    } else {
      const created = createSeries(draft, title, parts)
      updateSeries((current) => [created, ...current])
      setSelectedSeriesId(created.id)
    }

    setAddOpen(false)
    setAddTargetId(null)
  }

  function deleteSeries(id: string) {
    // En lugar de eliminarla, se marca con una lápida: así el borrado llega a
    // los demás dispositivos y no vuelve a subirse desde su copia local.
    updateSeries((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, deletedAt: Date.now(), updatedAt: Date.now() }
          : item
      )
    )
    setSelectedSeriesId((current) => (current === id ? null : current))
    setPlayer((current) => (current?.seriesId === id ? null : current))
    setAddTargetId((current) => (current === id ? null : current))
    setAddOpen(false)
  }

  function handleAddParts(item: Series) {
    setSelectedSeriesId(item.id)
    setAddTargetId(item.id)
    setAddOpen(true)
  }

  async function handleRefreshSeries(
    item: Series
  ): Promise<SeriesRefreshResult> {
    if (!apiKey) {
      throw new Error(
        'Configura la clave de YouTube en Ajustes para buscar capítulos nuevos.'
      )
    }

    const update = await discoverSeriesUpdates(item, apiKey, semanticEndpoint)
    const learnedFingerprint =
      !item.semanticFingerprint && Boolean(update.semanticFingerprint)

    if (update.added.length === 0 && !learnedFingerprint) {
      return {
        added: 0,
        candidates: update.candidates,
        parts: update.parts,
        warnings: update.warnings,
        synced: false
      }
    }

    // La búsqueda puede durar hasta un minuto: se aplica el resultado sobre la
    // copia más reciente de la serie, no sobre la que había al pulsar.
    let nextSeries: Series[] = series
    updateSeries((current) => {
      nextSeries = current.map((existing) => {
        if (existing.id !== item.id || existing.deletedAt) return existing

        // Se conservan las partes añadidas o editadas durante la búsqueda, pero
        // no se reintroduce un vídeo quitado a mano de la serie.
        const parts = filterRemovedParts(
          mergeParts(existing.parts, update.parts),
          existing.removedParts
        )

        return {
          ...existing,
          channelId: existing.channelId ?? update.channelId,
          channelTitle:
            existing.channelTitle === YOUTUBE_CHANNEL_FALLBACK &&
            update.channelTitle
              ? update.channelTitle
              : existing.channelTitle,
          channelUrl: existing.channelUrl ?? update.channelUrl,
          parts,
          // Si se han añadido capítulos, un «completada» que ya no cubre todas
          // las partes se descarta y el estado vuelve a deducirse del progreso.
          status:
            update.added.length > 0
              ? reconcileCompletedStatus(
                  existing.status,
                  existing.watched,
                  parts
                )
              : existing.status,
          semanticFingerprint:
            update.semanticFingerprint ?? existing.semanticFingerprint,
          updatedAt: Date.now()
        }
      })
      return nextSeries
    })

    let synced = false
    if (drive.connected) {
      synced = await drive.syncNow(nextSeries)
    }

    return {
      added: update.added.length,
      candidates: update.candidates,
      // Se devuelven las partes realmente guardadas, incluidos los cambios
      // hechos mientras se buscaban capítulos.
      parts:
        nextSeries.find((existing) => existing.id === item.id)?.parts ??
        update.parts,
      warnings: update.warnings,
      synced
    }
  }

  /** Guarda un candidato descartado para no volver a proponerlo. */
  function discardCandidate(item: Series, videoId: string) {
    updateSeries((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? {
              ...existing,
              discardedCandidates: [
                ...new Set([...(existing.discardedCandidates ?? []), videoId])
              ],
              updatedAt: Date.now()
            }
          : existing
      )
    )
  }

  /**
   * Actualiza todas las series favoritas de una vez. Devuelve los ids de las
   * que tienen novedades (capítulos nuevos o candidatos) para revisarlas, y se
   * sincroniza una sola vez al terminar.
   */
  async function handleRefreshFavorites(): Promise<RefreshFavoritesResult> {
    if (favoritesRunningRef.current) {
      return {
        updatedIds: [],
        candidatesById: {},
        failed: 0,
        warnings: [],
        syncFailed: false
      }
    }

    favoritesRunningRef.current = true

    try {
      if (!apiKey) {
        throw new Error(
          'Configura la clave de YouTube en Ajustes para buscar capítulos nuevos.'
        )
      }

      const favorites = series.filter(
        (item) => item.favorite && !item.deletedAt
      )
      if (favorites.length === 0) {
        return {
          updatedIds: [],
          candidatesById: {},
          failed: 0,
          warnings: [],
          syncFailed: false
        }
      }

      let next = series
      const updatedById = new Map<string, Series>()
      const updatedIds: string[] = []
      const candidatesById: Record<string, ChapterCandidate[]> = {}
      const warnings = new Set<string>()
      let failed = 0

      for (const favorite of favorites) {
        const current = next.find((item) => item.id === favorite.id) ?? favorite

        try {
          const update = await discoverSeriesUpdates(
            current,
            apiKey,
            semanticEndpoint
          )

          for (const warning of update.warnings) warnings.add(warning)

          const hasNews =
            update.added.length > 0 || update.candidates.length > 0
          // Aunque no haya novedades, un fingerprint semántico aprendido en
          // esta búsqueda debe guardarse para no repetir el trabajo.
          const learnedFingerprint =
            !current.semanticFingerprint && Boolean(update.semanticFingerprint)

          if (!hasNews && !learnedFingerprint) {
            continue
          }

          // Igual que en la búsqueda individual: no se reintroduce un vídeo
          // quitado a mano de la serie.
          const parts = filterRemovedParts(
            mergeParts(current.parts, update.parts),
            current.removedParts
          )
          const merged: Series = {
            ...current,
            channelId: current.channelId ?? update.channelId,
            channelTitle:
              current.channelTitle === YOUTUBE_CHANNEL_FALLBACK &&
              update.channelTitle
                ? update.channelTitle
                : current.channelTitle,
            channelUrl: current.channelUrl ?? update.channelUrl,
            parts,
            status:
              update.added.length > 0
                ? reconcileCompletedStatus(
                    current.status,
                    current.watched,
                    parts
                  )
                : current.status,
            semanticFingerprint:
              update.semanticFingerprint ?? current.semanticFingerprint,
            updatedAt: Date.now()
          }

          next = next.map((item) => (item.id === current.id ? merged : item))
          updatedById.set(current.id, merged)

          if (hasNews) {
            updatedIds.push(current.id)
            candidatesById[current.id] = update.candidates
          }
        } catch {
          failed += 1
        }
      }

      let syncFailed = false

      if (updatedById.size > 0) {
        // Se aplican solo las series actualizadas sobre el estado más reciente,
        // no se reemplaza toda la lista con el snapshot inicial del lote.
        let nextSeries: Series[] = series
        updateSeries((current) => {
          nextSeries = current.map((item) => updatedById.get(item.id) ?? item)
          return nextSeries
        })
        // Una sola sincronización al terminar, no una por cada serie.
        if (drive.connected) {
          syncFailed = !(await drive.syncNow(nextSeries))
        }
      }

      return {
        updatedIds,
        candidatesById,
        failed,
        warnings: [...warnings],
        syncFailed
      }
    } finally {
      favoritesRunningRef.current = false
    }
  }

  async function handleAddCandidate(
    item: Series,
    candidate: ChapterCandidate,
    options: { partNumber?: number; isFinal?: boolean }
  ): Promise<{ synced: boolean }> {
    if (item.parts.some((part) => part.videoId === candidate.videoId)) {
      return { synced: false }
    }

    const part = candidateToPart(candidate, options)

    // La confirmación del candidato comparte tiempo con otros cambios (vistos,
    // estado, partes añadidas…), así que se aplica sobre la copia más reciente
    // y no sobre la que había al pulsar «Añadir».
    let nextSeries: Series[] = series
    updateSeries((current) => {
      nextSeries = current.map((existing) => {
        if (existing.id !== item.id || existing.deletedAt) return existing
        // Si otra ruta ya añadió el capítulo, no se duplica ni se toca la serie.
        if (
          existing.parts.some((current) => current.videoId === part.videoId)
        ) {
          return existing
        }

        const nextParts = sortParts([...existing.parts, part])

        return {
          ...existing,
          parts: nextParts,
          // Confirmar un candidato es una re-adición explícita: levanta la
          // lápida de la parte y la saca de los descartados.
          removedParts: clearRemovedParts(existing.removedParts, [
            part.videoId
          ]),
          discardedCandidates: (existing.discardedCandidates ?? []).filter(
            (videoId) => videoId !== part.videoId
          ),
          status: reconcileCompletedStatus(
            existing.status,
            existing.watched,
            nextParts
          ),
          keywordConfidence: learnKeywordConfidence(
            existing.keywordConfidence,
            [
              candidate.title,
              ...(candidate.descriptionTitle
                ? [candidate.descriptionTitle]
                : [])
            ]
          ),
          updatedAt: Date.now()
        }
      })
      return nextSeries
    })

    let synced = false
    if (drive.connected) {
      synced = await drive.syncNow(nextSeries)
    }

    return { synced }
  }

  return {
    updateSeries,
    openSeries,
    playSeries,
    toggleFavorite,
    setSeriesThumbnail,
    setSeriesStatus,
    updateAliases,
    updateTitle,
    updatePartMeta,
    fillMissingDurations,
    setWatched,
    movePart,
    removePart,
    handleSave,
    deleteSeries,
    handleAddParts,
    handleRefreshSeries,
    handleRefreshFavorites,
    handleAddCandidate,
    discardCandidate
  }
}
