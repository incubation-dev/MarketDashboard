import type { Bindings, MarketDataRecord } from '../types'

export type PdfReportOptions = {
  chartImageData?: string | null
  issuedAt?: string
  aiModel?: string
}

const BRAND_COLOR = '#aa0000'

const encodeBasicAuth = (key: string) => {
  const token = btoa(`api:${key}`)
  return `Basic ${token}`
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const renderPlayers = (players: string[]) => {
  if (players.length === 0) return '<p>主要プレイヤー情報は登録されていません。</p>'
  return `
    <ul>
      ${players
        .map((player) => `<li><span class="pill">${escapeHtml(player)}</span></li>`)
        .join('')}
    </ul>
  `
}

const renderLinks = (links: string[]) => {
  if (links.length === 0) return '<p>参考リンク情報は登録されていません。</p>'
  return `
    <ul class="links">
      ${links
        .map((link) => `<li><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></li>`)
        .join('')}
    </ul>
  `
}

const renderSubpages = (record: MarketDataRecord) => {
  if (record.subpages.length === 0) {
    return '<p>Notionサブページ情報は未登録です。</p>'
  }
  return record.subpages
    .map((subpage) => {
      return `
        <section class="subpage">
          <h3>${escapeHtml(subpage.title)}</h3>
          <pre>${escapeHtml(subpage.markdown)}</pre>
        </section>
      `
    })
    .join('')
}

const renderSummary = (summary: string | null) => {
  if (!summary) return '<p>サマリーは未登録です。</p>'
  return `<pre>${escapeHtml(summary)}</pre>`
}

const renderChartImage = (chartImageData?: string | null) => {
  if (!chartImageData) return ''
  if (!chartImageData.startsWith('data:image')) return ''
  return `
    <div class="chart-section">
      <h3>市場ポートフォリオ</h3>
      <img src="${chartImageData}" alt="市場ポートフォリオチャート" />
    </div>
  `
}

const renderReportHtml = (
  record: MarketDataRecord,
  options: PdfReportOptions
): string => {
  const issuedAt = options.issuedAt ?? new Date().toISOString()
  const aiModel = options.aiModel ?? 'gpt-4o'

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: 'Helvetica Neue', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #111827;
        margin: 0;
        padding: 32px 40px;
        background: #f7f7f9;
      }
      header {
        border-bottom: 4px solid ${BRAND_COLOR};
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      h1 {
        font-size: 28px;
        margin: 0 0 8px;
        color: ${BRAND_COLOR};
      }
      h2 {
        font-size: 20px;
        margin: 24px 0 12px;
        color: #111827;
      }
      h3 {
        font-size: 16px;
        margin: 16px 0 8px;
        color: #111827;
      }
      p, li, pre {
        font-size: 12px;
        line-height: 1.6;
        color: #4b5563;
      }
      pre {
        white-space: pre-wrap;
        background: #ffffff;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
      }
      ul { padding-left: 18px; }
      ul.links { padding-left: 0; list-style: none; }
      ul.links li { margin-bottom: 6px; }
      ul.links a { color: ${BRAND_COLOR}; text-decoration: none; }
      ul.links a:hover { text-decoration: underline; }
      .pill {
        display: inline-block;
        background: ${BRAND_COLOR}10;
        border: 1px solid ${BRAND_COLOR}40;
        color: ${BRAND_COLOR};
        padding: 4px 10px;
        border-radius: 999px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      .metric-card {
        background: #ffffff;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid #e5e7eb;
      }
      .metric-card span {
        display: block;
        font-size: 10px;
        letter-spacing: 0.4em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 6px;
      }
      .metric-card strong {
        font-size: 18px;
        color: #111827;
      }
      .chart-section {
        margin: 16px 0 24px;
        text-align: center;
      }
      .chart-section img {
        max-width: 100%;
        border-radius: 16px;
        border: 1px solid #e5e7eb;
      }
      footer {
        margin-top: 36px;
        padding-top: 12px;
        border-top: 1px dashed #d1d5db;
        font-size: 10px;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(record.segment)} 市場レポート</h1>
      <p>対象年度: ${record.year} / 発行日: ${issuedAt}</p>
      ${record.issue ? `<p>課題: ${escapeHtml(record.issue)}</p>` : ''}
    </header>

    <section>
      <h2>主要指標</h2>
      <div class="metrics">
        <div class="metric-card">
          <span>市場規模</span>
          <strong>${record.marketSize ?? '-'} 億円</strong>
        </div>
        <div class="metric-card">
          <span>成長率</span>
          <strong>${record.growthRate ?? '-'} %</strong>
        </div>
        <div class="metric-card">
          <span>上位10社シェア</span>
          <strong>${record.top10Ratio ?? '-'} %</strong>
        </div>
        <div class="metric-card">
          <span>最終更新</span>
          <strong>${record.updatedAt ?? record.lastSyncedAt ?? '-'}</strong>
        </div>
      </div>
    </section>

    ${renderChartImage(options.chartImageData)}

    <section>
      <h2>サマリー</h2>
      ${renderSummary(record.summary)}
    </section>

    <section>
      <h2>主要プレイヤー</h2>
      ${renderPlayers(record.players)}
    </section>

    <section>
      <h2>参考リンク</h2>
      ${renderLinks(record.links)}
    </section>

    <section>
      <h2>Notion サブページ抜粋</h2>
      ${renderSubpages(record)}
    </section>

    <footer>
      このレポートは Cloudflare Workers 上で生成された自動レポートです。AIモデル: ${aiModel}
    </footer>
  </body>
</html>`
}

export const generatePdfReport = async (
  env: Bindings,
  record: MarketDataRecord,
  options: PdfReportOptions = {}
): Promise<ArrayBuffer> => {
  if (!env.PDFSHIFT_API_KEY) {
    throw new Error('PDFSHIFT_API_KEY が未設定です')
  }

  const html = renderReportHtml(record, options)
  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      Authorization: encodeBasicAuth(env.PDFSHIFT_API_KEY),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source: html,
      use_print: false,
      format: 'A4',
      margin: {
        top: '16mm',
        bottom: '18mm',
        left: '14mm',
        right: '14mm'
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PDF生成に失敗しました: ${response.status} ${errorText}`)
  }

  return response.arrayBuffer()
}
