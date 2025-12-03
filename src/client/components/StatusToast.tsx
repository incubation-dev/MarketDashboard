type StatusToastProps = {
  message: string | null
  type: 'success' | 'error'
  onClose: () => void
}

export function StatusToast({ message, type, onClose }: StatusToastProps): JSX.Element | null {
  if (!message) return null

  const tone =
    type === 'success'
      ? 'border-brand/40 bg-brand/20 text-white'
      : 'border-red-400/40 bg-red-500/15 text-red-100'

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${tone}`}>
        <span className="text-sm font-medium leading-tight">{message}</span>
        <button
          type="button"
          className="btn btn-xs btn-circle border-none bg-white/20 text-white hover:bg-white/40"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  )
}
