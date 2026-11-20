import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('muestra título, descripción y acción cuando se proporciona', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()

    render(
      <EmptyState
        icon={<span data-testid="icon">i</span>}
        title="Sin series"
        description="Añade una serie para empezar."
        actionLabel="Añadir"
        onAction={onAction}
      />
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sin series' })).toBeInTheDocument()
    expect(screen.getByText('Añade una serie para empezar.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('no renderiza botón si falta la acción', () => {
    render(<EmptyState icon={<span />} title="Vacío" description="Nada que mostrar." />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
