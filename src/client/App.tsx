import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, stagger } from '@motionone/dom'
import { FilterBar } from './components/FilterBar'
import { MarketBubbleChart } from './components/MarketBubbleChart'
import type { ChartJSOrUndefined } from 'react-chartjs-2'
// PlayerMetricCard removed - now using compact inline display
// DetailPanel removed - PDF preview in separate window
import { StatusToast } from './components/StatusToast'
// LoadingOverlay removed - using inline loading indicators instead
import { AiChatModal } from './components/AiChatModal'
import { fetchAllMarketData, generatePdfReportRequest, type MarketDataRecord } from './lib/api'
import { formatMarketSize, formatPercent } from './lib/format'

type StatusState = {
  message: string
  type: 'success' | 'error'
} | null

type AggregateMetrics = {
  totalMarketSize: number
  averageGrowth: number | null
  averageShare: number | null
}

const computeAggregateMetrics = (records: MarketDataRecord[]): AggregateMetrics => {
  if (records.length === 0) {
    return {
      totalMarketSize: 0,
      averageGrowth: null,
      averageShare: null
    }
  }

  const totalMarketSize = records.reduce((sum, record) => sum + (record.marketSize ?? 0), 0)

  const growthValues = records.map((record) => record.growthRate).filter((value) => typeof value === 'number') as number[]
  const averageGrowth =
    growthValues.length > 0
      ? growthValues.reduce((sum, value) => sum + value, 0) / growthValues.length
      : null

  const shareValues = records.map((record) => record.top10Ratio).filter((value) => typeof value === 'number') as number[]
  const averageShare =
    shareValues.length > 0
      ? shareValues.reduce((sum, value) => sum + value, 0) / shareValues.length
      : null

  return {
    totalMarketSize,
    averageGrowth,
    averageShare
  }
}

const collectTopPlayers = (records: MarketDataRecord[]): Array<{ name: string; count: number }> => {
  const counter = new Map<string, number>()
  for (const record of records) {
    for (const player of record.players) {
      const current = counter.get(player) ?? 0
      counter.set(player, current + 1)
    }
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([player, count]) => ({ name: player, count }))
}

// deriveOverlayText removed - no longer using fullscreen overlay

export function App(): JSX.Element {
  const [records, setRecords] = useState<MarketDataRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [status, setStatus] = useState<StatusState>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  const chartRef = useRef<ChartJSOrUndefined<'bubble'>>(null)

  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const [issueKeyword, setIssueKeyword] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(2030)
  const [selectedRecord, setSelectedRecord] = useState<MarketDataRecord | null>(null)
  const [aiChatLoading, setAiChatLoading] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAllMarketData()
        setRecords(data)
      } catch (error) {
        console.error('[ui] failed to load market data', error)
        setStatus({ message: '市場データの取得に失敗しました', type: 'error' })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [refreshToken])

  useEffect(() => {
    if (status) {
      const timer = window.setTimeout(() => setStatus(null), 4000)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [status])

  const segments = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.segment))).sort((a, b) => a.localeCompare(b))
  }, [records])

  const years = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.year))).sort((a, b) => b - a)
  }, [records])

  // Auto-select all segments on initial load
  useEffect(() => {
    if (segments.length > 0 && selectedSegments.length === 0) {
      setSelectedSegments(segments)
    }
  }, [segments])

  const keyword = issueKeyword.trim().toLowerCase()

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (selectedSegments.length > 0 && !selectedSegments.includes(record.segment)) return false
      if (selectedYear !== 'ALL' && record.year !== selectedYear) return false
      if (keyword.length > 0) {
        const haystacks = [record.issue, record.summary, ...record.players].filter(Boolean)
        const match = haystacks.some((value) => value?.toLowerCase().includes(keyword))
        if (!match) return false
      }
      return true
    })
  }, [records, selectedSegments, selectedYear, keyword])

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedRecord(null)
      return
    }

    setSelectedRecord((current) => {
      if (current && filteredRecords.some((record) => record.id === current.id)) {
        return current
      }
      return filteredRecords[0]
    })
  }, [filteredRecords])

  useEffect(() => {
    if (filteredRecords.length === 0) return
    animate('[data-animate]', { opacity: [0, 1], y: [16, 0] }, { duration: 0.7, delay: stagger(0.05) })
  }, [filteredRecords])

  // Animate chart and metrics when data or year changes (bounce effect)
  useEffect(() => {
    const chartSection = document.querySelector('[data-chart]')
    const metricsSection = document.querySelector('[data-metrics]')
    if (chartSection) {
      animate(chartSection, { scale: [0.95, 1], opacity: [0.7, 1] }, { duration: 0.4, easing: 'ease-out' })
    }
    if (metricsSection) {
      animate(metricsSection, { scale: [0.95, 1], opacity: [0.7, 1] }, { duration: 0.4, delay: 0.08, easing: 'ease-out' })
    }
  }, [filteredRecords, selectedYear])

  const aggregate = useMemo(() => computeAggregateMetrics(filteredRecords), [filteredRecords])
  const aggregatedPlayers = useMemo(() => collectTopPlayers(filteredRecords), [filteredRecords])

  // Simple Markdown to HTML parser
  const parseMarkdownToHtml = (markdown: string, theme: 'light' | 'dark'): string => {
    const isDark = theme === 'dark'
    
    return markdown
      // Headers
      .replace(/^### (.+)$/gm, `<h3 class="text-lg font-bold mt-6 mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}"}>$1</h3>`)
      .replace(/^## (.+)$/gm, `<h2 class="text-xl font-bold mt-8 mb-4 ${isDark ? 'text-white' : 'text-slate-900'}"}>$1</h2>`)
      .replace(/^# (.+)$/gm, `<h1 class="text-2xl font-bold mt-8 mb-4 ${isDark ? 'text-white' : 'text-slate-900'}"}>$1</h1>`)
      
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#aa0000] hover:underline">$1</a>')
      
      // Lists (ordered)
      .replace(/^\d+\.\s+(.+)$/gm, (match) => {
        return `<li class="ml-6 mb-2">${match.replace(/^\d+\.\s+/, '')}</li>`
      })
      
      // Lists (unordered)
      .replace(/^-\s+(.+)$/gm, '<li class="ml-6 mb-2 list-disc">$1</li>')
      
      // Horizontal rule
      .replace(/^---$/gm, `<hr class="my-6 ${isDark ? 'border-white/20' : 'border-slate-300'}" />`)
      
      // Paragraphs (preserve line breaks)
      .split('\n\n')
      .map(para => {
        if (para.trim().startsWith('<h') || para.trim().startsWith('<li') || para.trim().startsWith('<hr')) {
          return para
        }
        return `<p class="mb-4">${para.replace(/\n/g, '<br />')}</p>`
      })
      .join('')
  }

  const handleRunResearch = async () => {
    const targetSegment = selectedSegments.length > 0 ? selectedSegments[0] : segments[0]
    if (!targetSegment) {
      setStatus({ message: '先に対象セグメントを選択してください', type: 'error' })
      return
    }

    const issueForAi = keyword.length > 0 ? issueKeyword.trim() : selectedRecord?.issue ?? null
    const yearForAi = selectedYear === 'ALL' ? selectedRecord?.year ?? new Date().getFullYear() : selectedYear

    setAiLoading(true)
    setStatus(null)
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: targetSegment,
          issue: issueForAi && issueForAi.length > 0 ? issueForAi : null,
          year: yearForAi
        })
      })

      const json = await response.json().catch(() => ({ status: 'error', message: 'AIレスポンスの解析に失敗しました' }))
      if (!response.ok || json.status !== 'ok') {
        throw new Error(json.message ?? 'AI更新に失敗しました')
      }

      setStatus({ message: 'AIが市場データを最新情報に更新しました', type: 'success' })
      setRefreshToken((prev) => prev + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI更新に失敗しました'
      setStatus({ message, type: 'error' })
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiChat = async (question: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments: selectedSegments,
        issue: issueKeyword.trim() || undefined,
        year: selectedYear === 'ALL' ? undefined : selectedYear,
        question
      })
    })

    const json = await response.json()
    if (!response.ok || json.status !== 'ok') {
      throw new Error(json.message ?? 'AI対話に失敗しました')
    }

    return { answer: json.answer }
  }

  const handleSync = async () => {
    setSyncLoading(true)
    setStatus(null)
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: selectedSegments.length > 0 ? selectedSegments[0] : undefined
        })
      })

      const json = await response
        .json()
        .catch(() => ({ status: 'error', message: 'Notion同期レスポンスの解析に失敗しました' }))
      if (!response.ok || json.status !== 'ok') {
        throw new Error(json.message ?? 'Notion同期に失敗しました')
      }

      setStatus({ message: 'Notionとの同期が完了しました', type: 'success' })
      setRefreshToken((prev) => prev + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notion同期に失敗しました'
      setStatus({ message, type: 'error' })
    } finally {
      setSyncLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!selectedRecord) {
      setStatus({ message: 'PDF化する市場データが選択されていません', type: 'error' })
      return
    }

    setPdfLoading(true)
    try {
      const chartImageData = chartRef.current?.toBase64Image?.('image/png', 1)
      const blob = await generatePdfReportRequest({
        id: selectedRecord.id,
        chartImageData: chartImageData ?? null
      })
      
      // Open PDF in a new window with download button
      const pdfUrl = URL.createObjectURL(blob)
      const pdfWindow = window.open('', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes')
      
      if (pdfWindow) {
        const filename = `${selectedRecord.segment.replace(/[^a-zA-Z0-9\-_.]/g, '_')}_${selectedRecord.year}.pdf`
        
        pdfWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PDF Preview - ${selectedRecord.segment}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                color: #fff;
                display: flex;
                flex-direction: column;
                height: 100vh;
                overflow: hidden;
              }
              .header {
                background: rgba(0, 0, 0, 0.3);
                padding: 16px 24px;
                border-bottom: 1px solid rgba(170, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: space-between;
                backdrop-filter: blur(10px);
              }
              .header h1 {
                font-size: 18px;
                font-weight: 600;
                color: #fff;
              }
              .download-btn {
                background: #aa0000;
                color: #fff;
                border: none;
                padding: 10px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .download-btn:hover {
                background: #cc0000;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(170, 0, 0, 0.4);
              }
              .download-btn:active {
                transform: translateY(0);
              }
              .pdf-container {
                flex: 1;
                padding: 16px;
                overflow: auto;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                background: rgba(0, 0, 0, 0.2);
              }
              embed {
                border: 1px solid rgba(170, 0, 0, 0.3);
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                width: 100%;
                height: calc(100vh - 80px);
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📄 ${selectedRecord.segment} (${selectedRecord.year}年)</h1>
              <button class="download-btn" onclick="downloadPdf()">
                <span>⬇</span>
                <span>PDFをダウンロード</span>
              </button>
            </div>
            <div class="pdf-container">
              <embed src="${pdfUrl}" type="application/pdf" />
            </div>
            <script>
              function downloadPdf() {
                const a = document.createElement('a');
                a.href = '${pdfUrl}';
                a.download = '${filename}';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            </script>
          </body>
          </html>
        `)
        pdfWindow.document.close()
        
        setStatus({ message: 'PDFプレビューを新しいウィンドウで開きました', type: 'success' })
      } else {
        // Fallback if popup blocked
        const anchor = document.createElement('a')
        anchor.href = pdfUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(pdfUrl)
        setStatus({ message: 'PDFレポートをダウンロードしました', type: 'success' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDFレポート生成に失敗しました'
      setStatus({ message, type: 'error' })
    } finally {
      setPdfLoading(false)
    }
  }

  // Removed fullscreen overlay - using inline indicators only

  const metricCards = [
    {
      label: '対象市場規模 (合計)',
      value: formatMarketSize(aggregate.totalMarketSize)
    },
    {
      label: '平均成長率',
      value: formatPercent(aggregate.averageGrowth)
    },
    {
      label: '平均市場占有率',
      value: formatPercent(aggregate.averageShare)
    }
  ]

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-black via-neutral-950 to-slate-900 text-white'
        : 'bg-gradient-to-br from-white via-slate-50 to-gray-100 text-slate-900'
    }`}>
      <div className="relative isolate overflow-hidden">
        <div className={`pointer-events-none absolute inset-0 -z-10 ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_top_left,#aa000033,transparent_55%),radial-gradient(circle_at_bottom_right,#1d4ed833,transparent_55%)]'
            : 'bg-[radial-gradient(circle_at_top_left,#aa000022,transparent_65%),radial-gradient(circle_at_bottom_right,#1d4ed822,transparent_65%)]'
        }`} />

        <header className="w-full px-8 pt-16 pb-10" data-animate>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span className="badge badge-outline border-brand/50 bg-brand/10 text-xs uppercase tracking-[0.4em] text-brand">
                Market Intelligence
              </span>
              <h1 className={`mt-6 text-4xl font-semibold tracking-tight sm:text-5xl ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Notion-Driven Market Intelligence Dashboard
              </h1>
              <p className={`mt-3 max-w-3xl text-sm ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}>
                NotionをマスターDBとして活用し、AIが自動で市場動向を補完。リアルタイムの可視化と分析レポート生成をワンストップで実現します。
              </p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`ml-4 rounded-lg p-3 transition-all ${
                theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
              }`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main className="w-full space-y-8 px-8 pb-24">
          <FilterBar
            segments={segments}
            selectedSegments={selectedSegments}
            onSegmentsChange={setSelectedSegments}
            issueKeyword={issueKeyword}
            onIssueChange={setIssueKeyword}
            years={years}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            onRunResearch={handleRunResearch}
            researchLoading={aiLoading}
            onSync={handleSync}
            syncLoading={syncLoading}
            onAskAI={() => setChatModalOpen(true)}
            aiChatLoading={aiChatLoading}
            theme={theme}
          />

          {/* Metrics Cards - Horizontal Layout */}
          <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-4" data-metrics data-animate>
            {metricCards.map((metric) => (
              <div
                key={metric.label}
                className={`rounded-3xl border px-8 py-5 shadow-xl text-center ${
                  theme === 'dark'
                    ? 'border-white/10 bg-white/5 text-slate-200'
                    : 'border-slate-300 bg-slate-100 text-slate-800'
                }`}
              >
                <p className={`text-sm uppercase tracking-[0.4em] font-bold mb-3 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>{metric.label}</p>
                <p className={`text-5xl font-black tracking-tight ${
                  theme === 'dark' ? 'text-white drop-shadow-lg' : 'text-slate-900 drop-shadow-md'
                }`}>{metric.value}</p>
              </div>
            ))}
            {/* Main Players */}
            <div className={`rounded-3xl border px-8 py-5 shadow-xl text-center ${
              theme === 'dark'
                ? 'border-white/10 bg-white/5 text-slate-200'
                : 'border-slate-300 bg-slate-100 text-slate-800'
            }`}>
              <p className={`text-sm uppercase tracking-[0.4em] font-bold mb-3 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>主要プレイヤー</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {aggregatedPlayers.slice(0, 5).map((p, i) => (
                  <span key={i} className={`text-sm px-4 py-2 rounded-full font-bold shadow-lg ${
                    theme === 'dark' ? 'bg-[#aa0000] text-white' : 'bg-[#aa0000] text-white'
                  }`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Market Bubble Chart - Full Width */}
          <section className="grid gap-6">
            <div data-chart className={`rounded-3xl border p-6 shadow-soft backdrop-blur-xl ${
              theme === 'dark' ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white/80'
            }`} style={{ height: 'calc(100vh - 480px)', minHeight: '600px', maxHeight: '1000px' }}>
              <MarketBubbleChart
                ref={chartRef}
                data={filteredRecords}
                selectedId={selectedRecord?.id}
                onSelect={setSelectedRecord}
                theme={theme}
              />
            </div>
          </section>

          {/* Market Overview Section - Below Chart */}
          {selectedRecord && (
            <section className={`rounded-3xl border p-8 shadow-xl backdrop-blur-xl ${
              theme === 'dark' ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white/90'
            }`} data-animate>
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-1 h-8 rounded-full ${
                  theme === 'dark' ? 'bg-[#aa0000]' : 'bg-[#aa0000]'
                }`}></div>
                <h3 className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  市場インサイト：{selectedRecord.segment}
                </h3>
              </div>
              {/* Show subpages if available */}
              {selectedRecord.subpages && selectedRecord.subpages.length > 0 ? (
                <div className="space-y-6">
                  {selectedRecord.subpages.map((subpage, index) => (
                    <div key={index} className={`p-6 rounded-2xl border ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h4 className={`text-base font-bold mb-3 flex items-center gap-2 ${
                        theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                      }`}>
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          theme === 'dark' ? 'bg-[#aa0000]' : 'bg-[#aa0000]'
                        }`}></span>
                        {subpage.title}
                      </h4>
                      <div className={`text-sm leading-relaxed ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        <div className="whitespace-pre-wrap">{subpage.markdown}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedRecord.summary ? (
                /* Show page content from summary if no subpages */
                <div className={`p-6 rounded-2xl border ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div 
                    className={`markdown-content text-sm leading-relaxed ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}
                    dangerouslySetInnerHTML={{ 
                      __html: parseMarkdownToHtml(selectedRecord.summary, theme) 
                    }}
                  />
                </div>
              ) : (
                <div className={`p-8 rounded-2xl border text-center ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    この市場セグメントには、Notionのコンテンツがまだ登録されていません。<br />
                    Notionでコンテンツを追加し、「Notion同期」ボタンをクリックしてデータを更新してください。
                  </p>
                </div>
              )}
            </section>
          )}

          {/* PDF Download Button - Standalone */}
          {selectedRecord && (
            <div className="flex justify-center mt-8" data-animate>
              <button
                type="button"
                className={`px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl transition-all flex items-center gap-3 ${
                  theme === 'dark'
                    ? 'bg-[#aa0000] hover:bg-[#cc0000] text-white'
                    : 'bg-[#aa0000] hover:bg-[#cc0000] text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>PDF生成中...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📄</span>
                    <span>PDFレポート出力</span>
                  </>
                )}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* LoadingOverlay removed for better UX */}
      <StatusToast
        message={status?.message ?? null}
        type={status?.type ?? 'success'}
        onClose={() => setStatus(null)}
      />
      <AiChatModal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        selectedSegments={selectedSegments}
        issue={issueKeyword}
        year={selectedYear}
        onSubmit={handleAiChat}
        theme={theme}
      />
    </div>
  )
}
