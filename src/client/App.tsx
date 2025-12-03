import { useMemo } from 'react'
import { PlayerMetricCard } from './components/PlayerMetricCard'
import { SampleBubbleChart } from './components/SampleBubbleChart'

const samplePlayers = [
  { name: 'A-Company', share: 32.2 },
  { name: 'B-Company', share: 21.1 },
  { name: 'C-Company', share: 14.6 }
]

export function App(): JSX.Element {
  const chartData = useMemo(
    () => [
      { segment: 'Smart Home Energy', growth: 18.2, share: 42.1, size: 2800 },
      { segment: 'HVAC Optimization', growth: 12.4, share: 36.2, size: 1800 },
      { segment: 'Grid Flexibility', growth: 23.5, share: 18.6, size: 3800 }
    ],
    []
  )

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <div className="relative overflow-hidden pb-24">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-transparent to-transparent blur-3xl" />
        <header className="relative mx-auto flex max-w-6xl flex-col gap-4 px-6 pt-16">
          <span className="badge badge-outline w-fit border-brand/60 bg-brand/10 text-xs uppercase tracking-[0.3em] text-brand">
            Market Intelligence
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Notion-Driven Market Intelligence Dashboard
          </h1>
          <p className="max-w-3xl text-base text-slate-200/80">
            最新の市場セグメントトレンドをNotionから取り込み、AIがリアルタイムでアップデート。戦略の選択肢をスムーズに可視化します。
          </p>
        </header>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-24">
        <section className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/5 bg-base-200/50 p-6 shadow-soft backdrop-blur-xl">
            <SampleBubbleChart data={chartData} />
          </div>
          <div className="space-y-6">
            <PlayerMetricCard title="主要プレイヤー" players={samplePlayers} />
            <div className="rounded-3xl border border-white/5 bg-base-200/50 p-6 backdrop-blur-xl">
              <h2 className="mb-3 text-lg font-semibold text-white">サマリー</h2>
              <p className="text-sm leading-relaxed text-slate-200/70">
                このセクションはNotionサブページとAIサマリーから生成される市場概要と課題の抜粋が表示されます。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
