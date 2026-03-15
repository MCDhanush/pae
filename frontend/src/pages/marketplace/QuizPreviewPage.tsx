import { useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import gsap from 'gsap'
import clsx from 'clsx'
import type { Quiz, Question } from '../../types'
import PAELogo from '../../components/ui/PAELogo'

const PREVIEW_LIMIT = 4

const CATEGORY_COLORS: Record<string, string> = {
  Science: 'from-emerald-500 to-teal-600',
  Math: 'from-blue-500 to-indigo-600',
  History: 'from-amber-500 to-orange-600',
  Language: 'from-violet-500 to-purple-600',
  Geography: 'from-cyan-500 to-sky-600',
  Technology: 'from-rose-500 to-pink-600',
  Arts: 'from-fuchsia-500 to-pink-600',
  Other: 'from-gray-500 to-slate-600',
}

function getCategoryGradient(cat?: string) {
  if (!cat) return 'from-violet-500 to-indigo-600'
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  image_based: 'Image-Based',
  true_false: 'True / False',
  match_pair: 'Match Pairs',
  fill_blank: 'Fill in the Blank',
}

// Read-only preview of a single question
function QuestionPreview({ q, index }: { q: Question; index: number }) {
  const type = TYPE_LABELS[q.type] ?? q.type

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black text-white/60">
            {index + 1}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/40 text-[10px] font-semibold">
            {type}
          </span>
        </div>
        <span className="text-[10px] text-white/30">{q.points} pts · {q.time_limit}s</span>
      </div>

      {/* Question text */}
      <p className="text-white text-sm font-medium leading-snug">{q.text}</p>

      {/* Image */}
      {q.image && (
        <img
          src={q.image}
          alt="question"
          className="w-full max-h-32 object-cover rounded-xl opacity-70"
        />
      )}

      {/* Options preview (greyed out, non-interactive) */}
      {(q.type === 'multiple_choice' || q.type === 'image_based') && q.options && (
        <div className="grid grid-cols-2 gap-1.5 pointer-events-none select-none">
          {q.options.map((opt, i) => (
            <div
              key={opt.id}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl opacity-60"
            >
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50 shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-white/50 text-xs truncate">{opt.text}</span>
            </div>
          ))}
        </div>
      )}

      {q.type === 'true_false' && (
        <div className="flex gap-2 pointer-events-none select-none">
          {['True', 'False'].map(v => (
            <div
              key={v}
              className="flex-1 py-2 text-center text-xs font-semibold text-white/40 bg-white/5 border border-white/10 rounded-xl opacity-60"
            >
              {v}
            </div>
          ))}
        </div>
      )}

      {q.type === 'match_pair' && (
        <p className="text-white/30 text-xs italic">Drag-and-drop matching question</p>
      )}

      {q.type === 'fill_blank' && (
        <div className="h-8 bg-white/5 border border-white/10 rounded-xl opacity-50" />
      )}
    </div>
  )
}

export default function QuizPreviewPage() {
  const { id: _id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  // Quiz is passed via navigation state from MarketplacePage
  const quiz = location.state?.quiz as Quiz | undefined

  useEffect(() => {
    if (!quiz) {
      // No quiz in state — go back to marketplace
      navigate('/marketplace', { replace: true })
      return
    }
    const ctx = gsap.context(() => {
      gsap.from('.preview-item', {
        opacity: 0, y: 20, duration: 0.4, stagger: 0.07, ease: 'power2.out', clearProps: 'all',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [quiz, navigate])

  if (!quiz) return null

  const previewQuestions = quiz.questions.slice(0, PREVIEW_LIMIT)
  const hiddenCount = Math.max(0, quiz.questions.length - PREVIEW_LIMIT)
  const gradient = getCategoryGradient(quiz.category)

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white"
    >
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-8%] left-[-4%] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link to="/marketplace">
            <PAELogo variant="dark" size="sm" />
          </Link>
          <span className="text-white/30 text-sm hidden sm:block">/ Quiz Preview</span>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Quiz hero card */}
        <div className="preview-item bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                {quiz.category && (
                  <span className={clsx('inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r text-white mb-2', gradient)}>
                    {quiz.category}
                  </span>
                )}
                <h1 className="text-xl font-black text-white leading-snug">{quiz.title}</h1>
                {quiz.description && (
                  <p className="text-white/40 text-sm mt-1">{quiz.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30">
              <span>{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
              {quiz.teacher_name && (
                <>
                  <span className="text-white/15">·</span>
                  <span>by {quiz.teacher_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Preview banner */}
        <div className="preview-item flex items-center gap-3 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl">
          <svg className="w-4 h-4 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p className="text-amber-200/80 text-xs">
            Showing <span className="font-bold text-amber-300">{previewQuestions.length}</span> of{' '}
            <span className="font-bold text-amber-300">{quiz.questions.length}</span> questions.
            {hiddenCount > 0 && ' Join a live game to answer them all!'}
          </p>
        </div>

        {/* Visible questions */}
        {previewQuestions.map((q, i) => (
          <div key={q.id} className="preview-item">
            <QuestionPreview q={q} index={i} />
          </div>
        ))}

        {/* Locked questions */}
        {hiddenCount > 0 && (
          <div className="preview-item space-y-2">
            {/* Partially visible locked tiles */}
            {Array.from({ length: Math.min(hiddenCount, 3) }).map((_, i) => (
              <div
                key={i}
                className="bg-white/3 border border-white/8 rounded-2xl p-4 flex items-center justify-between opacity-50"
                style={{ filter: 'blur(1.5px)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black text-white/40">
                    {PREVIEW_LIMIT + i + 1}
                  </span>
                  <div className="w-40 h-3 bg-white/10 rounded-full" />
                </div>
                <div className="w-16 h-3 bg-white/10 rounded-full" />
              </div>
            ))}

            {/* Locked overlay card */}
            <div className="relative bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-white/70 font-bold text-sm mb-1">
                +{hiddenCount} more question{hiddenCount !== 1 ? 's' : ''} locked
              </p>
              <p className="text-white/35 text-xs mb-4">
                Ask your teacher to host a game session. Enter the PIN to play and answer all questions!
              </p>
              <button
                onClick={() => navigate('/join')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Join a Game
              </button>
            </div>
          </div>
        )}

        {/* Bottom CTA if all questions are visible (≤ PREVIEW_LIMIT) */}
        {hiddenCount === 0 && (
          <div className="preview-item bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
            <p className="text-white/40 text-sm mb-3">
              Ready to answer? Ask your teacher to start a game session!
            </p>
            <button
              onClick={() => navigate('/join')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Join a Game
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
