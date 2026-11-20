import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** Contenido que se protege ante errores de renderizado. */
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Límite de errores de la interfaz: captura fallos de renderizado en el árbol
 * hijo y muestra un estado de recuperación en lugar de dejar la app en blanco.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Se registra para diagnóstico; la UI muestra un fallback recuperable.
    console.error('Error no controlado en la interfaz:', error, errorInfo)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 text-ink">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-bright">
              Algo ha fallado
            </p>
            <h1 className="mt-2 text-xl font-bold text-ink-bright">
              La aplicación ha encontrado un error
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Puedes recargar la página para intentarlo de nuevo. Tus datos guardados en el
              dispositivo se mantienen.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink-bright transition hover:bg-brand-bright active:scale-95"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
