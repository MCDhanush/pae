import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { playerAPI, gameAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import {
  connectMQTT,
  disconnectMQTT,
  MQTT_EVENTS,
  removeAllMQTTListeners,
} from '../../mqtt'
import type {
  QuestionStartPayload,
  LeaderboardPayload,
  GameEndPayload,
} from '../../mqtt'
import Timer from '../../components/ui/Timer'
import Leaderboard from '../../components/game/Leaderboard'
import QuestionCard from '../../components/quiz/QuestionCard'

type PlayerPhase = 'lobby' | 'question' | 'answered' | 'question_end' | 'game_over'

export default function PlayGamePage() {
  const { pin } = useParams<{ pin: string }>()
  const navigate = useNavigate()

  const myPlayerID = useGameStore(s => s.myPlayerID)
  const myNickname = useGameStore(s => s.myNickname)
  const myScore = useGameStore(s => s.myScore)
  const currentQuestion = useGameStore(s => s.currentQuestion)
  const timeRemaining = useGameStore(s => s.timeRemaining)
  const hasAnswered = useGameStore(s => s.hasAnswered)
  const leaderboard = useGameStore(s => s.leaderboard)
  const lastAnswerCorrect = useGameStore(s => s.lastAnswerCorrect)
  const pointsEarned = useGameStore(s => s.pointsEarned)

  const setMyScore = useGameStore(s => s.setMyScore)
  const setCurrentQuestion = useGameStore(s => s.setCurrentQuestion)
  const setTimeRemaining = useGameStore(s => s.setTimeRemaining)
  const setHasAnswered = useGameStore(s => s.setHasAnswered)
  const updateLeaderboard = useGameStore(s => s.updateLeaderboard)
  const setLastAnswerResult = useGameStore(s => s.setLastAnswerResult)
  const reset = useGameStore(s => s.reset)
  const activePin = useGameStore(s => s.activePin)
  const savedPhase = useGameStore(s => s.savedPhase)
  const setActivePin = useGameStore(s => s.setActivePin)
  const setSavedPhase = useGameStore(s => s.setSavedPhase)
  const lastAnsweredQuestionId = useGameStore(s => s.lastAnsweredQuestionId)
  const setLastAnsweredQuestionId = useGameStore(s => s.setLastAnsweredQuestionId)

  // Restore phase from persisted store when re-entering the same game.
  // If the current question was already answered (lastAnsweredQuestionId matches),
  // restore to 'answered' to prevent the "already submitted" error on re-entry.
  const restoredPhase = (() => {
    if (activePin !== pin || !savedPhase) return 'lobby'
    if (savedPhase === 'question' && currentQuestion && lastAnsweredQuestionId === currentQuestion.id) return 'answered'
    return savedPhase as PlayerPhase
  })()
  const [phase, setPhase] = useState<PlayerPhase>(restoredPhase)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [answerStartTime, setAnswerStartTime] = useState<number>(0)
  const [gameInProgress, setGameInProgress] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const myPlayerIDRef = useRef(myPlayerID)
  useEffect(() => { myPlayerIDRef.current = myPlayerID }, [myPlayerID])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
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

  // Poll session status as fallback when MQTT events are missed
  const startPoll = useCallback((pinVal: string) => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const sess = await gameAPI.getByPIN(pinVal)
        if (sess.status === 'active') {
          setGameInProgress(true)
        } else if (sess.status === 'finished') {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      } catch {
        // ignore
      }
    }, 4000)
  }, [])

  // Persist phase so re-entry after backgrounding restores state
  const setPhaseAndSave = useCallback((p: PlayerPhase) => {
    setPhase(p)
    setSavedPhase(p)
  }, [setSavedPhase])

  useEffect(() => {
    if (!pin) { navigate('/join'); return }
    if (!myPlayerID) { navigate('/join'); return }

    // Register this pin as the active game
    setActivePin(pin)

    let mounted = true

    const mqttClient = connectMQTT(pin, myPlayerID)

    mqttClient.on('connect', () => {
      if (!mounted) return
      // On connect, check if game already started (missed event recovery)
      gameAPI.getByPIN(pin).then(sess => {
        if (!mounted) return
        if (sess.status === 'active') setGameInProgress(true)
        if (sess.status === 'finished') setPhaseAndSave('game_over')
      }).catch(() => {})
    })

    mqttClient.on(MQTT_EVENTS.GAME_STARTED, () => {
      if (!mounted) return
      setGameInProgress(true)
    })

    mqttClient.on(MQTT_EVENTS.QUESTION_START, (p: unknown) => {
      if (!mounted) return
      const payload = p as QuestionStartPayload
      setCurrentQuestion(payload.question)
      setQuestionIndex(payload.question_index)
      setTotalQuestions(payload.total_questions)
      setHasAnswered(false)
      setPhaseAndSave('question')
      setAnswerStartTime(Date.now())
      startTimer(payload.question.time_limit)
      setGameInProgress(false)
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    })

    mqttClient.on(MQTT_EVENTS.ANSWER_RESULT, (p: unknown) => {
      if (!mounted) return
      const result = p as { is_correct: boolean; points: number }
      setLastAnswerResult(result.is_correct, result.points)
    })

    mqttClient.on(MQTT_EVENTS.QUESTION_END, () => {
      if (!mounted) return
      stopTimer()
      setPhaseAndSave('question_end')
    })

    mqttClient.on(MQTT_EVENTS.LEADERBOARD_UPDATE, (p: unknown) => {
      if (!mounted) return
      const lb = (p as LeaderboardPayload).entries
      updateLeaderboard(lb)
      const myEntry = lb.find((e) => e.player_id === myPlayerIDRef.current)
      if (myEntry) setMyScore(myEntry.score)
    })

    mqttClient.on(MQTT_EVENTS.GAME_ENDED, (p: unknown) => {
      if (!mounted) return
      stopTimer()
      const lb = (p as GameEndPayload).final_leaderboard
      updateLeaderboard(lb)
      const myEntry = lb.find((e) => e.player_id === myPlayerIDRef.current)
      if (myEntry) setMyScore(myEntry.score)
      setPhaseAndSave('game_over')
    })

    // Start polling as fallback after 5 seconds
    const pollTimeout = setTimeout(() => {
      if (mounted && phase === 'lobby') startPoll(pin)
    }, 5000)

    return () => {
      mounted = false
      stopTimer()
      clearTimeout(pollTimeout)
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      removeAllMQTTListeners()
      disconnectMQTT()
      // Don't call reset() here — we want to preserve state when user backgrounds the app
      // reset() is only called when intentionally leaving (Play Again → /join)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, myPlayerID])

  // When game is detected as in-progress while student is still in lobby,
  // fetch the current question so late-joining students don't get stuck.
  useEffect(() => {
    if (!gameInProgress || phase !== 'lobby' || !pin) return
    let active = true
    gameAPI.getCurrentQuestion(pin).then(qData => {
      if (!active || !qData) return
      setCurrentQuestion(qData.question)
      setQuestionIndex(qData.question_index)
      setTotalQuestions(qData.total_questions)
      setHasAnswered(false)
      setPhaseAndSave('question')
      setAnswerStartTime(Date.now())
      startTimer(qData.question.time_limit)
      setGameInProgress(false)
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }).catch(() => {})
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameInProgress, phase, pin])

  const handleAnswer = useCallback(async (answer: string) => {
    if (hasAnswered || !currentQuestion || !myPlayerID || !pin) return
    // Guard against duplicate submit after page reload (stale persisted question)
    if (lastAnsweredQuestionId === currentQuestion.id) return
    const elapsed = Math.round((Date.now() - answerStartTime) / 1000)
    const timeLeft = Math.max(0, currentQuestion.time_limit - elapsed)
    setHasAnswered(true)
    stopTimer()
    setPhaseAndSave('answered')
    try {
      const result = await playerAPI.submitAnswer(myPlayerID, {
        pin,
        question_id: currentQuestion.id,
        answer,
        time_left: timeLeft,
        total_time: currentQuestion.time_limit,
      })
      setLastAnsweredQuestionId(currentQuestion.id)
      setLastAnswerResult(result.is_correct, result.points)
    } catch (err) {
      console.error('[Answer] Failed:', err)
    }
  }, [hasAnswered, currentQuestion, answerStartTime, myPlayerID, pin, lastAnsweredQuestionId, setHasAnswered, stopTimer, setLastAnsweredQuestionId, setLastAnswerResult, setPhaseAndSave])

  const myRank = leaderboard.find((e) => e.player_id === myPlayerID)?.rank ?? null

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-800 via-purple-900 to-indigo-950 text-white flex flex-col">
      {/* Animated bg blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 bg-black/20 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Playing as</p>
            <p className="font-black text-sm text-white">{myNickname}</p>
          </div>
          <div className="text-center">
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">PIN</p>
            <p className="font-black tracking-[0.2em] text-amber-300 text-sm">{pin}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">Score</p>
            <p className="font-black text-lg text-amber-300">{myScore.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl">

          {/* LOBBY */}
          {phase === 'lobby' && (
            <div className="animate-scaleIn text-center space-y-8">
              <div className="relative inline-flex">
                <div className="w-28 h-28 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto backdrop-blur-sm animate-float">
                  <svg className="w-14 h-14 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="absolute inset-0 rounded-3xl border-2 border-white/15 animate-pulseRing" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">You're In!</h2>
                <p className="text-white/60 text-base">
                  Welcome, <span className="font-black text-amber-300">{myNickname}</span>!
                </p>
                {gameInProgress ? (
                  <div className="animate-scaleIn mt-4 px-5 py-3 bg-amber-400/20 border border-amber-400/30 rounded-2xl inline-block">
                    <p className="text-amber-200 text-sm font-semibold">⚡ Game in progress – waiting for next question</p>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm mt-3">Waiting for the host to start...</p>
                )}
              </div>

              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>

              <div className="bg-white/8 border border-white/10 rounded-2xl px-6 py-4 max-w-xs mx-auto">
                <p className="text-white/40 text-xs">Game PIN</p>
                <p className="text-3xl font-black tracking-[0.3em] text-white mt-1">{pin}</p>
              </div>
            </div>
          )}

          {/* QUESTION */}
          {phase === 'question' && currentQuestion && (
            <div className="animate-fadeInUp space-y-4">
              {/* Progress */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-xs font-black">
                    {questionIndex + 1}
                  </div>
                  <span className="text-white/50 text-sm">of {totalQuestions}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-amber-300 font-bold text-sm">{currentQuestion.points} pts</span>
                </div>
              </div>

              <Timer total={currentQuestion.time_limit} remaining={timeRemaining} size="md" />

              <div className="bg-white/8 backdrop-blur-sm rounded-3xl p-5 border border-white/15 shadow-xl">
                <QuestionCard
                  question={currentQuestion}
                  mode="play"
                  onAnswer={handleAnswer}
                  disabled={hasAnswered}
                />
              </div>
            </div>
          )}

          {/* ANSWERED */}
          {phase === 'answered' && (
            <div className="animate-scaleIn text-center space-y-6">
              <div className={clsx(
                'w-28 h-28 rounded-3xl flex items-center justify-center mx-auto shadow-xl',
                lastAnswerCorrect === null ? 'bg-blue-500/20 border border-blue-400/30' :
                lastAnswerCorrect ? 'bg-green-500/20 border border-green-400/30' :
                'bg-red-500/20 border border-red-400/30',
              )}>
                {lastAnswerCorrect === null ? (
                  <svg className="w-14 h-14 text-blue-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : lastAnswerCorrect ? (
                  <svg className="w-14 h-14 text-green-300 animate-bounceIn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-14 h-14 text-red-300 animate-bounceIn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">
                  {lastAnswerCorrect === null ? 'Submitted!' :
                   lastAnswerCorrect ? '🎉 Correct!' : 'Not quite...'}
                </h2>
                {lastAnswerCorrect !== null && (
                  <p className={clsx(
                    'text-5xl font-black mt-1',
                    lastAnswerCorrect ? 'text-amber-300' : 'text-white/30',
                  )}>
                    {lastAnswerCorrect ? `+${pointsEarned}` : '+0'}
                  </p>
                )}
                <p className="text-white/40 text-sm mt-3 animate-pulse">Waiting for other players...</p>
              </div>
            </div>
          )}

          {/* QUESTION END – show rank only, no answer reveal */}
          {phase === 'question_end' && (
            <div className="animate-fadeInUp space-y-4">
              {myRank && (
                <div className="animate-scaleInBounce text-center py-6">
                  <p className="text-white/50 text-sm font-medium uppercase tracking-wider mb-2">Your Rank</p>
                  <div className="inline-flex items-baseline gap-1">
                    <span className="text-6xl font-black text-amber-300">#</span>
                    <span className="text-8xl font-black text-white">{myRank}</span>
                  </div>
                  <p className="text-white/50 text-sm mt-2">Score: <span className="text-white font-bold">{myScore.toLocaleString()}</span></p>
                </div>
              )}

              {leaderboard.length > 0 && (
                <div className="bg-white/8 rounded-3xl p-4 border border-white/15">
                  <h3 className="text-xs font-bold text-white/40 mb-3 text-center uppercase tracking-wider">Top Players</h3>
                  <Leaderboard entries={leaderboard} myPlayerId={myPlayerID} compact maxEntries={5} />
                </div>
              )}

              <p className="text-center text-white/30 text-sm animate-pulse">
                Waiting for next question...
              </p>
            </div>
          )}

          {/* GAME OVER */}
          {phase === 'game_over' && (
            <div className="animate-fadeInUp text-center space-y-6">
              <div className="animate-scaleInBounce text-6xl">🎊</div>
              <div className="space-y-1">
                <h2 className="text-4xl font-black text-white">Game Over!</h2>
                {myRank && (
                  <div className="mt-4">
                    <p className="text-white/50 text-sm">Your final rank</p>
                    <p className="text-8xl font-black text-amber-300 mt-1">#{myRank}</p>
                    <p className="text-2xl font-bold text-white/70 mt-2">
                      {myScore.toLocaleString()} pts
                    </p>
                  </div>
                )}
              </div>

              {leaderboard.length > 0 && (
                <div className="bg-white/8 rounded-3xl p-5 border border-white/15 text-left">
                  <h3 className="text-xs font-bold text-white/40 mb-4 text-center uppercase tracking-wider">Final Leaderboard</h3>
                  <Leaderboard entries={leaderboard} myPlayerId={myPlayerID} maxEntries={10} />
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => navigate(`/results/${pin}`)}
                  className="w-full py-4 bg-white text-violet-700 font-bold rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Full Results
                </button>
                <button
                  onClick={() => { reset(); navigate('/join') }}
                  className="w-full py-3.5 bg-white/10 text-white font-semibold rounded-2xl hover:bg-white/20 active:scale-[0.98] transition-all border border-white/20"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
