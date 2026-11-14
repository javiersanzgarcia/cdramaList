/** Etiqueta global para organizar series con independencia de su estado. */
export interface Tag {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /**
   * Lápida de borrado. La etiqueta se oculta pero se conserva para propagar el
   * borrado al sincronizar, igual que las series.
   */
  deletedAt?: number
}
