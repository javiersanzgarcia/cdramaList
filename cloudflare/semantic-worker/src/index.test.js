import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './index.js'

const ORIGIN = 'https://javiersanzgarcia.github.io'
const MODELS = '@cf/model-a,@cf/model-b'

const envBase = {
  ALLOWED_ORIGINS: ORIGIN,
  AI_MODEL: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  ORIGIN_MODELS: MODELS
}

function makeRequest(entries) {
  return new Request('https://worker.test/api/semantic-fingerprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ entries })
  })
}

const originEntries = [{ id: 'series', text: 'Harem imperial', originOnly: true }]

describe('Worker semántico', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('prueba el siguiente modelo si Cloudflare ha retirado uno', async () => {
    const used = []
    const env = {
      ...envBase,
      AI: {
        run: async (model) => {
          used.push(model)
          if (model === '@cf/model-a') throw new Error('5028: model deprecated')
          return {
            response: '```json\n{"items":[{"id":"series","originCountry":"CN"}]}\n```'
          }
        }
      }
    }

    const response = await worker.fetch(makeRequest(originEntries), env)

    expect(response.status).toBe(200)
    expect((await response.json()).items[0].originCountry).toBe('CN')
    expect(used).toEqual(['@cf/model-a', '@cf/model-b'])
  })

  it('descarta una salida de razonamiento truncada y prueba el siguiente modelo', async () => {
    const used = []
    const env = {
      ...envBase,
      AI_MODEL: undefined,
      AI_MODELS: MODELS,
      AI: {
        run: async (model) => {
          used.push(model)
          if (model === '@cf/model-a') {
            return {
              choices: [
                { message: { content: null, reasoning: 'Pensando... sin JSON todavía' } }
              ]
            }
          }
          return {
            response:
              '{"items":[{"id":"series","fingerprint":{"genres":["romance"]},"originCountry":"CN"}]}'
          }
        }
      }
    }

    const response = await worker.fetch(
      makeRequest([{ id: 'series', text: 'Drama chino' }]),
      env
    )

    expect(response.status).toBe(200)
    expect((await response.json()).items[0].fingerprint.genres).toEqual(['romance'])
    expect(used).toEqual(['@cf/model-a', '@cf/model-b'])
  })

  it('usa el respaldo externo si fallan todos los modelos de Cloudflare', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: '{"items":[{"id":"series","originCountry":"KR"}]}' } }
          ]
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const env = {
      ...envBase,
      FALLBACK_API_KEY: 'demo',
      FALLBACK_API_BASE: 'https://api.groq.com/openai/v1',
      FALLBACK_MODEL: 'openai/gpt-oss-120b',
      AI: {
        run: async () => {
          throw new Error('4006: quota exhausted')
        }
      }
    }

    const response = await worker.fetch(makeRequest(originEntries), env)

    expect(response.status).toBe(200)
    expect((await response.json()).items[0].originCountry).toBe('KR')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
  })

  it('no pide JSON Mode y prueba los modelos de fingerprints en orden', async () => {
    const requests = []
    const used = []
    const env = {
      ...envBase,
      AI_MODEL: undefined,
      AI_MODELS: MODELS,
      AI: {
        run: async (model, body) => {
          used.push(model)
          requests.push(body)
          if (model === '@cf/model-a') throw new Error('5028: model deprecated')
          return {
            response: {
              items: [
                {
                  id: 'series',
                  fingerprint: {
                    genres: ['romance'],
                    tropes: [],
                    roles: [],
                    settings: [],
                    plotElements: []
                  },
                  originCountry: 'CN'
                }
              ]
            }
          }
        }
      }
    }

    const response = await worker.fetch(
      makeRequest([{ id: 'series', text: 'Drama chino' }]),
      env
    )

    expect(response.status).toBe(200)
    expect(used).toEqual(['@cf/model-a', '@cf/model-b'])
    expect(requests[0].response_format).toBeUndefined()
    expect(requests[0].max_tokens).toBe(2048)

    await worker.fetch(makeRequest(originEntries), env)
    expect(requests[2].response_format).toBeUndefined()
    expect(requests[2].max_tokens).toBe(1024)
  })

  it('usa el respaldo externo si fallan también los fingerprints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      id: 'series',
                      fingerprint: {
                        genres: ['romance'],
                        tropes: ['Rebirth!'],
                        roles: [],
                        settings: [],
                        plotElements: []
                      },
                      originCountry: 'CN'
                    }
                  ]
                })
              }
            }
          ]
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const env = {
      ...envBase,
      FALLBACK_API_KEY: 'demo',
      AI: {
        run: async () => {
          throw new Error('4006: quota exhausted')
        }
      }
    }

    const response = await worker.fetch(
      makeRequest([{ id: 'series', text: 'Drama chino' }]),
      env
    )

    expect(response.status).toBe(200)
    expect((await response.json()).items[0].fingerprint.tropes).toEqual(['rebirth'])
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
  })
})
