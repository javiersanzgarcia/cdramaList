import { afterEach, describe, expect, it, vi } from 'vitest'
import { YouTubeError, fetchJson } from './youtubeApi'

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
})
