import { useState } from 'react'

type AiChatModalProps = {
  isOpen: boolean
  onClose: () => void
  selectedSegments: string[]
  issue?: string
  year?: number | 'ALL'
  onSubmit: (question: string) => Promise<{ answer: string }>
  theme?: 'light' | 'dark'
}

export function AiChatModal({
  isOpen,
  onClose,
  selectedSegments,
  issue,
  year,
  onSubmit,
  theme = 'dark'
}: AiChatModalProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isDark = theme === 'dark'

  const handleSubmit = async () => {
    if (!question.trim()) return

    setLoading(true)
    setAnswer(null)
    
    try {
      const result = await onSubmit(question)
      setAnswer(result.answer)
    } catch (error) {
      setAnswer('エラーが発生しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setQuestion('')
    setAnswer(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`mx-4 w-full max-w-3xl rounded-3xl border p-8 shadow-2xl ${
        isDark 
          ? 'border-white/10 bg-slate-900' 
          : 'border-slate-200 bg-white'
      }`}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>AIに質問</h2>
            <p className={`mt-1 text-sm ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {selectedSegments.length}件の市場について質問できます
            </p>
          </div>
          <button
            type="button"
            className={`btn btn-circle btn-ghost ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
            onClick={handleClose}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="mb-4 rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-slate-50'}">
          <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>対象市場</h3>
          <div className="flex flex-wrap gap-2">
            {selectedSegments.map(segment => (
              <span key={segment} className={`rounded-full px-3 py-1 text-xs ${
                isDark 
                  ? 'bg-brand/20 text-brand' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {segment}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className={`mb-2 block text-sm font-medium ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            質問内容
          </label>
          <textarea
            className={`textarea textarea-bordered w-full ${
              isDark 
                ? 'border-white/10 bg-black/60 text-slate-100' 
                : 'border-slate-300 bg-white text-slate-900'
            }`}
            rows={4}
            placeholder="例: これらの市場の共通点は何ですか？将来性はどうですか？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
        </div>

        {answer && (
          <div className={`mb-4 rounded-2xl border p-6 ${
            isDark 
              ? 'border-white/10 bg-black/40' 
              : 'border-slate-200 bg-slate-50'
          }`}>
            <h3 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <span className="material-symbols-rounded text-brand">auto_awesome</span>
              AIの回答
            </h3>
            <div className={`whitespace-pre-wrap text-sm leading-relaxed ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              {answer}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={handleClose}
            disabled={loading}
          >
            閉じる
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={handleSubmit}
            disabled={loading || !question.trim()}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <span className="material-symbols-rounded">send</span>
            )}
            {loading ? '考え中...' : '質問する'}
          </button>
        </div>
      </div>
    </div>
  )
}
