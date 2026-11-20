import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('muestra el contenido cuando no hay errores', () => {
    render(
      <ErrorBoundary>
        <p>Contenido correcto</p>
      </ErrorBoundary>
    )

    expect(screen.getByText('Contenido correcto')).toBeInTheDocument()
  })

  it('muestra el fallback cuando un hijo lanza un error de renderizado', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(
      screen.getByRole('heading', { name: 'La aplicación ha encontrado un error' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
