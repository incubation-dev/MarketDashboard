type FilterBarProps = {
  segments: string[]
  selectedSegments: string[]
  onSegmentsChange: (segments: string[]) => void
  issueKeyword: string
  onIssueChange: (issue: string) => void
  years: number[]
  selectedYear: number | 'ALL'
  onYearChange: (year: number | 'ALL') => void
  onRunResearch: () => void
  researchLoading: boolean
  onSync: () => void
  syncLoading: boolean
  onAskAI?: () => void
  aiChatLoading?: boolean
  theme?: 'light' | 'dark'
}

const yearOptionLabel = (year: number) => `${year}年`

export function FilterBar({
  segments,
  selectedSegments,
  onSegmentsChange,
  issueKeyword,
  onIssueChange,
  years,
  selectedYear,
  onYearChange,
  onRunResearch,
  researchLoading,
  onSync,
  syncLoading,
  onAskAI,
  aiChatLoading = false,
  theme = 'dark'
}: FilterBarProps): JSX.Element {
  const isDark = theme === 'dark'
  
  const handleSegmentToggle = (segment: string) => {
    if (selectedSegments.includes(segment)) {
      onSegmentsChange(selectedSegments.filter(s => s !== segment))
    } else {
      onSegmentsChange([...selectedSegments, segment])
    }
  }

  const handleSelectAll = () => {
    if (selectedSegments.length === segments.length) {
      onSegmentsChange([])
    } else {
      onSegmentsChange([...segments])
    }
  }
  
  return (
    <div className={`grid gap-4 rounded-3xl border p-6 shadow-soft backdrop-blur-xl ${
      isDark
        ? 'border-white/10 bg-black/40'
        : 'border-slate-200 bg-white/80'
    }`} data-animate>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="form-control w-full">
          <div className="label">
            <span className={`label-text text-xs uppercase tracking-[0.3em] ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}>Segment ({selectedSegments.length}選択)</span>
          </div>
          <details className={`dropdown w-full ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <summary className={`btn w-full justify-between ${
              isDark ? 'bg-black/60 border-white/10' : 'bg-white border-slate-300'
            }`}>
              {selectedSegments.length === 0 ? '選択してください' : 
               selectedSegments.length === segments.length ? '全セグメント' :
               `${selectedSegments.length}件選択中`}
            </summary>
            <ul className={`dropdown-content menu z-[1000] w-full max-h-96 overflow-y-auto rounded-box shadow ${
              isDark ? 'bg-slate-800 border border-white/10' : 'bg-white border border-slate-200'
            }`}>
              <li>
                <label className="label cursor-pointer justify-start gap-2 p-3">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={selectedSegments.length === segments.length}
                    onChange={handleSelectAll}
                  />
                  <span className="font-semibold">すべて選択/解除</span>
                </label>
              </li>
              <div className="divider my-0" />
              {segments.map((segment) => (
                <li key={segment}>
                  <label className="label cursor-pointer justify-start gap-2 p-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedSegments.includes(segment)}
                      onChange={() => handleSegmentToggle(segment)}
                    />
                    <span className="text-xs">{segment}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <label className="form-control w-full">
          <div className="label">
            <span className={`label-text text-xs uppercase tracking-[0.3em] ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}>Issue</span>
          </div>
          <input
            className={`input input-bordered w-full ${
              isDark
                ? 'border-white/10 bg-black/60 text-slate-100 placeholder:text-slate-500'
                : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
            }`}
            placeholder="例: レギュレーション、顧客不透明性など"
            value={issueKeyword}
            onChange={(event) => onIssueChange(event.target.value)}
          />
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className={`label-text text-xs uppercase tracking-[0.3em] ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}>Year</span>
          </div>
          <select
            className={`select select-bordered select-primary w-full ${
              isDark ? 'bg-black/60 text-slate-100' : 'bg-white text-slate-900 border-slate-300'
            }`}
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
          className={`btn btn-ghost ${
            isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
          }`}
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

        {onAskAI && (
          <button
            type="button"
            className={`btn ${
              isDark ? 'btn-outline btn-primary' : 'btn-outline border-slate-300 hover:bg-slate-100'
            }`}
            onClick={onAskAI}
            disabled={aiChatLoading || selectedSegments.length === 0}
          >
            {aiChatLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <span className="material-symbols-rounded text-base" aria-hidden="true">
                chat
              </span>
            )}
            <span className="ml-2 text-sm font-semibold">AIに質問</span>
          </button>
        )}

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
