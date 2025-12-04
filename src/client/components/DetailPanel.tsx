import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MarketDataRecord } from '../lib/api'
import { formatDateTime, formatMarketSize, formatPercent } from '../lib/format'

type DetailPanelProps = {
  record: MarketDataRecord | null
  onDownloadPdf: () => void
  pdfLoading: boolean
  theme?: 'light' | 'dark'
}

export function DetailPanel({ record, onDownloadPdf, pdfLoading, theme = 'dark' }: DetailPanelProps): JSX.Element {
  const isDark = theme === 'dark'
  
  if (!record) {
    return (
      <div className={`rounded-3xl border border-dashed p-10 text-center ${
        isDark
          ? 'border-white/10 bg-black/40 text-slate-400'
          : 'border-slate-300 bg-slate-50 text-slate-600'
      }`} data-animate>
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
    <div className={`rounded-3xl border p-8 shadow-soft backdrop-blur-xl ${
      isDark ? 'border-white/10 bg-black/50' : 'border-slate-200 bg-white/80'
    }`} data-animate>
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge border-none bg-brand/20 text-brand">{record.year}年</span>
          <h2 className={`text-2xl font-semibold ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>{record.segment}</h2>
          <button
            type="button"
            className="btn btn-sm btn-primary ml-auto flex items-center gap-2 whitespace-nowrap text-xs"
            onClick={onDownloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <span className="material-symbols-rounded text-base" aria-hidden="true">
                picture_as_pdf
              </span>
            )}
            PDF レポート
          </button>
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
