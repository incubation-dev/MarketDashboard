export type Bindings = {
  DB: D1Database
  NOTION_API_KEY?: string
  NOTION_DATABASE_ID?: string
  OPENAI_API_KEY?: string
  SERPAPI_KEY?: string
}

export type MarketDataSubpage = {
  id: string
  title: string
  path: string
  markdown: string
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
  subpages: MarketDataSubpage[]
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
  subpages?: MarketDataSubpage[] | null
  lastSyncedAt?: string | null
}

export type GraphQLContext = {
  db: D1Database
}
