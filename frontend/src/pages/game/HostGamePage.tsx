import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { gameAPI, sessionAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import { useAuthStore } from '../../store/authStore'
import {
  connectMQTT,
  disconnectMQTT,
  getMQTT,
  MQTT_EVENTS,
  removeAllMQTTListeners,
} from '../../mqtt'
import type {
  QuestionStartPayload,
  QuestionEndPayload,
  LeaderboardPayload,
  GameEndPayload,
  AnswerDistributionPayload,
} from '../../mqtt'
import type { Player } from '../../types'

type GamePhase = 'lobby' | 'question' | 'question_end' | 'game_over'

const OPTION_COLORS = [
  'from-red-500 to-rose-600',
  'from-blue-500 to-indigo-600',
  'from-amber-500 to-yellow-600',
  'from-emerald-500 to-green-600',
]
const OPTION_BG = ['bg-red-500/20 border-red-500/40', 'bg-blue-500/20 border-blue-500/40', 'bg-amber-500/20 border-amber-500/40', 'bg-emerald-500/20 border-emerald-500/40']
const OPTION_LABELS = ['A', 'B', 'C', 'D']
const RANK_MEDAL_COLORS = ['text-amber-400', 'text-slate-400', 'text-amber-700']
function MedalIcon({ rank, size = 'sm' }: { rank: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <svg className={`${sz} ${RANK_MEDAL_COLORS[rank]}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l3.057-3 3.943 7.9L15.943 0 19 3l-2 8H7L5 3zm2 9h10l1 9H6l1-9z" />
    </svg>
  )
}

export default function HostGamePage() {
  const { pin } = useParams<{ pin: string }>()
  const navigate = useNavigate()
  useAuthStore()
  const {
    session, setSession,
    players, setPlayers, addPlayer,
    currentQuestion, setCurrentQuestion,
    timeRemaining, setTimeRemaining,
    leaderboard, updateLeaderboard,
    reset,
  } = useGameStore()

  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [isNexting, setIsNexting] = useState(false)
  const [answerDist, setAnswerDist] = useState<Record<string, number>>({})
  const [distTotal, setDistTotal] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback((seconds: number) => {
    stopTimer()
    setTimeRemaining(seconds)
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { stopTimer(); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [stopTimer, setTimeRemaining])

  useEffect(() => {
    if (!pin) return
    let mounted = true

    const init = async () => {
      try {
        const sess = await gameAPI.getByPIN(pin)
        const playerList = await sessionAPI.getPlayers(sess.id).catch(() => [] as Player[])
        if (!mounted) return
        setSession(sess)
        setPlayers(playerList)

        if (sess.status === 'finished') {
          setPhase('game_over')
          const lb = await gameAPI.getLeaderboard(sess.id)
          updateLeaderboard(lb)
        } else if (sess.status === 'active') {
          setPhase('question')
        }

        const mqttClient = connectMQTT(pin)

        mqttClient.on(MQTT_EVENTS.PLAYER_JOINED, (p: unknown) => {
          if (!mounted) return
          addPlayer(p as Player)
        })

        mqttClient.on(MQTT_EVENTS.QUESTION_START, (p: unknown) => {
          if (!mounted) return
          const payload = p as QuestionStartPayload
          setCurrentQuestion(payload.question)
          setQuestionIndex(payload.question_index)
          setTotalQuestions(payload.total_questions)
          setCorrectAnswer(null)
          setAnswerDist({})
          setDistTotal(0)
          setPhase('question')
          startTimer(payload.question.time_limit)
        })

        mqttClient.on(MQTT_EVENTS.ANSWER_DISTRIBUTION, (p: unknown) => {
          if (!mounted) return
          const payload = p as AnswerDistributionPayload
          setAnswerDist(payload.distribution ?? {})
          setDistTotal(payload.total_answers ?? 0)
        })

        mqttClient.on(MQTT_EVENTS.QUESTION_END, (p: unknown) => {
          if (!mounted) return
          stopTimer()
          setCorrectAnswer((p as QuestionEndPayload).correct_answer)
          setPhase('question_end')
        })

        mqttClient.on(MQTT_EVENTS.LEADERBOARD_UPDATE, (p: unknown) => {
          if (!mounted) return
          updateLeaderboard((p as LeaderboardPayload).entries)
        })

        mqttClient.on(MQTT_EVENTS.GAME_ENDED, (p: unknown) => {
          if (!mounted) return
          stopTimer()
          updateLeaderboard((p as GameEndPayload).final_leaderboard)
          setPhase('game_over')
        })
      } catch (err) {
        console.error('Failed to initialize host game:', err)
      }
    }

    init()

    return () => {
      mounted = false
      stopTimer()
      removeAllMQTTListeners()
      disconnectMQTT()
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const handleStartGame = async () => {
    if (!session) return
    setIsStarting(true)
    try {
      await gameAPI.start(session.pin)
    } catch (err) {
      console.error('Failed to start game:', err)
    } finally {
      setIsStarting(false)
    }
  }

  const handleNextQuestion = async () => {
    if (!session) return
    setIsNexting(true)
    setCorrectAnswer(null)
    try {
      await gameAPI.next(session.pin)
    } catch (err) {
      console.error('Failed to advance question:', err)
    } finally {
      setIsNexting(false)
    }
  }

  const handleEndGame = async () => {
    if (!session) return
    setIsEnding(true)
    try {
      await gameAPI.end(session.pin)
    } catch (err) {
      console.error('Failed to end game:', err)
    } finally {
      setIsEnding(false)
    }
  }

  const mqttClient = getMQTT()
  const isConnected = mqttClient?.connected ?? false
  const timerPct = currentQuestion ? (timeRemaining / currentQuestion.time_limit) * 100 : 0
  const timerColor = timerPct > 50 ? '#22c55e' : timerPct > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="animate-blobFloat absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-purple-600/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Back + connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-colors ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs text-white/50 hidden sm:block">{isConnected ? 'Live' : 'Connecting…'}</span>
            </div>
          </div>

          {/* PIN display */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 uppercase tracking-wider">PIN</span>
            <span className="text-2xl font-black tracking-[0.3em] text-violet-300">{pin}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {phase === 'lobby' && (
              <span className="text-xs text-white/40 mr-2">
                {players.length} player{players.length !== 1 ? 's' : ''}
              </span>
            )}
            {phase !== 'game_over' && (
              <button
                onClick={handleEndGame}
                disabled={isEnding}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-xs font-semibold hover:bg-red-500/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isEnding ? (
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12H9m12 0l-4-4m4 4l-4 4M3 5v14" />
                  </svg>
                )}
                {isEnding ? 'Ending…' : 'End Session'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <div className="animate-fadeInUp flex flex-col items-center gap-8 py-4">
            {/* PIN card + QR code */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* PIN */}
              <div className="text-center">
                <p className="text-white/50 text-sm mb-4 uppercase tracking-widest font-medium">Share this PIN</p>
                <div className="inline-flex flex-col items-center gap-3 bg-white/5 backdrop-blur-sm border border-white/15 rounded-3xl px-10 py-8 shadow-2xl">
                  <div className="text-4xl font-black tracking-[0.3em] text-white select-all" style={{ textShadow: '0 0 40px rgba(139,92,246,0.5)' }}>
                    {pin}
                  </div>
                  <div className="h-px w-full bg-white/10" />
                  <p className="text-white/40 text-xs">
                    Go to <span className="text-violet-300 font-semibold">join</span> page
                  </p>
                  {/* Copy link */}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join?pin=${pin}`).then(() => alert('Link copied!'))}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors px-3 py-1.5 bg-white/5 rounded-lg hover:bg-white/10"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Join Link
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:flex flex-col items-center gap-2">
                <div className="w-px h-16 bg-white/10" />
                <span className="text-white/30 text-xs font-medium">OR</span>
                <div className="w-px h-16 bg-white/10" />
              </div>
              <div className="sm:hidden h-px w-24 bg-white/10 my-1" />

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-white/50 text-sm uppercase tracking-widest font-medium">Scan to Join</p>
                <div className="p-4 bg-white rounded-2xl shadow-2xl">
                  <QRCodeSVG
                    value={`${window.location.origin}/join?pin=${pin}`}
                    size={140}
                    bgColor="white"
                    fgColor="#1e1b4b"
                    level="M"
                  />
                </div>
                <p className="text-white/30 text-xs">Point your camera at the code</p>
              </div>
            </div>

            {/* Player list */}
            <div className="w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                  Players Joined
                </h3>
                <span className="px-3 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full text-violet-300 text-xs font-bold">
                  {players.length}
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                {players.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-white/30 text-sm">Waiting for players to join…</p>
                    <div className="flex justify-center gap-1 mt-3">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                    {players.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {p.nickname.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white/90">{p.nickname}</span>
                        <span className="ml-auto text-xs text-white/30">#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartGame}
              disabled={isStarting || players.length === 0}
              className="px-10 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-black text-lg shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting…
                </>
              ) : players.length === 0 ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Waiting for players…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Game · {players.length} player{players.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        )}

        {/* ── QUESTION / QUESTION_END ── */}
        {(phase === 'question' || phase === 'question_end') && currentQuestion && (
          <div className="animate-fadeInUp grid lg:grid-cols-4 gap-5">
            {/* Main area */}
            <div className="lg:col-span-3 space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-white/50 text-xs">Question</span>
                  <span className="text-white font-bold text-sm">{questionIndex + 1}</span>
                  <span className="text-white/30 text-xs">/</span>
                  <span className="text-white/50 text-xs">{totalQuestions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">{currentQuestion.points} pts</span>
                  {phase === 'question' && (
                    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-sm"
                      style={{ borderColor: timerColor, color: timerColor }}>
                      {timeRemaining}
                    </div>
                  )}
                </div>
              </div>

              {/* Timer bar */}
              {phase === 'question' && (
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
                  />
                </div>
              )}

              {/* Question card */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                {currentQuestion.image && (
                  <img src={currentQuestion.image} alt="Question" className="w-full max-h-52 object-contain rounded-xl mb-4" />
                )}
                <h2 className="text-xl font-bold text-white text-center mb-6 leading-snug">
                  {currentQuestion.text}
                </h2>

                {/* Multiple choice / image based */}
                {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'image_based') && currentQuestion.options && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentQuestion.options.map((opt, i) => {
                      const isCorrect = phase === 'question_end' && correctAnswer === opt.id
                      const isWrong = phase === 'question_end' && correctAnswer !== opt.id
                      return (
                        <div
                          key={opt.id}
                          className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all ${
                            isCorrect
                              ? 'bg-emerald-500/25 border-emerald-400/50 ring-2 ring-emerald-400/40'
                              : isWrong
                              ? `${OPTION_BG[i % 4]} opacity-40`
                              : OPTION_BG[i % 4]
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${OPTION_COLORS[i % 4]} flex items-center justify-center font-bold text-sm shrink-0 text-white`}>
                            {OPTION_LABELS[i]}
                          </div>
                          <span className="flex-1 text-sm font-medium text-white/90">{opt.text}</span>
                          {isCorrect && (
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Fill blank */}
                {currentQuestion.type === 'fill_blank' && (
                  <div className="text-center">
                    <p className="text-white/70 text-base">{currentQuestion.text.replace('[blank]', '______')}</p>
                    {phase === 'question_end' && correctAnswer && (
                      <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-300 font-bold">{correctAnswer}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Match pairs */}
                {currentQuestion.type === 'match_pair' && currentQuestion.match_pairs && (
                  <div className="space-y-2">
                    {currentQuestion.match_pairs.map((pair, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-sm text-center text-white/80">{pair.left}</div>
                        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <div className="flex-1 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm text-center text-white/80">{pair.right}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                {phase === 'question' && (
                  <button
                    onClick={() => { stopTimer(); setPhase('question_end') }}
                    className="px-4 py-2 bg-white/5 border border-white/15 rounded-xl text-white/60 text-sm hover:bg-white/10 hover:text-white/80 transition-all"
                  >
                    Skip to Results
                  </button>
                )}
                {phase === 'question_end' && (
                  <div className="flex gap-3 ml-auto">
                    {questionIndex + 1 < totalQuestions ? (
                      <button
                        onClick={handleNextQuestion}
                        disabled={isNexting}
                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isNexting ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                        Next Question
                      </button>
                    ) : (
                      <button
                        onClick={handleEndGame}
                        disabled={isEnding}
                        className="px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl text-white font-bold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isEnding ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : null}
                        End Game
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Live leaderboard */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Leaderboard</h3>
                </div>
                <div className="space-y-2">
                  {leaderboard.slice(0, 7).map((entry, i) => (
                    <div key={entry.player_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-sm w-5 text-center">{i < 3 ? <MedalIcon rank={i} /> : <span className="text-white/30 text-xs">#{i+1}</span>}</span>
                      <span className="flex-1 text-sm text-white/80 truncate font-medium">{entry.nickname}</span>
                      <span className="text-xs font-bold text-violet-300">{entry.score}</span>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <p className="text-white/25 text-xs text-center py-3">No scores yet</p>
                  )}
                </div>
              </div>

              {/* Answer Distribution Heatmap */}
              {(Object.keys(answerDist).length > 0 || distTotal > 0) && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Live Answers</h3>
                    </div>
                    <span className="text-xs text-amber-300 font-bold">{distTotal}</span>
                  </div>
                  <div className="space-y-2">
                    {currentQuestion?.options?.map((opt, i) => {
                      const count = answerDist[opt.id] ?? 0
                      const pct = distTotal > 0 ? Math.round((count / distTotal) * 100) : 0
                      return (
                        <div key={opt.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${OPTION_COLORS[i % 4]} flex items-center justify-center text-[9px] font-bold text-white`}>
                                {OPTION_LABELS[i]}
                              </div>
                              <span className="text-[10px] text-white/60 truncate max-w-[80px]">{opt.text}</span>
                            </div>
                            <span className="text-[10px] font-bold text-white/60">{count}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${OPTION_COLORS[i % 4]} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {/* Fill blank / true-false distribution */}
                    {!currentQuestion?.options?.length && Object.entries(answerDist).map(([answer, count]) => {
                      const pct = distTotal > 0 ? Math.round((count / distTotal) * 100) : 0
                      return (
                        <div key={answer}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white/60 truncate max-w-[100px]">{answer}</span>
                            <span className="text-[10px] font-bold text-white/60">{count}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Players */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Players</h3>
                  <span className="text-xs text-violet-300 font-bold">{players.length}</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {players.slice(0, 12).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 py-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {p.nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-white/70 truncate">{p.nickname}</span>
                    </div>
                  ))}
                  {players.length > 12 && (
                    <p className="text-white/30 text-xs text-center pt-1">+{players.length - 12} more</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GAME OVER ── */}
        {phase === 'game_over' && (
          <div className="animate-fadeInUp flex flex-col items-center gap-8 py-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-500/30 animate-bounceIn">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h2 className="text-4xl font-black text-white">Game Over!</h2>
              <p className="text-white/50 mt-2">Here are the final results</p>
            </div>

            {/* Top 3 podium */}
            {leaderboard.length > 0 && (
              <div className="flex items-end gap-3 justify-center w-full max-w-lg">
                {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, podiumPos) => {
                  if (!entry) return <div key={podiumPos} className="w-28" />
                  const heights = ['h-24', 'h-32', 'h-20']
                  const rank = podiumPos === 1 ? 0 : podiumPos === 0 ? 1 : 2
                  return (
                    <div key={entry.player_id} className="flex flex-col items-center gap-2 flex-1">
                      <MedalIcon rank={rank} size="lg" />
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-bold text-sm">
                        {entry.nickname.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-xs font-bold text-white/80 text-center truncate w-full">{entry.nickname}</p>
                      <p className="text-xs text-violet-300 font-black">{entry.score}</p>
                      <div className={`w-full ${heights[podiumPos]} rounded-t-xl ${
                        rank === 0 ? 'bg-gradient-to-t from-amber-600 to-amber-400' :
                        rank === 1 ? 'bg-gradient-to-t from-slate-500 to-slate-400' :
                        'bg-gradient-to-t from-amber-800 to-amber-600'
                      } flex items-center justify-center`}>
                        <span className="text-white font-black text-xl">#{rank + 1}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Full leaderboard */}
            <div className="w-full max-w-lg bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Full Rankings</h3>
              </div>
              <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                {leaderboard.map((entry, i) => (
                  <div key={entry.player_id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 text-sm text-center">{i < 3 ? <MedalIcon rank={i} /> : <span className="text-white/30">#{i+1}</span>}</span>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {entry.nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 font-medium text-sm text-white/90">{entry.nickname}</span>
                    <span className="font-black text-violet-300">{entry.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All participants */}
            {players.length > 0 && (
              <div className="w-full max-w-lg bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">All Participants ({players.length})</h3>
                </div>
                <div className="flex flex-wrap gap-2 p-4 max-h-36 overflow-y-auto">
                  {players.map((p) => (
                    <span key={p.id} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70">
                      {p.nickname}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-white/10 border border-white/15 rounded-2xl text-white font-semibold hover:bg-white/15 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate(`/results/${pin}`)}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Full Results
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
