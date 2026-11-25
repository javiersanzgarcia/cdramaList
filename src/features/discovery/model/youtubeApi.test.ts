import { afterEach, describe, expect, it, vi } from 'vitest'
import { YouTubeError, fetchJson, fetchVideoMeta, searchYouTubeVideos } from './youtubeApi'

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

describe('searchYouTubeVideos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('corrige el título coreano de search.list con el localizado de videos.list', async () => {
    const originalTitle =
      '【시즌 1】남들은 혼자 타임슬립하지만,이들은 특수부대 5인조!현대 전술과 무기로 나라를 구하고 멸망을 뒤집는다!#ai#drama'
    const localizedTitle = 'Otros viajan solos en el tiempo,¡pero 5 soldados modernos se unen para salvar la nación!'

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: { videoId: 'diDQTMPvh88' },
                snippet: {
                  title: originalTitle,
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
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'diDQTMPvh88',
                snippet: {
                  title: originalTitle,
                  localized: { title: localizedTitle },
                  channelId: 'canal',
                  channelTitle: 'Canal',
                  publishedAt: '2026-01-01T00:00:00Z'
                },
                contentDetails: { duration: 'PT10M' }
              }
            ]
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    const videos = await searchYouTubeVideos('5 soldados modernos', 'clave')

    expect(videos).toHaveLength(1)
    expect(videos[0].title).toBe(localizedTitle)
    expect(videos[0].originalTitle).toBe(originalTitle)
    expect(videos[0].durationSeconds).toBe(600)
  })
})
