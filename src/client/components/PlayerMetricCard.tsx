type Player = {
  name: string
  share: number
}

type PlayerMetricCardProps = {
  title: string
  players: Player[]
}

export function PlayerMetricCard({ title, players }: PlayerMetricCardProps): JSX.Element {
  return (
    <div className="rounded-3xl border border-white/5 bg-base-200/50 p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-brand/80">Top Players</span>
      </div>
      <ul className="space-y-3">
        {players.map((player) => (
          <li
            key={player.name}
            className="flex items-center justify-between rounded-2xl border border-white/5 bg-base-300/40 px-4 py-3"
          >
            <span className="font-medium text-slate-100">{player.name}</span>
            <span className="text-sm text-slate-300">{player.share.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
