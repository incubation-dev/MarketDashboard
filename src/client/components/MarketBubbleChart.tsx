import { forwardRef, useMemo } from 'react'
import { Bubble } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BubbleController,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { ChartJSOrUndefined } from 'react-chartjs-2'
import type { MarketDataRecord } from '../lib/api'
import { formatMarketSize, formatPercent } from '../lib/format'

ChartJS.register(BubbleController, LinearScale, PointElement, Tooltip, Legend, Filler)

type MarketBubbleChartProps = {
  data: MarketDataRecord[]
  selectedId?: number
  onSelect: (record: MarketDataRecord) => void
  theme?: 'light' | 'dark'
}

const bubblePalette = ['#f87171', '#fb923c', '#facc15', '#38bdf8', '#34d399', '#a78bfa']

const fallbackValue = (value: number | null | undefined, defaultValue: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : defaultValue

export const MarketBubbleChart = forwardRef<ChartJSOrUndefined<'bubble'>, MarketBubbleChartProps>(
  ({ data, selectedId, onSelect, theme = 'dark' }, ref) => {
    const isDark = theme === 'dark'
  
  console.log('[MarketBubbleChart] Received data:', data.length, 'records')
  
  const chartData = useMemo(() => {
    console.log('[MarketBubbleChart] chartData recalculating. data.length:', data.length, 'selectedId:', selectedId)
    
    if (data.length === 0) {
      console.log('[MarketBubbleChart] No data to display')
      return {
        datasets: []
      }
    }

    const maxMarketSize = data.reduce((max, record) => {
      if (typeof record.marketSize === 'number' && record.marketSize > max) {
        return record.marketSize
      }
      return max
    }, 1)

    const scaleFactor = maxMarketSize > 0 ? 60 / Math.sqrt(maxMarketSize) : 6

    // Group by segment for color assignment
    const segmentMap = new Map<string, MarketDataRecord[]>()
    for (const record of data) {
      const existing = segmentMap.get(record.segment) ?? []
      existing.push(record)
      segmentMap.set(record.segment, existing)
    }

    console.log('[MarketBubbleChart] Creating datasets for', data.length, 'records. ScaleFactor:', scaleFactor)
    console.log('[MarketBubbleChart] SegmentMap:', Array.from(segmentMap.keys()))

    let datasetIndex = 0
    const datasets = []

    for (const [segment, records] of segmentMap) {
      const background = bubblePalette[datasetIndex % bubblePalette.length]
      const border = background

      const dataPoints = records.map(record => {
        const isSelected = record.id === selectedId
        const x = fallbackValue(record.top10Ratio, 40)
        const y = fallbackValue(record.growthRate, 5)
        const r = Math.max(Math.sqrt(fallbackValue(record.marketSize, 100_000_000)) * scaleFactor, 12)
        return {
          x,
          y,
          r: isSelected ? r * 1.2 : r,
          record
        }
      })

      if (datasetIndex === 0) {
        console.log(`[MarketBubbleChart] First dataset "${segment}": ${dataPoints.length} points`, dataPoints[0])
      }

      datasets.push({
        label: segment,
        data: dataPoints,
        borderColor: border,
        backgroundColor: `${background}1A`,
        borderWidth: 1.6,
        hoverBorderWidth: 3,
        hoverBackgroundColor: `${background}33`
      })

      datasetIndex++
    }

    return { datasets }
  }, [data, selectedId])

  if (data.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/40 text-slate-400">
        表示できる市場データがありません。
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4" data-animate>
      <div>
        <h2 className={`text-lg font-semibold ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>市場ポートフォリオ</h2>
        <p className={`text-xs uppercase tracking-[0.2em] ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          X: 市場占有率（推定） / Y: 成長率 / サイズ: 市場規模
        </p>
      </div>
      <Bubble
        ref={ref}
        className="h-full w-full"
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: 20
          },
          plugins: {
            legend: {
              display: data.length > 1,
              position: 'bottom' as const,
              labels: {
                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.8)',
                usePointStyle: true,
                padding: 15
              }
            },
            tooltip: {
              callbacks: {
                title: ([context]) => {
                  const point = context.dataset.data[context.dataIndex] as any
                  const record = point.record as MarketDataRecord
                  return `${record.segment} (${record.year})`
                },
                label: (context) => {
                  const point = context.dataset.data[context.dataIndex] as any
                  const record = point.record as MarketDataRecord
                  return [
                    `成長率: ${formatPercent(record.growthRate)}`,
                    `市場占有率: ${formatPercent(record.top10Ratio)}`,
                    `市場規模: ${formatMarketSize(record.marketSize)}`
                  ]
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: '市場占有率 (%)',
                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.8)'
              },
              ticks: {
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)'
              },
              grid: {
                color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
              },
              min: 0,
              max: (() => {
                const maxX = data.reduce((max, r) => Math.max(max, r.top10Ratio ?? 0), 0)
                const calculatedMax = Math.ceil(maxX * 1.2)
                return Math.max(calculatedMax, 100)
              })()
            },
            y: {
              title: {
                display: true,
                text: '成長率 (%)',
                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.8)'
              },
              ticks: {
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)'
              },
              grid: {
                color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
              },
              min: (() => {
                const minY = data.reduce((min, r) => Math.min(min, r.growthRate ?? 0), 0)
                const calculatedMin = minY < 0 ? Math.floor(minY * 1.3) : Math.floor(minY * 0.8)
                return Math.min(calculatedMin, -5)
              })(),
              max: (() => {
                const maxY = data.reduce((max, r) => Math.max(max, r.growthRate ?? 0), 0)
                const calculatedMax = Math.ceil(maxY * 1.3)
                return Math.max(calculatedMax, 70)
              })()
            }
          },
          onClick: (_event, elements) => {
            if (!elements.length) return
            const first = elements[0]
            const dataset = chartData.datasets[first.datasetIndex]
            const point = dataset.data[first.index] as any
            const record = point.record as MarketDataRecord
            if (record) {
              onSelect(record)
            }
          }
        }}
      />
    </div>
  )
}
)

MarketBubbleChart.displayName = 'MarketBubbleChart'
