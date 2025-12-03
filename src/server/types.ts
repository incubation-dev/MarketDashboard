export type Bindings = {
  DB: D1Database
}

export type MarketDataRecord = {
  id: number
  segment: string
  issue: string | null
  year: number
  marketSize: number | null
  growthRate: number | null
  top10Ratio: number | null
  players: string[]
  links: string[]
  summary: string | null
  notionPageId: string | null
  notionParentId: string | null
  subpagePath: string | null
  lastSyncedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type MarketDataFilter = {
  id?: number
  segment?: string
  issueContains?: string
  year?: number
  notionPageId?: string
}

export type MarketDataInput = {
  id?: number
  segment: string
  issue?: string | null
  year: number
  marketSize?: number | null
  growthRate?: number | null
  top10Ratio?: number | null
  players?: string[] | null
  links?: string[] | null
  summary?: string | null
  notionPageId?: string | null
  notionParentId?: string | null
  subpagePath?: string | null
  lastSyncedAt?: string | null
}

export type GraphQLContext = {
  db: D1Database
}
