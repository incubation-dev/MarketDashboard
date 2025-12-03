import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

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

app.get('/', (c) => c.html(HTML_TEMPLATE))

export default app
