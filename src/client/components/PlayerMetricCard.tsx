type PlayerMetricCardProps = {
  title: string
  subtitle?: string
  players: string[]
  theme?: 'light' | 'dark'
}

export function PlayerMetricCard({ title, subtitle, players, theme = 'dark' }: PlayerMetricCardProps): JSX.Element {
  const isDark = theme === 'dark'
  
  return (
    <div className={`rounded-3xl border p-6 backdrop-blur ${
      isDark ? 'border-white/10 bg-black/45' : 'border-slate-200 bg-white/80'
    }`} data-animate>
      <div className="mb-4">
        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
        {subtitle && <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>}
      </div>
      {players.length === 0 ? (
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>プレイヤー情報がまだ登録されていません。</p>
      ) : (
        <ul className="space-y-2">
          {players.slice(0, 6).map((player) => (
            <li
              key={player}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                isDark
                  ? 'border-white/5 bg-white/5 text-slate-100'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <span className="font-medium">{player}</span>
              <span className={`text-xs uppercase tracking-[0.3em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>player</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
