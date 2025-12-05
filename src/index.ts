import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { createYoga } from 'graphql-yoga'
import type { ExportedHandlerScheduledHandler } from '@cloudflare/workers-types'
import { z } from 'zod'
import { schema } from './server/graphql/schema'
import { syncNotionMarketData } from './server/services/notionSync'
import { runMarketResearchAndPersist } from './server/services/aiResearchAgent'
import { generatePdfReport } from './server/services/pdfReport'
import { getMarketDataById } from './server/db/marketData'
import type { Bindings, GraphQLContext } from './server/types'

const app = new Hono<{ Bindings: Bindings }>()

const yoga = createYoga<{ Bindings: Bindings }>({
  schema,
  graphqlEndpoint: '/graphql',
  context: ({ env }): GraphQLContext => ({
    db: env.DB
  })
})

const researchRequestSchema = z.object({
  segment: z.string().min(1, 'segment is required'),
  issue: z.string().optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100)
})

const reportRequestSchema = z.object({
  id: z.coerce.number().int().positive(),
  chartImageData: z.string().optional().nullable()
})

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="ja" class="bg-base-100">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Notion-Driven Market Intelligence Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0"
    />
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/static/assets/main.css" />
  </head>
  <body class="font-sans bg-base-100">
    <div id="root"></div>
    <script type="module" src="/static/assets/app.js"></script>
  </body>
</html>`

app.use('/static/*', serveStatic({ root: './' }))
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }))

app.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    graphql: '/graphql',
    timestamp: new Date().toISOString()
  })
)

app.post('/api/sync', async (c) => {
  const payload = await c.req
    .json()
    .catch(() => ({ segment: undefined, limit: undefined, offset: undefined })) as { 
      segment?: string | null
      limit?: number
      offset?: number
    }
  const segment = typeof payload?.segment === 'string' ? payload.segment.trim() : undefined
  const limit = payload?.limit
  const offset = payload?.offset || 0

  try {
    const result = await syncNotionMarketData(c.env, { segment, limit, offset })
    // Include debug info in response for testing
    const debugInfo = {
      hasNotionApiKey: !!c.env.NOTION_API_KEY,
      hasNotionDatabaseId: !!c.env.NOTION_DATABASE_ID,
      requestedSegment: segment ?? null,
      limit,
      offset
    }
    return c.json({ status: 'ok', debug: debugInfo, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notion同期でエラーが発生しました'
    const stack = error instanceof Error ? error.stack : undefined
    return c.json({ status: 'error', message, stack }, 500)
  }
})

// Endpoint to fetch page content for a specific segment
app.post('/api/fetch-page-content', async (c) => {
  try {
    const { segment, year } = await c.req.json()
    
    if (!segment) {
      return c.json({ status: 'error', message: 'Segment is required' }, 400)
    }
    
    const { fetchDatabasePages, fetchAllBlockChildren, renderBlocksToMarkdown } = await import('./server/services/notionSync')
    const { upsertMarketData, findMarketDataByCompositeKey } = await import('./server/db/marketData')
    
    // Find the page in Notion
    const pages = await fetchDatabasePages(c.env, c.env.NOTION_DATABASE_ID, segment)
    if (pages.length === 0) {
      return c.json({ status: 'not_found', segment })
    }
    
    const page = pages[0]
    const notionPageId = page.id
    
    // Fetch page blocks
    const pageBlocks = await fetchAllBlockChildren(c.env, notionPageId)
    const pageContent = renderBlocksToMarkdown(pageBlocks)
    
    // Find existing record
    const existingRecord = await findMarketDataByCompositeKey(c.env.DB, segment, null, year || 2030)
    
    if (existingRecord) {
      // Update summary with page content
      const updatedSummary = [existingRecord.summary, pageContent].filter(Boolean).join('\n\n')
      await upsertMarketData(c.env.DB, {
        ...existingRecord,
        summary: updatedSummary
      })
      
      return c.json({
        status: 'ok',
        segment,
        pageContentLength: pageContent.length,
        blocksCount: pageBlocks.length
      })
    }
    
    return c.json({ status: 'no_record', segment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ status: 'error', message }, 500)
  }
})

// Debug endpoint to find page ID by segment name
app.get('/api/debug/find-page/:segment', async (c) => {
  const segment = decodeURIComponent(c.req.param('segment'))
  
  try {
    const { fetchDatabasePages } = await import('./server/services/notionSync')
    const pages = await fetchDatabasePages(c.env, c.env.NOTION_DATABASE_ID, segment)
    
    if (pages.length === 0) {
      return c.json({ status: 'not_found', segment })
    }
    
    const page = pages[0]
    const properties = page.properties || {}
    const segmentTitle = properties['市場セグメント']?.title?.[0]?.plain_text || 'Unknown'
    
    return c.json({
      status: 'found',
      segment: segmentTitle,
      pageId: page.id,
      url: page.url || null
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ status: 'error', message }, 500)
  }
})

// Debug endpoint to test Notion page structure
app.get('/api/debug/notion-page/:pageId', async (c) => {
  const pageId = c.req.param('pageId')
  
  try {
    const { notionFetch } = await import('./server/services/notionSync')
    
    // Fetch page blocks
    const blocksResponse = await notionFetch(c.env, `/blocks/${pageId}/children?page_size=100`)
    const blocks = blocksResponse.results || []
    
    // Count block types
    const blockTypes = blocks.reduce((acc: Record<string, number>, block: any) => {
      acc[block.type] = (acc[block.type] || 0) + 1
      return acc
    }, {})
    
    // Find child pages
    const childPages = blocks
      .filter((b: any) => b.type === 'child_page')
      .map((b: any) => ({
        id: b.id,
        title: b.child_page?.title || 'Untitled'
      }))
    
    return c.json({
      pageId,
      totalBlocks: blocks.length,
      blockTypes,
      childPages,
      hasChildPages: childPages.length > 0
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ status: 'error', message }, 500)
  }
})

// AI Chat endpoint
app.post('/api/chat', async (c) => {
  let payload: unknown
  try {
    payload = await c.req.json()
  } catch (parseError) {
    console.error('[api/chat] JSON parse error:', parseError)
    return c.json({ 
      status: 'error', 
      message: 'Invalid JSON in request body' 
    }, 400)
  }

  try {
    const input = z.object({
      segments: z.array(z.string()).min(1),
      issue: z.string().optional(),
      year: z.number().int().optional(),
      question: z.string().min(1)
    }).parse(payload)

    // Fetch relevant market data
    const relevantData = await c.env.DB.prepare(`
      SELECT * FROM market_data 
      WHERE segment IN (${input.segments.map(() => '?').join(',')})
      ${input.year ? 'AND year = ?' : ''}
      ORDER BY year DESC, segment
    `).bind(...input.segments, ...(input.year ? [input.year] : [])).all()

    // Prepare context for AI
    const contextSummary = relevantData.results.map((row: any) => 
      `セグメント: ${row.segment}, 年: ${row.year}, 市場規模: ${row.market_size ?? 'N/A'}, 成長率: ${row.growth_rate ?? 'N/A'}%`
    ).join('\n')

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
        max_completion_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `あなたは市場分析の専門家です。以下の市場データに基づいて、ユーザーの質問に日本語で答えてください。\n\n【市場データ】\n${contextSummary}`
          },
          {
            role: 'user',
            content: input.question
          }
        ]
      })
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.error?.message ?? 'OpenAI API error')
    }

    const answer = json?.choices?.[0]?.message?.content ?? ''

    // Save to database
    const insertResult = await c.env.DB.prepare(`
      INSERT INTO conversations (segments, issue, year, question, answer, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      JSON.stringify(input.segments),
      input.issue ?? null,
      input.year ?? null,
      input.question,
      answer,
      'gpt-4o'
    ).run()

    return c.json({
      status: 'ok',
      answer,
      conversationId: insertResult.meta.last_row_id,
      model: 'gpt-4o'
    })
  } catch (error) {
    console.error('[api/chat] failed', error)
    const message = error instanceof Error ? error.message : 'AI対話に失敗しました'
    return c.json({ status: 'error', message }, 500)
  }
})

// Get conversation history
app.get('/api/conversations', async (c) => {
  try {
    const limit = Number(c.req.query('limit') ?? '20')
    const result = await c.env.DB.prepare(`
      SELECT * FROM conversations 
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(limit).all()

    return c.json({
      status: 'ok',
      conversations: result.results
    })
  } catch (error) {
    console.error('[api/conversations] failed', error)
    const message = error instanceof Error ? error.message : '履歴取得に失敗しました'
    return c.json({ status: 'error', message }, 500)
  }
})

app.post('/api/research', async (c) => {
  let payload: unknown
  try {
    payload = await c.req.json()
  } catch (parseError) {
    console.error('[api/research] JSON parse error:', parseError)
    return c.json({ 
      status: 'error', 
      message: 'Invalid JSON in request body' 
    }, 400)
  }

  try {
    const input = researchRequestSchema.parse(payload)
    const outcome = await runMarketResearchAndPersist(c.env, {
      segment: input.segment,
      issue: input.issue ?? null,
      year: input.year
    })

    return c.json({
      status: 'ok',
      model: outcome.model,
      record: outcome.record,
      sources: outcome.sources,
      insights: outcome.insights
    })
  } catch (error) {
    console.error('[api/research] failed', error)
    const message = error instanceof Error ? error.message : 'AIリサーチに失敗しました'
    return c.json({ status: 'error', message }, 500)
  }
})

app.post('/api/report', async (c) => {
  let payload: unknown
  try {
    payload = await c.req.json()
  } catch (parseError) {
    console.error('[api/report] JSON parse error:', parseError)
    return c.json({ 
      status: 'error', 
      message: 'Invalid JSON in request body' 
    }, 400)
  }

  try {
    const input = reportRequestSchema.parse(payload)
    const record = await getMarketDataById(c.env.DB, input.id)
    if (!record) {
      return c.json({ status: 'error', message: '指定された市場データが見つかりません' }, 404)
    }

    const pdfBuffer = await generatePdfReport(c.env, record, {
      chartImageData: input.chartImageData ?? null,
      aiModel: 'gpt-4o'
    })

    const filename = `${record.segment.replace(/[^a-zA-Z0-9\-_.]/g, '_')}_${record.year}.pdf`

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('[api/report] failed', error)
    const message = error instanceof Error ? error.message : 'PDFレポート生成に失敗しました'
    return c.json({ status: 'error', message }, 500)
  }
})

app.all('/graphql', (c) => yoga.handleRequest(c.req.raw, { env: c.env }))

app.get('/', (c) => c.html(HTML_TEMPLATE))

export const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (_event, env, ctx) => {
  ctx.waitUntil(
    syncNotionMarketData(env)
      .then((result) => {
        console.log('[cron] notion sync completed', result)
      })
      .catch((error) => {
        console.error('[cron] notion sync failed', error)
      })
  )
}

export default app
