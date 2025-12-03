type FilterBarProps = {
  segments: string[]
  selectedSegment: string
  onSegmentChange: (segment: string) => void
  issueKeyword: string
  onIssueChange: (issue: string) => void
  years: number[]
  selectedYear: number | 'ALL'
  onYearChange: (year: number | 'ALL') => void
  onRunResearch: () => void
  researchLoading: boolean
  onSync: () => void
  syncLoading: boolean
}

const yearOptionLabel = (year: number) => `${year}年`

export function FilterBar({
  segments,
  selectedSegment,
  onSegmentChange,
  issueKeyword,
  onIssueChange,
  years,
  selectedYear,
  onYearChange,
  onRunResearch,
  researchLoading,
  onSync,
  syncLoading
}: FilterBarProps): JSX.Element {
  return (
    <div className="grid gap-4 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-soft backdrop-blur-xl" data-animate>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-xs uppercase tracking-[0.3em] text-slate-300">Segment</span>
          </div>
          <select
            className="select select-bordered select-primary w-full bg-black/60 text-slate-100"
            value={selectedSegment}
            onChange={(event) => onSegmentChange(event.target.value)}
          >
            <option value="ALL">全セグメント</option>
            {segments.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-xs uppercase tracking-[0.3em] text-slate-300">Issue</span>
          </div>
          <input
            className="input input-bordered w-full border-white/10 bg-black/60 text-slate-100 placeholder:text-slate-500"
            placeholder="例: レギュレーション、顧客不透明性など"
            value={issueKeyword}
            onChange={(event) => onIssueChange(event.target.value)}
          />
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-xs uppercase tracking-[0.3em] text-slate-300">Year</span>
          </div>
          <select
            className="select select-bordered select-primary w-full bg-black/60 text-slate-100"
            value={selectedYear === 'ALL' ? 'ALL' : String(selectedYear)}
            onChange={(event) => {
              if (event.target.value === 'ALL') {
                onYearChange('ALL')
              } else {
                onYearChange(Number(event.target.value))
              }
            }}
          >
            <option value="ALL">全期間</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {yearOptionLabel(year)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <button
          type="button"
          className="btn btn-ghost text-slate-300 hover:bg-white/10"
          onClick={onSync}
          disabled={syncLoading}
        >
          {syncLoading ? (
            <span className="loading loading-spinner loading-sm text-primary" />
          ) : (
            <span className="material-symbols-rounded text-base text-brand" aria-hidden="true">
              sync
            </span>
          )}
          <span className="ml-2 text-sm font-medium">Notion同期</span>
        </button>

        <button
          type="button"
          className="btn btn-primary btn-wide shadow-lg shadow-brand/40"
          onClick={onRunResearch}
          disabled={researchLoading}
        >
          {researchLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <span className="material-symbols-rounded text-base" aria-hidden="true">
              auto_awesome
            </span>
          )}
          <span className="ml-2 text-sm font-semibold">AIで更新</span>
        </button>
      </div>
    </div>
  )
}
