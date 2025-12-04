import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, stagger } from '@motionone/dom'
import { FilterBar } from './components/FilterBar'
import { MarketBubbleChart } from './components/MarketBubbleChart'
import type { ChartJSOrUndefined } from 'react-chartjs-2'
// PlayerMetricCard removed - now using compact inline display
import { DetailPanel } from './components/DetailPanel'
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
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${selectedRecord.segment.replace(/[^a-zA-Z0-9\-_.]/g, '_')}_${selectedRecord.year}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setStatus({ message: 'PDFレポートを生成しました', type: 'success' })
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
                className={`rounded-3xl border px-8 py-6 shadow-lg ${
                  theme === 'dark'
                    ? 'border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-slate-200'
                    : 'border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800'
                }`}
              >
                <p className={`text-xs uppercase tracking-[0.4em] font-bold mb-3 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>{metric.label}</p>
                <p className={`text-3xl font-bold tracking-tight ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{metric.value}</p>
              </div>
            ))}
            {/* Main Players */}
            <div className={`rounded-3xl border px-8 py-6 shadow-lg ${
              theme === 'dark'
                ? 'border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-slate-200'
                : 'border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800'
            }`}>
              <p className={`text-xs uppercase tracking-[0.4em] font-bold mb-3 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>主要プレイヤー</p>
              <div className="flex flex-wrap gap-2">
                {aggregatedPlayers.slice(0, 5).map((p, i) => (
                  <span key={i} className={`text-sm px-3 py-1.5 rounded-full font-bold shadow-md ${
                    theme === 'dark' ? 'bg-[#aa0000] text-white' : 'bg-brand text-white'
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
          {selectedRecord && selectedRecord.subpages && selectedRecord.subpages.length > 0 && (
            <section className={`rounded-3xl border p-6 shadow-soft backdrop-blur-xl ${
              theme === 'dark' ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white/80'
            }`}>
              <h3 className={`text-xl font-semibold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                市場概況：{selectedRecord.segment}
              </h3>
              <div className="space-y-4">
                {selectedRecord.subpages.map((subpage, index) => (
                  <div key={index} className={`p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'
                  }`}>
                    <h4 className={`text-sm font-semibold mb-2 ${
                      theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                    }`}>
                      {subpage.title}
                    </h4>
                    <div className={`text-xs prose prose-sm max-w-none ${
                      theme === 'dark' ? 'prose-invert' : ''
                    }`}>
                      <pre className="whitespace-pre-wrap font-sans">{subpage.markdown}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <DetailPanel
            record={selectedRecord}
            onDownloadPdf={handleDownloadPdf}
            pdfLoading={pdfLoading}
            theme={theme}
          />
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
