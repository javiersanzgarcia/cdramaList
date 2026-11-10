import { useEffect, useRef } from 'react'

const sheetStack: symbol[] = []

export function useSheet(onClose: () => void) {
  const id = useRef(Symbol('sheet'))

  useEffect(() => {
    const currentId = id.current
    sheetStack.push(currentId)

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && sheetStack[sheetStack.length - 1] === currentId) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKey)
      const index = sheetStack.indexOf(currentId)
      if (index >= 0) sheetStack.splice(index, 1)
      if (sheetStack.length === 0) {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [onClose])
}
