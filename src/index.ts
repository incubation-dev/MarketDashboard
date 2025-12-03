import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { createYoga } from 'graphql-yoga'
import type { ExportedHandlerScheduledHandler } from '@cloudflare/workers-types'
import { z } from 'zod'
import { schema } from './server/graphql/schema'
import { syncNotionMarketData } from './server/services/notionSync'
import { runMarketResearchAndPersist } from './server/services/aiResearchAgent'
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
    .catch(() => ({ segment: undefined })) as { segment?: string | null }
  const segment = typeof payload?.segment === 'string' ? payload.segment.trim() : undefined

  try {
    const result = await syncNotionMarketData(c.env, { segment })
    return c.json({ status: 'ok', requestedSegment: segment ?? null, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notion同期でエラーが発生しました'
    return c.json({ status: 'error', message }, 500)
  }
})

app.post('/api/research', async (c) => {
  const payload = await c.req.json().catch(() => ({}))

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
