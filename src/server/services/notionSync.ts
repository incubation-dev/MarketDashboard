import type { Bindings, MarketDataInput, MarketDataSubpage, MarketDataRecord } from '../types'
import { upsertMarketData } from '../db/marketData'

const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

export const NOTION_YEAR_PROPERTY_MAP: Record<number, string> = {
  2025: '2025年市場規模（億円）',
  2030: '2030年市場規模（億円）'
}

const optionalString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

const textArrayToLines = (richTexts: any[]): string => {
  return richTexts.map((node) => node.plain_text ?? '').join('')
}

const parseNumberProperty = (property: any): number | null => {
  if (!property) return null
  switch (property.type) {
    case 'number':
      return property.number ?? null
    case 'formula':
      if (property.formula.type === 'number') {
        return property.formula.number ?? null
      }
      return null
    case 'rollup':
      if (property.rollup.type === 'number') {
        return property.rollup.number ?? null
      }
      return null
    default:
      return null
  }
}

const parseRichTextProperty = (property: any): string | null => {
  if (!property) return null
  if (property.type === 'rich_text') {
    return optionalString(textArrayToLines(property.rich_text ?? []))
  }
  if (property.type === 'title') {
    return optionalString(textArrayToLines(property.title ?? []))
  }
  return null
}

const parseMultiSelectProperty = (property: any): string[] => {
  if (!property) return []
  if (property.type === 'multi_select') {
    return (property.multi_select ?? []).map((item: any) => item.name).filter(Boolean)
  }
  const text = parseRichTextProperty(property)
  if (!text) return []
  return text
    .split(/\n|、|,|;|\/|・/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

const parseLinksProperty = (property: any): string[] => {
  if (!property) return []
  const links = new Set<string>()
  if (property.type === 'url' && property.url) {
    links.add(property.url)
  }
  if (property.type === 'rich_text') {
    for (const node of property.rich_text ?? []) {
      if (node.href) {
        links.add(node.href)
      }
      if (node.type === 'text' && node.text?.link?.url) {
        links.add(node.text.link.url)
      }
    }
  }
  if (property.type === 'files') {
    for (const fileNode of property.files ?? []) {
      if (fileNode.type === 'external' && fileNode.external?.url) {
        links.add(fileNode.external.url)
      }
      if (fileNode.type === 'file' && fileNode.file?.url) {
        links.add(fileNode.file.url)
      }
    }
  }
  const textFallback = parseRichTextProperty(property)
  if (textFallback) {
    const urlMatches = textFallback.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g)
    if (urlMatches) {
      urlMatches.forEach((url) => links.add(url))
    }
  }
  return Array.from(links)
}

const richTextToMarkdown = (richTexts: any[]): string => {
  return richTexts
    .map((node) => {
      const text = node.plain_text ?? ''
      if (node.href) {
        return `[${text}](${node.href})`
      }
      if (node.text?.link?.url) {
        return `[${text}](${node.text.link.url})`
      }
      return text
    })
    .join('')
}

const renderBlocksToMarkdown = (blocks: any[]): string => {
  const lines: string[] = []

  for (const block of blocks) {
    if (!block) continue
    const { type } = block

    switch (type) {
      case 'heading_1':
        lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text ?? [])}`)
        break
      case 'heading_2':
        lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text ?? [])}`)
        break
      case 'heading_3':
        lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text ?? [])}`)
        break
      case 'paragraph':
        lines.push(richTextToMarkdown(block.paragraph.rich_text ?? []))
        break
      case 'bulleted_list_item':
        lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text ?? [])}`)
        break
      case 'numbered_list_item':
        lines.push(`1. ${richTextToMarkdown(block.numbered_list_item.rich_text ?? [])}`)
        break
      case 'quote':
        lines.push(`> ${richTextToMarkdown(block.quote.rich_text ?? [])}`)
        break
      case 'callout': {
        const icon = block.callout.icon?.emoji ?? '💡'
        lines.push(`${icon} ${richTextToMarkdown(block.callout.rich_text ?? [])}`)
        break
      }
      case 'toggle':
        lines.push(`> ${richTextToMarkdown(block.toggle.rich_text ?? [])}`)
        break
      case 'divider':
        lines.push('---')
        break
      default:
        break
    }
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function notionFetch(env: Bindings, path: string, init: RequestInit = {}): Promise<any> {
  if (!env.NOTION_API_KEY) {
    throw new Error('Notion API key is not configured')
  }
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined)
    }
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Notion API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

export async function fetchDatabasePages(
  env: Bindings,
  databaseId: string,
  segment?: string
): Promise<any[]> {
  const results: any[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      page_size: 50
    }

    if (cursor) {
      body.start_cursor = cursor
    }

    if (segment) {
      body.filter = {
        property: '市場セグメント',
        title: {
          equals: segment
        }
      }
    }

    const data = await notionFetch(env, `/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    })

    results.push(...(data.results ?? []))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return results
}

async function fetchAllBlockChildren(env: Bindings, blockId: string): Promise<any[]> {
  const all: any[] = []
  let cursor: string | undefined

  do {
    const data = await notionFetch(
      env,
      `/blocks/${blockId}/children?page_size=50${
        cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''
      }`
    )
    all.push(...(data.results ?? []))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return all
}

async function collectSubpages(
  env: Bindings,
  pageId: string,
  parentPath: string,
  depth: number = 0,
  maxDepth: number = 2
): Promise<MarketDataSubpage[]> {
  // Limit recursion depth to avoid "too many subrequests" error
  if (depth >= maxDepth) {
    return []
  }

  let children: any[] = []
  try {
    children = await fetchAllBlockChildren(env, pageId)
    console.log(`[collectSubpages] Found ${children.length} blocks for page ${pageId}`)
  } catch (error) {
    console.error(`Failed to fetch children for page ${pageId}:`, error)
    return []
  }

  const subpages: MarketDataSubpage[] = []
  const childPageBlocks = children.filter((b) => b.type === 'child_page')
  console.log(`[collectSubpages] Found ${childPageBlocks.length} child_page blocks`)

  for (const block of children) {
    if (block.type !== 'child_page') continue
    const childId: string = block.id
    const title: string = block.child_page?.title ?? 'Untitled'
    
    let nestedBlocks: any[] = []
    let markdown = ''
    
    try {
      nestedBlocks = await fetchAllBlockChildren(env, childId)
      markdown = renderBlocksToMarkdown(nestedBlocks)
    } catch (error) {
      console.error(`Failed to fetch blocks for subpage ${childId}:`, error)
      markdown = `[Error loading content for: ${title}]`
    }

    const currentPath = parentPath ? `${parentPath}/${title}` : title

    subpages.push({
      id: childId,
      title,
      path: currentPath,
      markdown
    })

    // Recursively collect nested subpages with depth tracking
    try {
      const nestedSubpages = await collectSubpages(env, childId, currentPath, depth + 1, maxDepth)
      subpages.push(...nestedSubpages)
    } catch (error) {
      console.error(`Failed to collect nested subpages for ${childId}:`, error)
    }
  }

  return subpages
}

const mapPageToMarketDataInputs = async (
  env: Bindings,
  page: any
): Promise<MarketDataInput[]> => {
  const properties = page.properties ?? {}

  // Debug: Log all property names
  console.log('[notionSync] Available properties:', Object.keys(properties).join(', '))

  const segment = parseRichTextProperty(properties['市場セグメント'])
  if (!segment) {
    throw new Error('Notionページに市場セグメントのタイトルが存在しません')
  }

  const issue =
    parseRichTextProperty(properties['課題']) ?? parseRichTextProperty(properties['Issue']) ?? null

  const growthRate = parseNumberProperty(properties['市場成長率（CAGR％）'])
  const top10Ratio = parseNumberProperty(properties['上位10社市場占有率(%)'])
  const players = parseMultiSelectProperty(properties['主要プレイヤー'])
  const links = parseLinksProperty(properties['リンク'])
  const remarks = parseRichTextProperty(properties['備考'])

  const notionPageId = page.id
  const parentId = page.parent?.database_id ?? null
  
  let subpages: MarketDataSubpage[] = []
  try {
    subpages = await collectSubpages(env, notionPageId, segment)
    console.log(`[notionSync] Collected ${subpages.length} subpages for segment: ${segment}`)
    if (subpages.length > 0) {
      console.log(`[notionSync] First subpage: ${subpages[0].title} (${subpages[0].id})`)
    }
  } catch (error) {
    console.error(`Failed to collect subpages for ${notionPageId}:`, error)
    // Continue processing without subpages
  }

  const subpageMarkdown =
    subpages.length > 0
      ? subpages
          .map((subpage) => `### ${subpage.title}\n${subpage.markdown}`)
          .join('\n\n')
      : null
  const summaryPieces = [remarks, subpageMarkdown].filter(Boolean) as string[]

  const inputs: MarketDataInput[] = []

  for (const [year, propertyName] of Object.entries(NOTION_YEAR_PROPERTY_MAP)) {
    const numericYear = Number(year)
    const property = properties[propertyName]
    const marketSizeInOkuYen = parseNumberProperty(property)
    if (marketSizeInOkuYen === null) {
      continue
    }
    // Convert from 億円 (Oku-yen) to yen
    const marketSize = marketSizeInOkuYen * 100000000

    const payload: MarketDataInput = {
      segment,
      issue,
      year: numericYear,
      marketSize,
      growthRate,
      top10Ratio,
      players,
      links,
      summary: summaryPieces.join('\n\n') || null,
      notionPageId,
      notionParentId: parentId,
      subpagePath: segment,
      subpages,
      lastSyncedAt: new Date().toISOString()
    }

    inputs.push(payload)
  }

  if (inputs.length === 0) {
    const fallbackYear = Number(Object.keys(NOTION_YEAR_PROPERTY_MAP)[0])
    inputs.push({
      segment,
      issue,
      year: fallbackYear,
      marketSize: parseNumberProperty(properties[NOTION_YEAR_PROPERTY_MAP[fallbackYear]]) ?? null,
      growthRate,
      top10Ratio,
      players,
      links,
      summary: summaryPieces.join('\n\n') || null,
      notionPageId,
      notionParentId: parentId,
      subpagePath: segment,
      subpages,
      lastSyncedAt: new Date().toISOString()
    })
  }

  return inputs
}

export type NotionSyncOptions = {
  segment?: string
}

export type NotionSyncResult = {
  processed: number
  upserted: number
  skipped: number
  errors: string[]
}

export const syncNotionMarketData = async (
  env: Bindings,
  options: NotionSyncOptions = {}
): Promise<NotionSyncResult> => {
  if (!env.NOTION_DATABASE_ID) {
    throw new Error('NotionデータベースIDが設定されていません')
  }

  const pages = await fetchDatabasePages(env, env.NOTION_DATABASE_ID, options.segment)
  let upserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const page of pages) {
    try {
      const inputs = await mapPageToMarketDataInputs(env, page)
      for (const input of inputs) {
        await upsertMarketData(env.DB, input)
        upserted += 1
      }
    } catch (error) {
      skipped += 1
      const message = error instanceof Error ? error.message : 'unknown error'
      errors.push(`[${page.id}] ${message}`)
    }
  }

  return {
    processed: pages.length,
    upserted,
    skipped,
    errors
  }
}

export type NotionResearchSource = {
  title: string
  url: string
  snippet?: string
}

export type NotionPushContext = {
  summary?: string | null
  sources?: NotionResearchSource[]
  insights?: string[]
  timestamp?: string
}

export const findNotionPageBySegment = async (
  env: Bindings,
  segment: string
): Promise<any | null> => {
  if (!env.NOTION_DATABASE_ID) return null
  const pages = await fetchDatabasePages(env, env.NOTION_DATABASE_ID, segment)
  return pages.length > 0 ? pages[0] : null
}

export const pushResearchResultToNotion = async (
  env: Bindings,
  record: MarketDataRecord,
  context: NotionPushContext = {}
): Promise<void> => {
  if (!env.NOTION_API_KEY || !record.notionPageId) {
    return
  }

  const propertiesPayload: Record<string, unknown> = {}

  const yearPropertyName = NOTION_YEAR_PROPERTY_MAP[record.year]
  if (yearPropertyName && typeof record.marketSize === 'number') {
    propertiesPayload[yearPropertyName] = {
      number: record.marketSize
    }
  }

  if (typeof record.growthRate === 'number') {
    propertiesPayload['市場成長率'] = {
      number: record.growthRate
    }
  }

  if (typeof record.top10Ratio === 'number') {
    propertiesPayload['上位10社比率'] = {
      number: record.top10Ratio
    }
  }

  if (record.issue) {
    propertiesPayload['課題'] = {
      rich_text: [
        {
          type: 'text',
          text: { content: record.issue }
        }
      ]
    }
  }

  if (record.players.length > 0) {
    propertiesPayload['主要プレイヤー'] = {
      multi_select: record.players.map((name) => ({ name }))
    }
  }

  if (record.links.length > 0) {
    const richTexts = record.links.map((url, index) => ({
      type: 'text',
      text: {
        content: index === record.links.length - 1 ? url : `${url}\n`,
        link: { url }
      }
    }))
    propertiesPayload['リンク'] = {
      rich_text: richTexts
    }
  }

  const summaryText = context.summary ?? record.summary
  if (summaryText) {
    propertiesPayload['備考'] = {
      rich_text: [
        {
          type: 'text',
          text: { content: summaryText }
        }
      ]
    }
  }

  if (Object.keys(propertiesPayload).length > 0) {
    await notionFetch(env, `/pages/${record.notionPageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: propertiesPayload })
    })
  }

  const summaryBlocks: any[] = []
  const insights = context.insights ?? []
  const timestamp = context.timestamp ?? new Date().toISOString()

  if (summaryText) {
    summaryBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: summaryText }
          }
        ]
      }
    })
  }

  if (insights.length > 0) {
    for (const insight of insights) {
      summaryBlocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: { content: insight }
            }
          ]
        }
      })
    }
  }

  if (context.sources && context.sources.length > 0) {
    summaryBlocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: { content: '参考情報' }
          }
        ]
      }
    })

    for (const source of context.sources) {
      const contentParts: string[] = []
      if (source.title) {
        contentParts.push(source.title)
      }
      if (source.url) {
        contentParts.push(source.url)
      }
      if (source.snippet) {
        contentParts.push(source.snippet)
      }

      summaryBlocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: contentParts.join(' \n'),
                link: source.url ? { url: source.url } : undefined
              }
            }
          ]
        }
      })
    }
  }

  if (summaryBlocks.length > 0) {
    const pageTitle = `${record.year} 市場AIアップデート (${timestamp.slice(0, 10)})`

    await notionFetch(env, '/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { page_id: record.notionPageId },
        properties: {
          title: {
            title: [
              {
                type: 'text',
                text: { content: pageTitle }
              }
            ]
          }
        },
        children: summaryBlocks
      })
    })
  }
}
