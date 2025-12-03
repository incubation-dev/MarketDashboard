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

const MARKET_DATA_QUERY = `
  query AllMarketData {
    marketData {
      id
      segment
      issue
      year
      marketSize
      growthRate
      top10Ratio
      players
      links
      summary
      notionPageId
      notionParentId
      subpagePath
      subpages {
        id
        title
        path
        markdown
      }
      lastSyncedAt
      createdAt
      updatedAt
    }
  }
`

export async function fetchAllMarketData(): Promise<MarketDataRecord[]> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: MARKET_DATA_QUERY
    })
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`)
  }

  const json = await response.json()

  if (json.errors) {
    console.error('GraphQL errors', json.errors)
    throw new Error('GraphQL query returned errors')
  }

  const records = json?.data?.marketData
  if (!Array.isArray(records)) {
    return []
  }

  return records as MarketDataRecord[]
}
