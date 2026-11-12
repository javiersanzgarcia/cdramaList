import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    function handlePrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!promptEvent) return

    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }

  return {
    canInstall: promptEvent !== null && !installed,
    promptInstall
  }
}
