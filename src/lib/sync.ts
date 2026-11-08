import type { Series, SyncConfig } from '../types'
import { isSeries, normalizeSeries } from './series'

const API = 'https://api.github.com'

export type SyncErrorCode =
  | 'auth'
  | 'notfound'
  | 'conflict'
  | 'quota'
  | 'network'
  | 'format'

export class SyncError extends Error {
  code?: SyncErrorCode

  constructor(message: string, code?: SyncErrorCode) {
    super(message)
    this.name = 'SyncError'
    this.code = code
  }
}

export interface RemoteSnapshot {
  series: Series[]
  sha: string
  exportedAt?: string
}

export function defaultSyncPath(sub?: string): string {
  return sub ? `cdramalist/${sub}.json` : 'cdramalist/data.json'
}

export function validateSyncConfig(config: SyncConfig): string | null {
  if (!config.token.trim()) return 'Falta el token de GitHub.'
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo.trim())) {
    return 'El repositorio debe tener el formato usuario/repositorio.'
  }
  if (!config.branch.trim()) return 'Falta la rama.'
  if (!config.path.trim()) return 'Falta la ruta del archivo.'
  if (config.path.startsWith('/') || config.path.includes('..')) {
    return 'La ruta del archivo no es válida.'
  }
  return null
}

export function isSyncConfigured(config: SyncConfig): boolean {
  return validateSyncConfig(config) === null
}

function repoParts(config: SyncConfig) {
  const [owner, repo] = config.repo.trim().split('/')
  return { owner, repo }
}

function encodePath(path: string): string {
  return path
    .trim()
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function headers(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function githubFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' })
  } catch {
    throw new SyncError('No se pudo conectar con GitHub. Revisa tu conexión.', 'network')
  }
}

function errorForStatus(status: number, action: 'leer' | 'escribir'): SyncError {
  if (status === 401) {
    return new SyncError('El token de GitHub no es válido o ha caducado.', 'auth')
  }
  if (status === 403) {
    return new SyncError(
      'El token no tiene permisos suficientes o se ha superado el límite de peticiones de GitHub.',
      'quota',
    )
  }
  if (status === 404) {
    return new SyncError(
      'No se encontró el repositorio, la rama o el archivo en GitHub.',
      'notfound',
    )
  }
  if (status === 409 || status === 422) {
    return new SyncError(
      'El archivo ha cambiado en la nube. Sincroniza de nuevo para combinar los cambios.',
      'conflict',
    )
  }
  return new SyncError(`GitHub respondió con el código ${status} al ${action}.`)
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export async function verifySyncConfig(config: SyncConfig): Promise<void> {
  const error = validateSyncConfig(config)
  if (error) throw new SyncError(error)

  const { owner, repo } = repoParts(config)
  const response = await githubFetch(`${API}/repos/${owner}/${repo}`, {
    headers: headers(config.token),
  })

  if (!response.ok) throw errorForStatus(response.status, 'leer')

  const branchResponse = await githubFetch(
    `${API}/repos/${owner}/${repo}/branches/${encodeURIComponent(config.branch.trim())}`,
    { headers: headers(config.token) },
  )

  if (branchResponse.status === 404) {
    throw new SyncError(
      `No se encontró la rama «${config.branch.trim()}» en el repositorio.`,
      'notfound',
    )
  }
  if (!branchResponse.ok) throw errorForStatus(branchResponse.status, 'leer')
}

export async function pullRemote(config: SyncConfig): Promise<RemoteSnapshot | null> {
  const error = validateSyncConfig(config)
  if (error) throw new SyncError(error)

  const { owner, repo } = repoParts(config)
  const url = `${API}/repos/${owner}/${repo}/contents/${encodePath(config.path)}?ref=${encodeURIComponent(config.branch.trim())}`
  const response = await githubFetch(url, { headers: headers(config.token) })

  if (response.status === 404) return null
  if (!response.ok) throw errorForStatus(response.status, 'leer')

  const data = (await response.json()) as {
    content?: string
    sha?: string
    encoding?: string
  }

  if (!data.sha) {
    throw new SyncError('GitHub no devolvió el identificador del archivo.', 'format')
  }

  if (!data.content) return { series: [], sha: data.sha }

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeBase64(data.content))
  } catch {
    throw new SyncError('El archivo de la nube no contiene JSON válido.', 'format')
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { series?: unknown }).series)
      ? (parsed as { series: unknown[] }).series
      : null

  if (!raw) {
    throw new SyncError('El archivo de la nube no tiene el formato de CdramaList.', 'format')
  }

  return {
    series: raw.filter(isSeries).map(normalizeSeries),
    sha: data.sha,
    exportedAt:
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { exportedAt?: unknown }).exportedAt === 'string'
        ? (parsed as { exportedAt: string }).exportedAt
        : undefined,
  }
}

function canonicalSeries(series: Series) {
  return {
    id: series.id,
    title: series.title,
    channelId: series.channelId ?? null,
    channelTitle: series.channelTitle,
    channelUrl: series.channelUrl ?? null,
    thumbnail: series.thumbnail ?? null,
    favorite: series.favorite,
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
    lastOpenedAt: series.lastOpenedAt ?? null,
    watched: [...series.watched].sort(),
    parts: series.parts
      .map((part) => ({
        videoId: part.videoId,
        title: part.title,
        partNumber: part.partNumber ?? null,
        totalParts: part.totalParts ?? null,
        isFinal: Boolean(part.isFinal),
        durationSeconds: part.durationSeconds ?? null,
        publishedAt: part.publishedAt ?? null,
        thumbnail: part.thumbnail ?? null,
        addedAt: part.addedAt,
      }))
      .sort((a, b) => a.videoId.localeCompare(b.videoId)),
  }
}

export function seriesCollectionsEqual(a: Series[], b: Series[]): boolean {
  if (a.length !== b.length) return false

  const canonical = (list: Series[]) =>
    list
      .map(canonicalSeries)
      .sort((left, right) => left.id.localeCompare(right.id))

  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

export async function pushRemote(
  config: SyncConfig,
  series: Series[],
  sha?: string,
): Promise<{ sha: string }> {
  const error = validateSyncConfig(config)
  if (error) throw new SyncError(error)

  const { owner, repo } = repoParts(config)
  const payload = {
    app: 'cdramalist',
    version: 2,
    exportedAt: new Date().toISOString(),
    series,
  }

  const body: Record<string, unknown> = {
    message: `chore(cdramalist): sincronizar datos ${new Date().toISOString()}`,
    content: encodeBase64(JSON.stringify(payload, null, 2)),
    branch: config.branch.trim(),
  }
  if (sha) body.sha = sha

  const response = await githubFetch(
    `${API}/repos/${owner}/${repo}/contents/${encodePath(config.path)}`,
    {
      method: 'PUT',
      headers: headers(config.token, true),
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) throw errorForStatus(response.status, 'escribir')

  const data = (await response.json()) as { content?: { sha?: string } }
  const newSha = data.content?.sha

  if (!newSha) {
    throw new SyncError('GitHub no confirmó la escritura del archivo.', 'format')
  }

  return { sha: newSha }
}
