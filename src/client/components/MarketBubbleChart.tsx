import { useMemo } from 'react'
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
import type { MarketDataRecord } from '../lib/api'
import { formatMarketSize, formatPercent } from '../lib/format'

ChartJS.register(BubbleController, LinearScale, PointElement, Tooltip, Legend, Filler)

type MarketBubbleChartProps = {
  data: MarketDataRecord[]
  selectedId?: number
  onSelect: (record: MarketDataRecord) => void
}

const bubblePalette = ['#f87171', '#fb923c', '#facc15', '#38bdf8', '#34d399', '#a78bfa']

const fallbackValue = (value: number | null | undefined, defaultValue: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : defaultValue

export function MarketBubbleChart({ data, selectedId, onSelect }: MarketBubbleChartProps): JSX.Element {
  const chartData = useMemo(() => {
    if (data.length === 0) {
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

    return {
      datasets: data.map((record, index) => {
        const background = bubblePalette[index % bubblePalette.length]
        const border = background
        const isSelected = record.id === selectedId
        return {
          label: `${record.segment} (${record.year})`,
          data: [
            {
              x: fallbackValue(record.top10Ratio, 40),
              y: fallbackValue(record.growthRate, 5),
              r: Math.max(Math.sqrt(fallbackValue(record.marketSize, 50)) * scaleFactor, 8)
            }
          ],
          borderColor: border,
          backgroundColor: `${background}1A`,
          borderWidth: isSelected ? 2.8 : 1.6,
          hoverBorderWidth: 3,
          hoverBackgroundColor: `${background}33`
        }
      })
    }
  }, [data, selectedId])

  if (data.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/40 text-slate-400">
        表示できる市場データがありません。
      </div>
    )
  }

  return (
    <div className="flex h-[420px] flex-col gap-4" data-animate>
      <div>
        <h2 className="text-lg font-semibold text-white">市場ポートフォリオ</h2>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          X: 市場占有率（推定） / Y: 成長率 / サイズ: 市場規模
        </p>
      </div>
      <Bubble
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
              display: false
            },
            tooltip: {
              callbacks: {
                title: ([context]) => {
                  const record = data[context.datasetIndex]
                  return `${record.segment} (${record.year})`
                },
                label: (context) => {
                  const record = data[context.datasetIndex]
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
                color: 'rgba(255,255,255,0.8)'
              },
              ticks: {
                color: 'rgba(255,255,255,0.6)'
              },
              grid: {
                color: 'rgba(255,255,255,0.08)'
              },
              min: 0,
              max: 100
            },
            y: {
              title: {
                display: true,
                text: '成長率 (%)',
                color: 'rgba(255,255,255,0.8)'
              },
              ticks: {
                color: 'rgba(255,255,255,0.6)'
              },
              grid: {
                color: 'rgba(255,255,255,0.08)'
              }
            }
          },
          onClick: (_event, elements) => {
            if (!elements.length) return
            const first = elements[0]
            const record = data[first.datasetIndex]
            if (record) {
              onSelect(record)
            }
          }
        }}
      />
    </div>
  )
}
