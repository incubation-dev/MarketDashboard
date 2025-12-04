import { z } from 'zod'
import type { Bindings, MarketDataRecord } from '../types'
import {
  findMarketDataByCompositeKey,
  upsertMarketData
} from '../db/marketData'
import {
  findNotionPageBySegment,
  NotionPushContext,
  NotionResearchSource,
  pushResearchResultToNotion
} from './notionSync'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const SERP_API_ENDPOINT = 'https://serpapi.com/search.json'
const OPENAI_MODEL = 'gpt-5.1'

const aiResponseSchema = z.object({
  segment: z.string(),
  issue: z.string().optional().nullable(),
  year: z.union([z.number(), z.string()]).optional(),
  market_size: z.union([z.number(), z.string()]),
  growth_rate: z.union([z.number(), z.string(), z.null()]).optional(),
  market_share_top10: z.union([z.number(), z.string(), z.null()]).optional(),
  players: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
  summary: z.string(),
  insights: z.array(z.string()).optional()
})

type NumericInput = number | string | null | undefined

type ResearchPayload = {
  segment: string
  issue?: string | null
  year: number
}

type SearchResult = NotionResearchSource

type OpenAIContext = {
  input: ResearchPayload
  existingRecord: MarketDataRecord | null
  searchResults: SearchResult[]
}

type ResearchOutcome = {
  record: MarketDataRecord
  sources: SearchResult[]
  aiSummary: string
  insights: string[]
  model: string
}

const toNumber = (value: NumericInput): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value
    .replace(/[^0-9.,\-]/g, '')
    .replace(/,/g, '')
    .trim()
  if (cleaned.length === 0) return null
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const toPercentage = (value: NumericInput): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) {
      return value * 100
    }
    return value
  }
  if (typeof value !== 'string') return null
  const containsPercent = value.includes('%') || value.includes('％')
  const base = toNumber(value)
  if (base === null) return null
  if (containsPercent) {
    return base
  }
  if (base <= 1) {
    return base * 100
  }
  return base
}

const uniqueStringArray = (values: (string | null | undefined)[]): string[] => {
  const set = new Set<string>()
  for (const value of values) {
    if (!value) continue
    const trimmed = value.trim()
    if (trimmed.length === 0) continue
    set.add(trimmed)
  }
  return Array.from(set)
}

const normaliseLink = (url: string): string | null => {
  const trimmed = url.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null
  }
  return trimmed
}

const buildSearchQuery = (payload: ResearchPayload): string => {
  const parts = [payload.segment, '市場規模', `${payload.year} 年`, '最新動向']
  if (payload.issue) {
    parts.splice(1, 0, payload.issue)
  }
  return parts.join(' ')
}

const fetchSerpResults = async (env: Bindings, payload: ResearchPayload): Promise<SearchResult[]> => {
  if (!env.SERPAPI_KEY) {
    return []
  }

  const url = new URL(SERP_API_ENDPOINT)
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', buildSearchQuery(payload))
  url.searchParams.set('hl', 'ja')
  url.searchParams.set('num', '8')
  url.searchParams.set('api_key', env.SERPAPI_KEY)

  const response = await fetch(url.toString())
  if (!response.ok) {
    console.warn('[serpapi] failed', response.status, await response.text())
    return []
  }

  const json = await response.json()
  const organic: any[] = Array.isArray(json.organic_results) ? json.organic_results : []

  return organic.slice(0, 6).map((item) => ({
    title: typeof item.title === 'string' ? item.title : '',
    url: typeof item.link === 'string' ? item.link : '',
    snippet: typeof item.snippet === 'string' ? item.snippet : undefined
  }))
}

const callOpenAI = async (env: Bindings, context: OpenAIContext) => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY が設定されていません')
  }

  const messages = [
    {
      role: 'system',
      content:
        'あなたはエネルギー・スマートインフラ分野に精通した市場調査アナリストです。信頼できる出典に基づき、事実ベースで回答し、指定フォーマットのJSONのみを出力してください。数値は可能な限り日本円・百分率で返してください。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        prompt: '市場インテリジェンス更新',
        segment: context.input.segment,
        issue: context.input.issue,
        year: context.input.year,
        existingData: context.existingRecord
          ? {
              year: context.existingRecord.year,
              marketSize: context.existingRecord.marketSize,
              growthRate: context.existingRecord.growthRate,
              top10Ratio: context.existingRecord.top10Ratio,
              players: context.existingRecord.players,
              links: context.existingRecord.links,
              summary: context.existingRecord.summary
            }
          : null,
        searchResults: context.searchResults
      })
    }
  ]

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_completion_tokens: 1500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'market_intelligence_update',
          schema: {
            type: 'object',
            properties: {
              segment: { type: 'string' },
              issue: { type: ['string', 'null'] },
              year: { type: ['number', 'string'] },
              market_size: { type: ['number', 'string'] },
              growth_rate: { type: ['number', 'string', 'null'] },
              market_share_top10: { type: ['number', 'string', 'null'] },
              players: {
                type: 'array',
                items: { type: 'string' }
              },
              links: {
                type: 'array',
                items: { type: 'string' }
              },
              summary: { type: 'string' },
              insights: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['segment', 'market_size', 'summary']
          }
        }
      },
      messages
    })
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message ?? 'OpenAI API error')
  }

  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenAIレスポンスに解析可能なJSONが含まれていません')
  }

  const parsed = JSON.parse(content)
  return aiResponseSchema.parse(parsed)
}

const normaliseAiResult = (payload: ResearchPayload, result: z.infer<typeof aiResponseSchema>) => {
  const yearValue = result.year ?? payload.year
  const year = typeof yearValue === 'string' ? Number.parseInt(yearValue, 10) : Number(yearValue)

  const marketSize = toNumber(result.market_size)
  const growthRate = toPercentage(result.growth_rate ?? null)
  const top10Ratio = toPercentage(result.market_share_top10 ?? null)
  const players = uniqueStringArray(result.players ?? [])
  const links = uniqueStringArray(result.links ?? []).map((link) => normaliseLink(link ?? '')).filter((link): link is string => Boolean(link))
  const summary = result.summary?.trim() ?? ''
  const insights = result.insights ? result.insights.map((item) => item.trim()).filter(Boolean) : []

  return {
    segment: result.segment?.trim().length ? result.segment.trim() : payload.segment,
    issue: result.issue?.trim()?.length ? result.issue.trim() : payload.issue ?? null,
    year: Number.isFinite(year) ? year : payload.year,
    marketSize,
    growthRate,
    top10Ratio,
    players,
    links,
    summary,
    insights
  }
}

export const runMarketResearchAndPersist = async (
  env: Bindings,
  payload: ResearchPayload
): Promise<ResearchOutcome> => {
  const existingRecord = await findMarketDataByCompositeKey(
    env.DB,
    payload.segment,
    payload.issue ?? null,
    payload.year
  )

  const searchResults = await fetchSerpResults(env, payload)
  const aiRaw = await callOpenAI(env, {
    input: payload,
    existingRecord,
    searchResults
  })
  const normalised = normaliseAiResult(payload, aiRaw)

  const notionPage = existingRecord?.notionPageId
    ? null
    : await findNotionPageBySegment(env, normalised.segment)

  const combinedLinks = uniqueStringArray([
    ...normalised.links,
    ...searchResults.map((item) => item.url)
  ])

  const record = await upsertMarketData(env.DB, {
    segment: normalised.segment,
    issue: normalised.issue,
    year: normalised.year,
    marketSize: normalised.marketSize ?? existingRecord?.marketSize ?? null,
    growthRate: normalised.growthRate ?? existingRecord?.growthRate ?? null,
    top10Ratio: normalised.top10Ratio ?? existingRecord?.top10Ratio ?? null,
    players: normalised.players.length > 0 ? normalised.players : existingRecord?.players ?? [],
    links: combinedLinks,
    summary: normalised.summary || existingRecord?.summary || null,
    notionPageId: existingRecord?.notionPageId ?? notionPage?.id ?? null,
    notionParentId:
      existingRecord?.notionParentId ??
      (notionPage?.parent?.database_id ?? env.NOTION_DATABASE_ID ?? null),
    subpagePath: existingRecord?.subpagePath ?? normalised.segment,
    lastSyncedAt: new Date().toISOString()
  })

  const pushContext: NotionPushContext = {
    summary: normalised.summary || existingRecord?.summary || null,
    sources: searchResults.filter((source) => Boolean(source.url && source.url.length > 0)),
    insights: normalised.insights,
    timestamp: new Date().toISOString()
  }

  await pushResearchResultToNotion(env, record, pushContext)

  return {
    record,
    sources: searchResults,
    aiSummary: normalised.summary,
    insights: normalised.insights,
    model: OPENAI_MODEL
  }
}
