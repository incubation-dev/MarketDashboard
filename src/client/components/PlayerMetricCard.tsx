type PlayerMetricCardProps = {
  title: string
  subtitle?: string
  players: string[]
}

export function PlayerMetricCard({ title, subtitle, players }: PlayerMetricCardProps): JSX.Element {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur" data-animate>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>}
      </div>
      {players.length === 0 ? (
        <p className="text-sm text-slate-400">プレイヤー情報がまだ登録されていません。</p>
      ) : (
        <ul className="space-y-2">
          {players.slice(0, 6).map((player) => (
            <li
              key={player}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-100"
            >
              <span className="font-medium">{player}</span>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">player</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
