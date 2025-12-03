import { useMemo } from 'react'
import { Bubble } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BubbleController,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(BubbleController, LinearScale, PointElement, Tooltip, Legend)

type BubbleDatum = {
  segment: string
  growth: number
  share: number
  size: number
}

type SampleBubbleChartProps = {
  data: BubbleDatum[]
}

const bubbleColors = ['#f87171', '#fb923c', '#fbbf24', '#1d4ed8', '#22d3ee']

export function SampleBubbleChart({ data }: SampleBubbleChartProps): JSX.Element {
  const chartData = useMemo(
    () => ({
      datasets: data.map((item, index) => ({
        label: item.segment,
        data: [
          {
            x: item.share,
            y: item.growth,
            r: Math.sqrt(item.size) / 3
          }
        ],
        backgroundColor: bubbleColors[index % bubbleColors.length] + '80',
        borderColor: bubbleColors[index % bubbleColors.length],
        borderWidth: 1.5,
        hoverBorderWidth: 2,
        hoverRadius: 15
      }))
    }),
    [data]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">市場ポートフォリオ</h2>
        <p className="text-sm text-slate-300/80">横軸: 市場占有率 / 縦軸: 成長率 / バブルサイズ: 市場規模</p>
      </div>
      <Bubble
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: 24
          },
          plugins: {
            legend: {
              display: true,
              labels: {
                color: 'rgba(255,255,255,0.7)',
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 10
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const datum = data[context.datasetIndex]
                  return [
                    datum.segment,
                    `成長率: ${datum.growth.toFixed(1)}%`,
                    `市場占有率: ${datum.share.toFixed(1)}%`,
                    `市場規模: ${datum.size.toLocaleString()}億円`
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
                color: 'rgba(255,255,255,0.7)'
              },
              ticks: {
                color: 'rgba(255,255,255,0.6)'
              },
              grid: {
                color: 'rgba(255,255,255,0.1)'
              }
            },
            y: {
              title: {
                display: true,
                text: '成長率 (%)',
                color: 'rgba(255,255,255,0.7)'
              },
              ticks: {
                color: 'rgba(255,255,255,0.6)'
              },
              grid: {
                color: 'rgba(255,255,255,0.1)'
              }
            }
          }
        }}
        className="h-[360px] w-full"
      />
    </div>
  )
}
