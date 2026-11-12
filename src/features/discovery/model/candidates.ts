import type { ChapterCandidate } from '../types'
import type { Part } from '../../series/types'

export interface CandidateState {
  numbers: Record<string, string>
  finals: Record<string, boolean>
}

/**
 * Asigna un número por defecto a cada candidato: usa el detectado si está
 * libre y, si no, el siguiente hueco disponible.
 */
export function buildCandidateState(
  candidates: ChapterCandidate[],
  parts: Part[]
): CandidateState {
  const used = new Set<number>()
  for (const part of parts) {
    if (part.partNumber != null) used.add(part.partNumber)
  }

  let next = Math.max(0, ...parts.map((part) => part.partNumber ?? 0)) + 1
  const numbers: Record<string, string> = {}
  const finals: Record<string, boolean> = {}

  for (const candidate of candidates) {
    let value = candidate.partNumber
    if (value == null || used.has(value)) {
      value = next
      while (used.has(value)) value += 1
    }

    used.add(value)
    next = Math.max(next, value + 1)
    numbers[candidate.videoId] = String(value)
    finals[candidate.videoId] = Boolean(candidate.isFinal)
  }

  return { numbers, finals }
}

export function parseCandidateNumber(value: string): number | undefined {
  const raw = value.trim()
  return raw === '' ? undefined : Number(raw)
}

/**
 * Valida el número elegido para un candidato. Tiene en cuenta las partes ya
 * existentes y los números asignados al resto de candidatos.
 */
export function validateCandidateNumber(
  value: string,
  parts: Part[],
  otherNumbers: Record<string, string> = {},
  currentVideoId?: string
): string | undefined {
  const partNumber = parseCandidateNumber(value)
  if (partNumber == null) return undefined

  if (!Number.isInteger(partNumber) || partNumber <= 0) {
    return 'Escribe un número de capítulo válido.'
  }

  if (parts.some((part) => part.partNumber === partNumber)) {
    return `El número ${partNumber} ya está ocupado por otra parte.`
  }

  const duplicate = Object.entries(otherNumbers).some(
    ([videoId, raw]) =>
      videoId !== currentVideoId &&
      raw.trim() !== '' &&
      Number(raw) === partNumber
  )

  if (duplicate) {
    return `El número ${partNumber} ya está asignado a otro candidato.`
  }

  return undefined
}
