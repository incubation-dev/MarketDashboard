import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MarketDataRecord } from '../lib/api'
import { formatDateTime, formatMarketSize, formatPercent } from '../lib/format'

type DetailPanelProps = {
  record: MarketDataRecord | null
}

export function DetailPanel({ record }: DetailPanelProps): JSX.Element {
  if (!record) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-black/40 p-10 text-center text-slate-400" data-animate>
        対象データがまだ登録されていません。「AIで更新」を実行して最新動向を取得してください。
      </div>
    )
  }

  const metrics = [
    {
      label: '市場規模',
      value: formatMarketSize(record.marketSize)
    },
    {
      label: '成長率',
      value: formatPercent(record.growthRate)
    },
    {
      label: '上位10社シェア',
      value: formatPercent(record.top10Ratio)
    },
    {
      label: '最終更新',
      value: formatDateTime(record.updatedAt ?? record.lastSyncedAt)
    }
  ]

  return (
    <div className="rounded-3xl border border-white/10 bg-black/50 p-8 shadow-soft backdrop-blur-xl" data-animate>
      <header className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge border-none bg-brand/20 text-brand">{record.year}年</span>
          <h2 className="text-2xl font-semibold text-white">{record.segment}</h2>
        </div>
        {record.issue && <p className="text-sm text-slate-300">課題: {record.issue}</p>}
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{metric.value}</p>
          </div>
        ))}
      </section>

      {record.summary && (
        <section className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">サマリー</h3>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm leading-relaxed text-slate-200/90">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{record.summary}</ReactMarkdown>
          </div>
        </section>
      )}

      {record.links.length > 0 && (
        <section className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">参考リンク</h3>
          <ul className="space-y-2">
            {record.links.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="link link-hover text-brand"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {record.subpages.length > 0 && (
        <section className="mt-8 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Notion サブページ</h3>
          <div className="space-y-3">
            {record.subpages.map((subpage) => (
              <details
                key={subpage.id}
                className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-brand/60"
              >
                <summary className="cursor-pointer text-sm font-semibold text-white">
                  {subpage.path || subpage.title}
                </summary>
                <div className="mt-3 text-sm leading-relaxed text-slate-200/85">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{subpage.markdown}</ReactMarkdown>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
