import { useState, useEffect } from 'react'
import type { Question } from '../../types'
import { quizAPI, paymentAPI, type PlanType } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import clsx from 'clsx'

type Phase = 'form' | 'loading' | 'preview'
type Difficulty = 'easy' | 'medium' | 'hard'
type AIType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'reflection'

interface AIGenerateModalProps {
  onAdd: (questions: Question[]) => void
  onClose: () => void
}

const TYPE_LABELS: Record<AIType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True or False',
  fill_blank: 'Fill in the Blank',
  reflection: 'Reflection / Open-ended',
}

const TYPE_COLORS: Record<AIType, string> = {
  multiple_choice: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  true_false: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  fill_blank: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  reflection: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

// Inline-editable card for a single preview question
function PreviewCard({
  q,
  index,
  onUpdate,
  onDelete,
}: {
  q: Question
  index: number
  onUpdate: (q: Question) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [editText, setEditText] = useState(q.text)
  const [editOptions, setEditOptions] = useState(q.options?.map(o => ({ ...o })) ?? [])
  const [editAnswer, setEditAnswer] = useState(q.answer ?? '')

  const typeColor = TYPE_COLORS[q.type as AIType] ?? 'bg-white/10 text-white/40 border-white/20'

  const saveEdit = () => {
    onUpdate({
      ...q,
      text: editText.trim() || q.text,
      options: q.options ? editOptions : undefined,
      answer: q.type === 'fill_blank' ? editAnswer : q.answer,
    })
    setEditing(false)
  }

  const setCorrectOption = (optId: string) => {
    setEditOptions(prev => prev.map(o => ({ ...o, is_right: o.id === optId })))
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-black text-white/50">
            {index + 1}
          </span>
          <span className={clsx('px-2 py-0.5 rounded-full border text-[10px] font-bold', typeColor)}>
            {TYPE_LABELS[q.type as AIType] ?? q.type}
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-[10px] font-semibold">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            AI
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/12 text-white/50 hover:text-white/80 text-xs font-semibold transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-400/60 hover:text-rose-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {editing ? (
          /* ── Edit mode ── */
          <div className="space-y-3">
            <div>
              <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1 block">
                Question text
              </label>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
              />
            </div>

            {/* MC / TF option editor */}
            {(q.type === 'multiple_choice' || q.type === 'true_false') && editOptions.length > 0 && (
              <div>
                <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">
                  Options — select the correct answer
                </label>
                <div className="space-y-1.5">
                  {editOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectOption(opt.id)}
                        className={clsx(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                          opt.is_right
                            ? 'border-emerald-400 bg-emerald-500/20'
                            : 'border-white/20 bg-transparent hover:border-white/40',
                        )}
                      >
                        {opt.is_right && (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                      <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {q.type === 'true_false' ? (
                        <span className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 text-sm">
                          {opt.text}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={opt.text}
                          onChange={e => {
                            const updated = [...editOptions]
                            updated[i] = { ...updated[i], text: e.target.value }
                            setEditOptions(updated)
                          }}
                          className="flex-1 px-3 py-1.5 bg-white/8 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/40"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fill blank answer editor */}
            {q.type === 'fill_blank' && (
              <div>
                <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1 block">
                  Correct answer
                </label>
                <input
                  type="text"
                  value={editAnswer}
                  onChange={e => setEditAnswer(e.target.value)}
                  className="w-full px-3 py-2 bg-white/8 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Save changes
              </button>
              <button
                onClick={() => {
                  setEditText(q.text)
                  setEditOptions(q.options?.map(o => ({ ...o })) ?? [])
                  setEditAnswer(q.answer ?? '')
                  setEditing(false)
                }}
                className="px-4 py-2 bg-white/8 hover:bg-white/12 text-white/50 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            <p className="text-white text-sm font-medium leading-snug">{q.text}</p>

            {/* MC / TF options (read-only) */}
            {(q.type === 'multiple_choice' || q.type === 'true_false') && q.options && (
              <div className={clsx('grid gap-1.5', q.type === 'true_false' ? 'grid-cols-2' : 'grid-cols-2')}>
                {q.options.map((opt, i) => (
                  <div
                    key={opt.id}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border',
                      opt.is_right
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-white/40',
                    )}
                  >
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="truncate">{opt.text}</span>
                    {opt.is_right && (
                      <svg className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* fill_blank correct answer */}
            {q.type === 'fill_blank' && q.answer && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-400/20 rounded-xl">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-200 text-xs font-semibold">{q.answer}</span>
              </div>
            )}

            {/* reflection */}
            {q.type === 'reflection' && (
              <p className="text-white/30 text-xs italic">Open-ended — no graded answer</p>
            )}

            {/* Explanation (collapsible) */}
            {q.explanation && (
              <div>
                <button
                  onClick={() => setShowExplanation(v => !v)}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white/60 text-xs font-semibold transition-colors"
                >
                  <svg
                    className={clsx('w-3 h-3 transition-transform', showExplanation ? 'rotate-90' : '')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                  Explanation
                </button>
                {showExplanation && (
                  <p className="mt-1.5 text-white/50 text-xs leading-relaxed pl-4 border-l border-white/10">
                    {q.explanation}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-[10px] text-white/25">
              <span>{q.points} pts</span>
              <span>·</span>
              <span>{q.time_limit}s</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AIGenerateModal({ onAdd, onClose }: AIGenerateModalProps) {
  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState('')

  // Form state
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [qType, setQType] = useState<AIType>('multiple_choice')
  const [count, setCount] = useState(5)
  const [context, setContext] = useState('')

  // Preview state
  const [questions, setQuestions] = useState<Question[]>([])

  // AI quota state
  const [aiUsage, setAIUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [isUpgradingAI, setIsUpgradingAI] = useState(false)

  useEffect(() => {
    quizAPI.getAIUsage().then(setAIUsage).catch(() => {})
  }, [])

  const handleAIUpgrade = async (planType: PlanType) => {
    setIsUpgradingAI(true)
    try {
      if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
          document.head.appendChild(script)
        })
      }
      const order = await paymentAPI.createOrder(planType)
      await new Promise<void>((resolve, reject) => {
        const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay
        const rzp = new RazorpayConstructor({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: 'PAE',
          description: order.description,
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const result = await paymentAPI.verifyPayment({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_type: planType,
              })
              localStorage.setItem('auth_token', result.token)
              await useAuthStore.getState().loadUser()
              // Refresh usage count
              quizAPI.getAIUsage().then(setAIUsage).catch(() => {})
              setUpgradeRequired(false)
              resolve()
            } catch (e) { reject(e) }
          },
          modal: { ondismiss: () => reject(new Error('cancelled')) },
          theme: { color: '#7c3aed' },
        })
        rzp.open()
      })
    } catch (err: unknown) {
      if ((err as Error).message !== 'cancelled') console.error('AI upgrade failed:', err)
    } finally {
      setIsUpgradingAI(false)
    }
  }

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic.')
      return
    }
    setError('')
    setPhase('loading')
    try {
      const result = await quizAPI.generateWithAI({
        topic: topic.trim(),
        difficulty,
        type: qType,
        count,
        context: context.trim() || undefined,
      })
      setQuestions(result)
      setPhase('preview')
      // Refresh quota count after a successful generation
      quizAPI.getAIUsage().then(setAIUsage).catch(() => {})
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        setUpgradeRequired(true)
        setAIUsage(prev => prev ? { ...prev, remaining: 0, used: prev.limit } : null)
        setPhase('form')
        return
      }
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Generation failed. Check your API key or try again.')
      setPhase('form')
    }
  }

  const updateQuestion = (index: number, updated: Question) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? updated : q)))
  }

  const deleteQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-gray-900 border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-black text-sm">Generate with AI</h2>
              <p className="text-white/35 text-[10px]">Powered by Gemini 1.5 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── FORM ── */}
          {phase === 'form' && (
            <div className="p-5 space-y-4">
              {/* Topic */}
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1.5 block">
                  Topic or subject <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="e.g. Photosynthesis, World War II, Algebra…"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
                  autoFocus
                />
              </div>

              {/* Row: Difficulty + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs font-semibold mb-1.5 block">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as Difficulty)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-2xl text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
                  >
                    <option className="bg-gray-900" value="easy">Easy</option>
                    <option className="bg-gray-900" value="medium">Medium</option>
                    <option className="bg-gray-900" value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-xs font-semibold mb-1.5 block">Question type</label>
                  <select
                    value={qType}
                    onChange={e => setQType(e.target.value as AIType)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-2xl text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
                  >
                    {(Object.entries(TYPE_LABELS) as [AIType, string][]).map(([v, l]) => (
                      <option className="bg-gray-900" key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Count */}
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1.5 flex items-center justify-between">
                  <span>Number of questions</span>
                  <span className="text-violet-400 font-black">{count}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-white/25 mt-0.5">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="text-white/60 text-xs font-semibold mb-1.5 flex items-center justify-between">
                  <span>Additional context</span>
                  <span className="text-white/25 font-normal">optional</span>
                </label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  rows={3}
                  placeholder="Paste learning material, notes, or any extra context…"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all resize-none"
                />
              </div>

              {error && (
                <p className="text-rose-300 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {/* AI usage indicator */}
              {aiUsage !== null && (
                <div className={clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold',
                  aiUsage.remaining > 0
                    ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300',
                )}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {aiUsage.remaining > 0
                    ? <span>{aiUsage.remaining} of {aiUsage.limit} free generation{aiUsage.remaining !== 1 ? 's' : ''} remaining</span>
                    : <span>Free quota exhausted — upgrade to generate more</span>
                  }
                  <div className="ml-auto flex gap-1">
                    {Array.from({ length: aiUsage.limit }).map((_, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'w-2 h-2 rounded-full',
                          i < aiUsage.used ? 'bg-current opacity-80' : 'bg-white/15',
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LOADING ── */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-violet-400 animate-spin" />
                <div className="absolute inset-2 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">Generating questions…</p>
                <p className="text-white/35 text-xs mt-1">Gemini 1.5 Flash is thinking</p>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {phase === 'preview' && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/50 text-xs">
                  <span className="text-white font-bold">{questions.length}</span> question{questions.length !== 1 ? 's' : ''} generated
                </p>
                <button
                  onClick={() => { setPhase('form'); setError('') }}
                  className="text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
              </div>

              {questions.length === 0 ? (
                <div className="py-10 text-center text-white/30 text-sm">
                  All questions deleted. Click Regenerate to try again.
                </div>
              ) : (
                questions.map((q, i) => (
                  <PreviewCard
                    key={q.id}
                    q={q}
                    index={i}
                    onUpdate={updated => updateQuestion(i, updated)}
                    onDelete={() => deleteQuestion(i)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          {phase === 'form' && (upgradeRequired || (aiUsage !== null && aiUsage.remaining === 0)) ? (
            <div className="space-y-2">
              <p className="text-xs text-white/40 text-center mb-1">AI quota exhausted — buy more generations</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAIUpgrade('ai_10')}
                  disabled={isUpgradingAI}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isUpgradingAI && <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  +10 gens — ₹49
                </button>
                <button
                  onClick={() => handleAIUpgrade('ai_20')}
                  disabled={isUpgradingAI}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isUpgradingAI && <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  +20 gens — ₹79
                </button>
              </div>
            </div>
          ) : phase === 'form' ? (
            <button
              onClick={handleGenerate}
              disabled={!topic.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 text-white font-black rounded-2xl transition-all text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Generate {count} Question{count !== 1 ? 's' : ''}
            </button>
          ) : null}
          {phase === 'preview' && (
            <button
              onClick={() => { if (questions.length > 0) { onAdd(questions); onClose() } }}
              disabled={questions.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-40 text-white font-black rounded-2xl transition-all text-sm shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add {questions.length} Question{questions.length !== 1 ? 's' : ''} to Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
