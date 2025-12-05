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

const renderMarkdownToHtml = (markdown: string): string => {
  return escapeHtml(markdown)
    // Headers
    .replace(/^### (.+)$/gm, '<h4 style="font-size: 14px; color: #333; margin: 14px 0 8px; font-weight: 600;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size: 16px; color: #1a1a1a; margin: 18px 0 10px; font-weight: 600;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size: 18px; color: #aa0000; margin: 20px 0 12px; font-weight: 600;">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600; color: #1a1a1a;">$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #aa0000; text-decoration: none; font-weight: 500;">$1</a>')
    // Lists
    .replace(/^- (.+)$/gm, '<li style="margin-bottom: 6px;">$1</li>')
    // Paragraphs
    .split('\n\n')
    .map(para => {
      if (para.trim().startsWith('<h') || para.trim().startsWith('<li')) {
        return para
      }
      if (para.trim()) {
        return `<p style="margin-bottom: 10px; line-height: 1.9;">${para.replace(/\n/g, '<br />')}</p>`
      }
      return ''
    })
    .join('')
}

const renderSubpages = (record: MarketDataRecord) => {
  if (record.subpages.length === 0 && !record.summary) {
    return '<p>市場インサイト情報は未登録です。</p>'
  }
  
  // If no subpages but summary exists, render summary here
  if (record.subpages.length === 0 && record.summary) {
    return `
      <div class="insight-card">
        <div class="insight-content">${renderMarkdownToHtml(record.summary)}</div>
      </div>
    `
  }
  
  // Render subpages
  return record.subpages
    .map((subpage) => {
      return `
        <div class="insight-card">
          <h3><span class="bullet">●</span>${escapeHtml(subpage.title)}</h3>
          <div class="insight-content">${renderMarkdownToHtml(subpage.markdown)}</div>
        </div>
      `
    })
    .join('')
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
        font-family: 'Yu Gothic UI', 'Yu Gothic', 'Meiryo', 'Hiragino Kaku Gothic ProN', sans-serif;
        color: #1a1a1a;
        margin: 0;
        padding: 40px 48px;
        background: #ffffff;
        line-height: 1.8;
      }
      header {
        border-bottom: 3px solid ${BRAND_COLOR};
        padding-bottom: 20px;
        margin-bottom: 32px;
      }
      h1 {
        font-size: 32px;
        font-weight: 600;
        margin: 0 0 12px;
        color: ${BRAND_COLOR};
        letter-spacing: 0.02em;
      }
      h2 {
        font-size: 22px;
        font-weight: 600;
        margin: 32px 0 16px;
        color: #1a1a1a;
        padding-left: 12px;
        border-left: 4px solid ${BRAND_COLOR};
      }
      h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 20px 0 10px;
        color: #333333;
      }
      p, li, pre {
        font-size: 13px;
        line-height: 1.9;
        color: #333333;
      }
      pre {
        white-space: pre-wrap;
        background: #f8f9fa;
        padding: 16px;
        border-radius: 8px;
        border-left: 3px solid ${BRAND_COLOR};
        font-family: 'Yu Gothic UI', 'Yu Gothic', 'Meiryo', sans-serif;
      }
      ul { 
        padding-left: 24px;
        margin: 12px 0;
      }
      ul li {
        margin-bottom: 8px;
      }
      ul.links { 
        padding-left: 0; 
        list-style: none; 
      }
      ul.links li { 
        margin-bottom: 8px;
        padding-left: 20px;
        position: relative;
      }
      ul.links li::before {
        content: "▸";
        position: absolute;
        left: 0;
        color: ${BRAND_COLOR};
        font-weight: bold;
      }
      ul.links a { 
        color: ${BRAND_COLOR}; 
        text-decoration: none;
        font-weight: 500;
      }
      ul.links a:hover { 
        text-decoration: underline; 
      }
      .pill {
        display: inline-block;
        background: ${BRAND_COLOR};
        color: #ffffff;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: 500;
        font-size: 12px;
        margin: 4px 6px 4px 0;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin: 20px 0;
      }
      .metric-card {
        background: #f8f9fa;
        padding: 18px 20px;
        border-radius: 12px;
        border-left: 4px solid ${BRAND_COLOR};
      }
      .metric-card span {
        display: block;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #666666;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .metric-card strong {
        font-size: 24px;
        color: #1a1a1a;
        font-weight: 600;
      }
      .chart-section {
        margin: 24px 0 32px;
        text-align: center;
        background: #f8f9fa;
        padding: 20px;
        border-radius: 12px;
      }
      .chart-section img {
        max-width: 100%;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .insight-card {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        border-left: 4px solid ${BRAND_COLOR};
      }
      .insight-card h3 {
        margin-top: 0;
        color: ${BRAND_COLOR};
        font-size: 16px;
      }
      .insight-card .bullet {
        color: ${BRAND_COLOR};
        margin-right: 8px;
      }
      .insight-content {
        margin-top: 12px;
        line-height: 1.9;
      }
      footer {
        margin-top: 48px;
        padding-top: 16px;
        border-top: 2px solid #e0e0e0;
        font-size: 11px;
        color: #666666;
        text-align: center;
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
      </div>
    </section>

    ${renderChartImage(options.chartImageData)}

    <section>
      <h2>市場インサイト</h2>
      ${renderSubpages(record)}
    </section>

    <section>
      <h2>主要プレイヤー</h2>
      ${renderPlayers(record.players)}
    </section>

    <section>
      <h2>参考リンク</h2>
      ${renderLinks(record.links)}
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
