import { afterEach, describe, expect, it, vi } from 'vitest'
import { YouTubeError, fetchJson, fetchVideoMeta } from './youtubeApi'

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reconoce el agotamiento diario de la cuota de búsquedas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message:
                "Quota exceeded for quota metric 'Search Queries' and limit 'Search Queries per day'",
              errors: [{ reason: 'rateLimitExceeded' }]
            }
          }),
          { status: 429 }
        )
      )
    )

    try {
      await fetchJson('search', { q: 'drama' }, 'clave')
      throw new Error('Debería haber lanzado un error')
    } catch (cause) {
      expect(cause).toBeInstanceOf(YouTubeError)
      expect((cause as YouTubeError).reason).toBe('quotaExceeded')
      expect((cause as Error).message).toContain('cuota diaria de búsquedas')
    }
  })

  it('pide hl=es a la API de YouTube', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchJson('videos', { part: 'snippet', id: 'abc' }, 'clave')

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('hl')).toBe('es')
    expect(url.searchParams.get('key')).toBe('clave')
  })
})

describe('fetchVideoMeta', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa el título localizado en español y conserva el original', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'Id7vk_f7yeI',
                snippet: {
                  title: '【시즌 4】5인 특수부대가 함께 과거로!',
                  localized: {
                    title: '5 soldados modernos viajan al pasado, crean una base'
                  },
                  channelId: 'canal',
                  channelTitle: '짜릿한 남성향 드라마',
                  publishedAt: '2026-01-01T00:00:00Z',
                  description: 'Descripción en coreano',
                  defaultLanguage: 'ko'
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
    )

    const video = await fetchVideoMeta('Id7vk_f7yeI', 'clave')

    expect(video.title).toBe('5 soldados modernos viajan al pasado, crean una base')
    expect(video.originalTitle).toBe('【시즌 4】5인 특수부대가 함께 과거로!')
    expect(video.description).toBe('Descripción en coreano')
  })

  it('no inventa un título original si no hay localización', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'abc',
                snippet: {
                  title: 'Título en español',
                  localized: { title: '' },
                  channelId: 'canal',
                  channelTitle: 'Canal',
                  publishedAt: '2026-01-01T00:00:00Z'
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
    )

    const video = await fetchVideoMeta('abc', 'clave')

    expect(video.title).toBe('Título en español')
    expect(video.originalTitle).toBeUndefined()
  })
})
