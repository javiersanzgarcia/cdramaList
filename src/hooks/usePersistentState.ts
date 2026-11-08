import { useEffect, useState } from 'react'

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  sanitize?: (value: unknown) => T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (!stored) return initialValue

      const parsed = JSON.parse(stored) as unknown
      return sanitize ? sanitize(parsed) : (parsed as T)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Sin espacio o en modo privado: mantenemos el estado en memoria.
    }
  }, [key, value])

  return [value, setValue] as const
}
