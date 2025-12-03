import type {
  MarketDataFilter,
  MarketDataInput,
  MarketDataRecord,
  MarketDataSubpage
} from '../types'

export type DbMarketDataRow = {
  id: number
  segment: string
  issue: string | null
  year: number
  market_size: number | null
  growth_rate: number | null
  top10_ratio: number | null
  players: string | null
  links: string | null
  summary: string | null
  notion_page_id: string | null
  notion_parent_id: string | null
  subpage_path: string | null
  subpages: string | null
  last_synced_at: string | null
  created_at: string | null
  updated_at: string | null
}

const SELECT_BASE = `
  SELECT
    id,
    segment,
    issue,
    year,
    market_size,
    growth_rate,
    top10_ratio,
    players,
    links,
    summary,
    notion_page_id,
    notion_parent_id,
    subpage_path,
    subpages,
    last_synced_at,
    created_at,
    updated_at
  FROM market_data
`

const toRecord = (row: DbMarketDataRow): MarketDataRecord => {
  const parseJsonArray = (value: string | null | undefined): string[] => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
    } catch (error) {
      console.warn('[marketData] failed to parse JSON array', error)
      return []
    }
  }

  const parseSubpages = (value: string | null | undefined): MarketDataSubpage[] => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((item) => ({
          id: String(item.id ?? ''),
          title: String(item.title ?? ''),
          path: String(item.path ?? ''),
          markdown: String(item.markdown ?? '')
        }))
        .filter((item) => item.id.length > 0)
    } catch (error) {
      console.warn('[marketData] failed to parse JSON subpages', error)
      return []
    }
  }

  return {
    id: row.id,
    segment: row.segment,
    issue: row.issue ?? null,
    year: row.year,
    marketSize: row.market_size ?? null,
    growthRate: row.growth_rate ?? null,
    top10Ratio: row.top10_ratio ?? null,
    players: parseJsonArray(row.players),
    links: parseJsonArray(row.links),
    summary: row.summary ?? null,
    notionPageId: row.notion_page_id ?? null,
    notionParentId: row.notion_parent_id ?? null,
    subpagePath: row.subpage_path ?? null,
    subpages: parseSubpages(row.subpages),
    lastSyncedAt: row.last_synced_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  }
}

export const listMarketData = async (
  db: D1Database,
  filter: MarketDataFilter | undefined
): Promise<MarketDataRecord[]> => {
  const conditions: string[] = []
  const values: Array<string | number> = []

  if (!filter) {
    // no filter, return all
  } else {
    if (filter.id !== undefined) {
      conditions.push('id = ?')
      values.push(filter.id)
    }
    if (filter.segment) {
      conditions.push('segment = ?')
      values.push(filter.segment)
    }
    if (filter.issueContains) {
      conditions.push('issue LIKE ?')
      values.push(`%${filter.issueContains}%`)
    }
    if (filter.year !== undefined) {
      conditions.push('year = ?')
      values.push(filter.year)
    }
    if (filter.notionPageId) {
      conditions.push('notion_page_id = ?')
      values.push(filter.notionPageId)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const statement = db.prepare(`${SELECT_BASE} ${whereClause} ORDER BY year DESC, segment ASC`)
  const result = await statement.bind(...values).all<DbMarketDataRow>()
  const rows = result.results ?? []
  return rows.map((row) => toRecord(row))
}

export const getMarketDataById = async (
  db: D1Database,
  id: number
): Promise<MarketDataRecord | null> => {
  const result = await db.prepare(`${SELECT_BASE} WHERE id = ? LIMIT 1`).bind(id).first<DbMarketDataRow>()
  if (!result) return null
  return toRecord(result)
}

const normaliseIssue = (issue: string | null | undefined): string => {
  if (!issue) return ''
  return issue.trim()
}

const serialiseArray = (items: string[] | null | undefined): string | null => {
  if (!items || items.length === 0) return null
  return JSON.stringify(items)
}

const serialiseSubpages = (items: MarketDataSubpage[] | null | undefined): string | null => {
  if (!items || items.length === 0) return null
  return JSON.stringify(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      path: item.path,
      markdown: item.markdown
    }))
  )
}

export const upsertMarketData = async (
  db: D1Database,
  input: MarketDataInput
): Promise<MarketDataRecord> => {
  const issue = normaliseIssue(input.issue ?? null)
  const players = serialiseArray(input.players ?? null)
  const links = serialiseArray(input.links ?? null)
  const subpages = serialiseSubpages(input.subpages ?? null)
  const nowIso = new Date().toISOString()

  const payload = {
    segment: input.segment.trim(),
    issue,
    year: input.year,
    marketSize: input.marketSize ?? null,
    growthRate: input.growthRate ?? null,
    top10Ratio: input.top10Ratio ?? null,
    players,
    links,
    summary: input.summary ?? null,
    notionPageId: input.notionPageId ?? null,
    notionParentId: input.notionParentId ?? null,
    subpagePath: input.subpagePath ?? null,
    subpages,
    lastSyncedAt: input.lastSyncedAt ?? nowIso
  }

  const runUpdate = async (targetId: number) => {
    await db
      .prepare(
        `UPDATE market_data
         SET segment = ?,
             issue = ?,
             year = ?,
             market_size = ?,
             growth_rate = ?,
             top10_ratio = ?,
             players = ?,
             links = ?,
             summary = ?,
             notion_page_id = ?,
             notion_parent_id = ?,
             subpage_path = ?,
             subpages = ?,
             last_synced_at = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        payload.segment,
        payload.issue,
        payload.year,
        payload.marketSize,
        payload.growthRate,
        payload.top10Ratio,
        payload.players,
        payload.links,
        payload.summary,
        payload.notionPageId,
        payload.notionParentId,
        payload.subpagePath,
        payload.subpages,
        payload.lastSyncedAt,
        targetId
      )
      .run()

    const updated = await getMarketDataById(db, targetId)
    if (!updated) {
      throw new Error('市場データの更新後取得に失敗しました')
    }
    return updated
  }

  if (input.id !== undefined && input.id !== null) {
    return runUpdate(Number(input.id))
  }

  const existing = await db
    .prepare('SELECT id FROM market_data WHERE segment = ? AND issue = ? AND year = ? LIMIT 1')
    .bind(payload.segment, payload.issue, payload.year)
    .first<{ id: number }>()

  if (existing && existing.id) {
    return runUpdate(existing.id)
  }

  const insertResult = await db
    .prepare(
      `INSERT INTO market_data (
        segment,
        issue,
        year,
        market_size,
        growth_rate,
        top10_ratio,
        players,
        links,
        summary,
        notion_page_id,
        notion_parent_id,
        subpage_path,
        subpages,
        last_synced_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      payload.segment,
      payload.issue,
      payload.year,
      payload.marketSize,
      payload.growthRate,
      payload.top10Ratio,
      payload.players,
      payload.links,
      payload.summary,
      payload.notionPageId,
      payload.notionParentId,
      payload.subpagePath,
      payload.subpages,
      payload.lastSyncedAt
    )
    .run()

  const newId = insertResult.meta.last_row_id
  if (!newId) {
    throw new Error('市場データの生成に失敗しました')
  }

  const created = await getMarketDataById(db, Number(newId))
  if (!created) {
    throw new Error('市場データの取得に失敗しました')
  }
  return created
}

export const deleteMarketData = async (db: D1Database, id: number): Promise<boolean> => {
  const result = await db.prepare('DELETE FROM market_data WHERE id = ?').bind(id).run()
  return Boolean(result.meta.rows_written && result.meta.rows_written > 0)
}
