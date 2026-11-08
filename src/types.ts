export type WatchStatus = 'watching' | 'planned' | 'completed'

export type Filter = 'all' | WatchStatus | 'favorites'

export type Tab = 'home' | 'list' | 'settings'

export interface Drama {
  id: string
  title: string
  chineseTitle: string
  year: number
  episodes: number
  genres: string[]
  synopsis: string
  rating: number
  gradient: string
}

export type StatusMap = Record<string, WatchStatus>
