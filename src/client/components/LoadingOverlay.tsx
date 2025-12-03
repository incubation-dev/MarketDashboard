type LoadingOverlayProps = {
  text?: string
}

export function LoadingOverlay({ text = '更新中...' }: LoadingOverlayProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/70 px-6 py-4 text-slate-100 shadow-soft">
        <span className="loading loading-spinner loading-md text-primary" aria-hidden="true" />
        <span className="text-sm font-medium tracking-wide">{text}</span>
      </div>
    </div>
  )
}
