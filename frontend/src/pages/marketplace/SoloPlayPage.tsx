import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import type { Quiz, Question } from '../../types'
import { marketplaceAPI } from '../../lib/api'

type Phase = 'intro' | 'question' | 'revealed' | 'finished'

const ANSWER_COLORS = [
  {
    badge: 'bg-rose-500',
    idle: 'bg-rose-500/10 border border-rose-500/35 hover:bg-rose-500/18 hover:border-rose-500/55',
    selected: 'bg-rose-500/20 border-2 border-rose-400/80',
    correct: 'bg-emerald-500/20 border-2 border-emerald-400 shadow-emerald-500/20',
    wrong: 'bg-rose-500/15 border border-rose-400/40 opacity-60',
  },
  {
    badge: 'bg-blue-500',
    idle: 'bg-blue-500/10 border border-blue-500/35 hover:bg-blue-500/18 hover:border-blue-500/55',
    selected: 'bg-blue-500/20 border-2 border-blue-400/80',
    correct: 'bg-emerald-500/20 border-2 border-emerald-400 shadow-emerald-500/20',
    wrong: 'bg-blue-500/15 border border-blue-400/40 opacity-60',
  },
  {
    badge: 'bg-amber-500',
    idle: 'bg-amber-500/10 border border-amber-500/35 hover:bg-amber-500/18 hover:border-amber-500/55',
    selected: 'bg-amber-500/20 border-2 border-amber-400/80',
    correct: 'bg-emerald-500/20 border-2 border-emerald-400 shadow-emerald-500/20',
    wrong: 'bg-amber-500/15 border border-amber-400/40 opacity-60',
  },
  {
    badge: 'bg-emerald-500',
    idle: 'bg-emerald-500/10 border border-emerald-500/35 hover:bg-emerald-500/18 hover:border-emerald-500/55',
    selected: 'bg-emerald-500/20 border-2 border-emerald-400/80',
    correct: 'bg-emerald-500/20 border-2 border-emerald-400 shadow-emerald-500/20',
    wrong: 'bg-emerald-500/15 border border-emerald-400/40 opacity-60',
  },
]

export default function SoloPlayPage() {
  const { id: quizId } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const quiz = location.state?.quiz as Quiz | undefined

  const [phase, setPhase] = useState<Phase>('intro')
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [fillInput, setFillInput] = useState('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [correctAnswerID, setCorrectAnswerID] = useState<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeRemainingRef = useRef(0)

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  // Redirect if no quiz in state
  useEffect(() => {
    if (!quiz) navigate('/marketplace', { replace: true })
  }, [quiz, navigate])

  const currentQ: Question | undefined = quiz?.questions[qIndex]

  const revealWithAPI = useCallback(async (q: Question, answer: string, timeLeft: number) => {
    stopTimer()
    try {
      const result = await marketplaceAPI.checkAnswer(quizId!, q.id, answer)
      const pts = result.is_correct ? Math.max(50, Math.round(result.points * (timeLeft / q.time_limit))) : 0
      setIsCorrect(result.is_correct)
      setPointsEarned(pts)
      setCorrectAnswerID(result.correct_answer)
      if (result.is_correct) {
        setScore(s => s + pts)
        setCorrectCount(c => c + 1)
      }
    } catch {
      setIsCorrect(false)
      setPointsEarned(0)
      setCorrectAnswerID('')
    }
    setPhase('revealed')
  }, [quizId, stopTimer])

  const handleReveal = useCallback((answer: string, timeLeft: number) => {
    const q = quiz!.questions[qIndex]
    void revealWithAPI(q, answer, timeLeft)
  }, [quiz, qIndex, revealWithAPI])

  const startQuestion = useCallback((idx: number) => {
    const q = quiz!.questions[idx]
    setSelected(null)
    setFillInput('')
    setCorrectAnswerID('')
    setTimeRemaining(q.time_limit)
    timeRemainingRef.current = q.time_limit
    setPhase('question')
    timerRef.current = setInterval(() => {
      timeRemainingRef.current -= 1
      setTimeRemaining(timeRemainingRef.current)
      if (timeRemainingRef.current <= 0) {
        clearInterval(timerRef.current!)
        timerRef.current = null
        // Time's up — reveal with empty answer to get correct_answer from backend
        void revealWithAPI(q, '', 0)
      }
    }, 1000)
  }, [quiz, revealWithAPI])

  const handleNext = useCallback(() => {
    const total = quiz!.questions.length
    if (qIndex + 1 >= total) {
      setPhase('finished')
    } else {
      setQIndex(i => i + 1)
      startQuestion(qIndex + 1)
    }
  }, [quiz, qIndex, startQuestion])

  const handleSelectOption = (optId: string) => {
    if (phase !== 'question' || selected) return
    setSelected(optId)
    handleReveal(optId, timeRemainingRef.current)
  }

  const handleSubmitFill = () => {
    if (phase !== 'question' || !fillInput.trim()) return
    handleReveal(fillInput.trim(), timeRemainingRef.current)
  }

  const handleRestart = () => {
    stopTimer()
    setQIndex(0)
    setScore(0)
    setCorrectCount(0)
    setSelected(null)
    setFillInput('')
    setCorrectAnswerID('')
    setPhase('intro')
  }

  useEffect(() => () => stopTimer(), [stopTimer])

  if (!quiz) return null

  const total = quiz.questions.length
  const totalPossible = quiz.questions.reduce((s, q) => s + q.points, 0)
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-800 via-purple-900 to-indigo-950 text-white flex flex-col">
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-black/20 backdrop-blur-md border-b border-white/10 px-4 py-3 shrink-0">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            onClick={() => { stopTimer(); navigate(-1) }}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Practice</p>
            <p className="font-black text-sm text-white truncate max-w-[160px]">{quiz.title}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Score</p>
            <p className="font-black text-lg text-amber-300">{score.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl">

          {/* ── INTRO ── */}
          {phase === 'intro' && (
            <div className="text-center space-y-6 animate-scaleIn">
              <div className="w-24 h-24 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto backdrop-blur-sm">
                <svg className="w-12 h-12 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">{quiz.title}</h2>
                {quiz.description && (
                  <p className="text-white/50 text-sm">{quiz.description}</p>
                )}
                <p className="text-white/40 text-sm mt-2">
                  {total} question{total !== 1 ? 's' : ''} · Practice Mode
                </p>
              </div>
              <button
                onClick={() => startQuestion(0)}
                className="px-8 py-3.5 bg-white text-violet-700 font-black rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20 text-sm"
              >
                Start Practice →
              </button>
            </div>
          )}

          {/* ── QUESTION ── */}
          {phase === 'question' && currentQ && (
            <div className="space-y-4 animate-fadeInUp">
              {/* Progress */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-xs font-black">
                    {qIndex + 1}
                  </div>
                  <span className="text-white/50 text-sm">of {total}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-amber-300 font-bold text-sm">{currentQ.points} pts</span>
                </div>
              </div>

              {/* Timer bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white/40">
                  <span>Time</span>
                  <span className={clsx('font-bold', timeRemaining <= 5 ? 'text-rose-300' : 'text-white/60')}>{timeRemaining}s</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-1000',
                      timeRemaining > currentQ.time_limit * 0.5 ? 'bg-emerald-400' :
                      timeRemaining > currentQ.time_limit * 0.25 ? 'bg-amber-400' : 'bg-rose-400'
                    )}
                    style={{ width: `${(timeRemaining / currentQ.time_limit) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question card */}
              <div className="bg-white/8 backdrop-blur-sm rounded-3xl p-5 border border-white/15 shadow-xl space-y-4">
                {currentQ.image && (
                  <img src={currentQ.image} alt="question" className="w-full max-h-40 object-cover rounded-2xl" />
                )}
                <p className="text-white font-semibold text-base leading-snug">{currentQ.text}</p>

                {/* MC / image options */}
                {(currentQ.type === 'multiple_choice' || currentQ.type === 'image_based') && currentQ.options && (
                  <div className="grid grid-cols-2 gap-2">
                    {currentQ.options.map((opt, i) => {
                      const c = ANSWER_COLORS[i % ANSWER_COLORS.length]
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectOption(opt.id)}
                          disabled={!!selected}
                          className={clsx(
                            'flex items-center gap-2.5 px-3 py-3 rounded-2xl text-left transition-all active:scale-[0.97] text-sm font-semibold text-white',
                            c.idle,
                          )}
                        >
                          <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0', c.badge)}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="leading-snug">{opt.text}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* True / False */}
                {currentQ.type === 'true_false' && currentQ.options && (
                  <div className="flex gap-2">
                    {currentQ.options.map((opt, i) => {
                      const c = ANSWER_COLORS[i % ANSWER_COLORS.length]
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectOption(opt.id)}
                          disabled={!!selected}
                          className={clsx(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97]',
                            c.idle,
                          )}
                        >
                          <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0', c.badge)}>
                            {i === 0 ? '✓' : '✗'}
                          </span>
                          {opt.text}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Fill in the blank */}
                {currentQ.type === 'fill_blank' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fillInput}
                      onChange={e => setFillInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmitFill()}
                      placeholder="Type your answer…"
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
                      autoFocus
                    />
                    <button
                      onClick={handleSubmitFill}
                      disabled={!fillInput.trim()}
                      className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-2xl text-sm font-bold text-white transition-colors"
                    >
                      Submit
                    </button>
                  </div>
                )}

                {/* Match pair – auto-reveal */}
                {currentQ.type === 'match_pair' && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs">Matching question — auto-scoring in practice mode</p>
                    <div className="grid grid-cols-2 gap-2">
                      {currentQ.match_pairs?.map((pair, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="px-3 py-2 bg-violet-500/20 border border-violet-400/30 rounded-xl text-xs text-violet-200">{pair.left}</div>
                          <div className="px-3 py-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-xs text-indigo-200">{pair.right}</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        stopTimer()
                        // Build the expected answer and verify via API
                        const expectedAnswer = currentQ.match_pairs?.map(p => p.right).join('|') ?? ''
                        void revealWithAPI(currentQ, expectedAnswer, timeRemainingRef.current)
                      }}
                      className="w-full py-3 bg-white/10 border border-white/20 rounded-2xl text-sm font-semibold text-white/70 hover:bg-white/15 transition-colors"
                    >
                      Got it — Next →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── REVEALED ── */}
          {phase === 'revealed' && currentQ && (
            <div className="space-y-4 animate-fadeInUp">
              {/* Result icon */}
              <div className="text-center space-y-2">
                <div className={clsx(
                  'w-20 h-20 rounded-3xl flex items-center justify-center mx-auto',
                  isCorrect ? 'bg-emerald-500/20 border border-emerald-400/30' : 'bg-rose-500/20 border border-rose-400/30',
                )}>
                  {isCorrect ? (
                    <svg className="w-10 h-10 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <p className="text-2xl font-black text-white">{isCorrect ? 'Correct!' : timeRemaining === 0 ? "Time's Up!" : 'Wrong!'}</p>
                {pointsEarned > 0 && (
                  <p className="text-3xl font-black text-amber-300">+{pointsEarned}</p>
                )}
              </div>

              {/* Show correct answer for MC/TF */}
              {(currentQ.type === 'multiple_choice' || currentQ.type === 'image_based' || currentQ.type === 'true_false') && currentQ.options && (
                <div className="bg-white/8 rounded-2xl p-4 border border-white/10 space-y-2">
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">Answer Review</p>
                  <div className={clsx('grid gap-1.5', currentQ.type === 'true_false' ? 'grid-cols-2' : 'grid-cols-2')}>
                    {currentQ.options.map((opt, i) => {
                      const c = ANSWER_COLORS[i % ANSWER_COLORS.length]
                      const isRight = opt.id === correctAnswerID
                      const wasSelected = selected === opt.id
                      return (
                        <div
                          key={opt.id}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                            isRight ? c.correct :
                            wasSelected ? c.wrong :
                            'bg-white/5 border border-white/8 opacity-40',
                          )}
                        >
                          <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0', c.badge)}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-white leading-snug">{opt.text}</span>
                          {isRight && (
                            <svg className="w-4 h-4 text-emerald-300 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Correct answer for fill blank */}
              {currentQ.type === 'fill_blank' && !isCorrect && correctAnswerID && (
                <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-2xl px-4 py-3">
                  <p className="text-xs text-white/40 mb-1">Correct answer</p>
                  <p className="text-emerald-300 font-bold">{correctAnswerID}</p>
                </div>
              )}

              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-1.5 py-1">
                {quiz.questions.map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'h-1.5 rounded-full transition-all',
                      i < qIndex ? 'w-3 bg-white/40' :
                      i === qIndex ? 'w-5 bg-violet-400' :
                      'w-3 bg-white/15',
                    )}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="w-full py-4 bg-white text-violet-700 font-black rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2"
              >
                {qIndex + 1 >= total ? 'See Results' : 'Next Question'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* ── FINISHED ── */}
          {phase === 'finished' && (
            <div className="text-center space-y-6 animate-fadeInUp">
              <div className="text-5xl">🎊</div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white">Practice Complete!</h2>
                <p className="text-white/50 text-sm">{quiz.title}</p>
              </div>

              {/* Score card */}
              <div className="bg-white/8 border border-white/15 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Score</p>
                    <p className="text-4xl font-black text-amber-300">{score.toLocaleString()}</p>
                    <p className="text-white/30 text-xs">of {totalPossible}</p>
                  </div>
                  <div className="w-px h-12 bg-white/10" />
                  <div className="text-center">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Correct</p>
                    <p className="text-4xl font-black text-white">{correctCount}/{total}</p>
                    <p className="text-white/30 text-xs">{pct}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Grade label */}
                <p className="text-white/60 text-sm font-semibold">
                  {pct >= 90 ? '🌟 Excellent!' : pct >= 70 ? '👍 Good job!' : pct >= 50 ? '💪 Keep practising!' : '📚 Review and try again!'}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRestart}
                  className="w-full py-3.5 bg-white text-violet-700 font-bold rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="w-full py-3 bg-white/10 text-white font-semibold rounded-2xl hover:bg-white/20 active:scale-[0.98] transition-all border border-white/20"
                >
                  Back to Marketplace
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
