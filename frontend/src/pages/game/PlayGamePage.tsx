import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { playerAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import {
  connectMQTT,
  disconnectMQTT,
  MQTT_EVENTS,
  removeAllMQTTListeners,
} from '../../mqtt'
import type {
  QuestionStartPayload,
  QuestionEndPayload,
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

  // Use selectors to prevent unnecessary re-renders
  const myPlayerID = useGameStore(s => s.myPlayerID)
  const myNickname = useGameStore(s => s.myNickname)
  const myScore = useGameStore(s => s.myScore)
  const currentQuestion = useGameStore(s => s.currentQuestion)
  const timeRemaining = useGameStore(s => s.timeRemaining)
  const hasAnswered = useGameStore(s => s.hasAnswered)
  const leaderboard = useGameStore(s => s.leaderboard)
  const lastAnswerCorrect = useGameStore(s => s.lastAnswerCorrect)
  const pointsEarned = useGameStore(s => s.pointsEarned)
  
  // Get setters
  const setMyScore = useGameStore(s => s.setMyScore)
  const setCurrentQuestion = useGameStore(s => s.setCurrentQuestion)
  const setTimeRemaining = useGameStore(s => s.setTimeRemaining)
  const setHasAnswered = useGameStore(s => s.setHasAnswered)
  const updateLeaderboard = useGameStore(s => s.updateLeaderboard)
  const setLastAnswerResult = useGameStore(s => s.setLastAnswerResult)
  const reset = useGameStore(s => s.reset)

  const [phase, setPhase] = useState<PlayerPhase>('lobby')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [answerStartTime, setAnswerStartTime] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // Use refs to access current values in MQTT handlers without closure issues
  const myPlayerIDRef = useRef(myPlayerID)
  const pointsEarnedRef = useRef(pointsEarned)
  
  useEffect(() => {
    myPlayerIDRef.current = myPlayerID
  }, [myPlayerID])

  useEffect(() => {
    pointsEarnedRef.current = pointsEarned
  }, [pointsEarned])

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
        if (prev <= 1) {
          stopTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [stopTimer, setTimeRemaining])

  useEffect(() => {
    if (!pin) {
      navigate('/join')
      return
    }
    if (!myPlayerID) {
      navigate('/join')
      return
    }

    let mounted = true

    // Connect to HiveMQ as player (subscribes to broadcast + lobby + player result topic)
    const mqttClient = connectMQTT(pin, myPlayerID)

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connected as player')
    })

    mqttClient.on(MQTT_EVENTS.GAME_STARTED, () => {
      if (!mounted) return
      setPhase('question')
    })

    mqttClient.on(MQTT_EVENTS.QUESTION_START, (p: unknown) => {
      if (!mounted) return
      const payload = p as QuestionStartPayload
      console.log('[MQTT] QUESTION_START received:', {
        questionIndex: payload.question_index,
        totalQuestions: payload.total_questions,
        question: {
          id: payload.question?.id,
          type: payload.question?.type,
          text: payload.question?.text?.substring(0, 50),
          timeLimit: payload.question?.time_limit,
          points: payload.question?.points,
        }
      })
      setCurrentQuestion(payload.question)
      setQuestionIndex(payload.question_index)
      setTotalQuestions(payload.total_questions)
      setCorrectAnswer(null)
      setHasAnswered(false)
      setPhase('question')
      setAnswerStartTime(Date.now())
      startTimer(payload.question.time_limit)
    })

    mqttClient.on(MQTT_EVENTS.ANSWER_RESULT, (p: unknown) => {
      if (!mounted) return
      const result = p as { is_correct: boolean; points: number }
      setLastAnswerResult(result.is_correct, result.points)
    })

    mqttClient.on(MQTT_EVENTS.QUESTION_END, (p: unknown) => {
      if (!mounted) return
      stopTimer()
      setCorrectAnswer((p as QuestionEndPayload).correct_answer)
      setPhase('question_end')
    })

    mqttClient.on(MQTT_EVENTS.LEADERBOARD_UPDATE, (p: unknown) => {
      if (!mounted) return
      const lb = (p as LeaderboardPayload).entries
      console.log('[Leaderboard] Update received:', lb.map(e => ({ name: e.nickname, score: e.score, rank: e.rank })))
      updateLeaderboard(lb)
      const myEntry = lb.find((e) => e.player_id === myPlayerIDRef.current)
      if (myEntry) {
        console.log('[Leaderboard] My entry:', { name: myEntry.nickname, score: myEntry.score, rank: myEntry.rank })
        setMyScore(myEntry.score)
      }
    })

    mqttClient.on(MQTT_EVENTS.GAME_ENDED, (p: unknown) => {
      if (!mounted) return
      stopTimer()
      const lb = (p as GameEndPayload).final_leaderboard
      updateLeaderboard(lb)
      const myEntry = lb.find((e) => e.player_id === myPlayerIDRef.current)
      if (myEntry) setMyScore(myEntry.score)
      setPhase('game_over')
    })

    return () => {
      mounted = false
      stopTimer()
      removeAllMQTTListeners()
      disconnectMQTT()
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, myPlayerID])

  const handleAnswer = useCallback(async (answer: string) => {
    if (hasAnswered || !currentQuestion || !myPlayerID || !pin) return
    
    console.log('[Answer Debug] currentQuestion:', {
      id: currentQuestion.id,
      type: currentQuestion.type,
      text: currentQuestion.text?.substring(0, 50),
      timeLimit: currentQuestion.time_limit,
      points: currentQuestion.points,
    })

    const elapsed = Math.round((Date.now() - answerStartTime) / 1000)
    const timeLeft = Math.max(0, currentQuestion.time_limit - elapsed)

    console.log('[Answer Submission] START', {
      playerID: myPlayerID,
      questionID: currentQuestion.id,
      pin,
      answer,
      timeLeft,
      totalTime: currentQuestion.time_limit,
      hasAnswered,
    })

    setHasAnswered(true)
    stopTimer()
    setPhase('answered')

    try {
      const payload = {
        pin,
        question_id: currentQuestion.id,
        answer,
        time_left: timeLeft,
        total_time: currentQuestion.time_limit,
      }
      console.log('[Answer Submission] Payload:', payload)
      console.log('[Answer Submission] JSON.stringify:', JSON.stringify(payload))
      
      const result = await playerAPI.submitAnswer(myPlayerID, payload)
      
      console.log('[Answer Submission] SUCCESS - Backend Response:', { 
        is_correct: result.is_correct, 
        points: result.points, 
        total_score: result.total_score 
      })
      // Use HTTP response for immediate feedback
      setLastAnswerResult(result.is_correct, result.points)
    } catch (err) {
      console.error('[Answer Submission] FAILED:', err)
      if (err instanceof Error) {
        console.error('[Answer Submission] Error message:', err.message)
      }
    }
  }, [hasAnswered, currentQuestion, answerStartTime, myPlayerID, pin, setHasAnswered, stopTimer, setLastAnswerResult])

  const myRank = leaderboard.find((e) => e.player_id === myPlayerID)?.rank ?? null

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white flex flex-col">
      {/* Top bar */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/60 text-xs">Playing as</p>
            <p className="font-bold text-sm">{myNickname}</p>
          </div>
          <div className="text-center">
            <p className="text-white/60 text-xs">PIN</p>
            <p className="font-black tracking-widest text-accent-300">{pin}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-xs">Score</p>
            <p className="font-black text-lg text-accent-300">{myScore.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xl">
          {/* LOBBY */}
          {phase === 'lobby' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                <svg className="w-12 h-12 text-white/80 animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">You're In!</h2>
                <p className="text-white/70 mt-2">
                  Welcome, <span className="font-bold text-accent-300">{myNickname}</span>!
                </p>
                <p className="text-white/50 text-sm mt-3">Waiting for the host to start the game...</p>
              </div>
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* QUESTION */}
          {phase === 'question' && currentQuestion && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Question {questionIndex + 1} of {totalQuestions}</span>
                <span>{currentQuestion.points} pts</span>
              </div>

              <Timer total={currentQuestion.time_limit} remaining={timeRemaining} size="md" />

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <QuestionCard
                  question={currentQuestion}
                  mode="play"
                  onAnswer={handleAnswer}
                  disabled={hasAnswered}
                />
              </div>
            </div>
          )}

          {/* ANSWERED - waiting for question end */}
          {phase === 'answered' && currentQuestion && (
            <div className="text-center space-y-6">
              <div className={clsx(
                'w-24 h-24 rounded-full flex items-center justify-center mx-auto',
                lastAnswerCorrect === null
                  ? 'bg-blue-500/30'
                  : lastAnswerCorrect
                    ? 'bg-green-500/30'
                    : 'bg-red-500/30',
              )}>
                {lastAnswerCorrect === null ? (
                  <svg className="w-12 h-12 text-blue-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : lastAnswerCorrect ? (
                  <svg className="w-12 h-12 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold">
                  {lastAnswerCorrect === null
                    ? 'Answer Submitted!'
                    : lastAnswerCorrect
                      ? 'Correct!'
                      : 'Not quite...'}
                </h2>
                {lastAnswerCorrect !== null && (
                  <p className={clsx(
                    'text-4xl font-black mt-2',
                    lastAnswerCorrect ? 'text-green-300' : 'text-white/50',
                  )}>
                    {lastAnswerCorrect ? `+${pointsEarned}` : '+0'}
                  </p>
                )}
                <p className="text-white/50 text-sm mt-3">Waiting for other players...</p>
              </div>
            </div>
          )}

          {/* QUESTION END */}
          {phase === 'question_end' && (
            <div className="space-y-4">
              {correctAnswer && (
                <div className="bg-green-500/20 border border-green-400/40 rounded-2xl p-4 text-center">
                  <p className="text-green-300 text-sm font-medium mb-1">Correct Answer:</p>
                  <p className="text-white font-bold text-lg">{correctAnswer}</p>
                </div>
              )}

              <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                <h3 className="text-sm font-semibold text-white/60 mb-3 text-center">LEADERBOARD</h3>
                {leaderboard.length > 0 ? (
                  <Leaderboard entries={leaderboard} myPlayerId={myPlayerID} compact maxEntries={5} />
                ) : (
                  <p className="text-center text-white/40 text-sm py-4">Calculating scores...</p>
                )}
              </div>

              {myRank && (
                <div className="bg-primary-600/40 rounded-xl p-3 text-center border border-primary-400/30">
                  <p className="text-white/70 text-xs">Your rank</p>
                  <p className="text-3xl font-black text-accent-300">#{myRank}</p>
                </div>
              )}

              <p className="text-center text-white/40 text-sm animate-pulse">
                Waiting for host to continue...
              </p>
            </div>
          )}

          {/* GAME OVER */}
          {phase === 'game_over' && (
            <div className="text-center space-y-6">
              <div className="text-5xl">🎊</div>
              <div>
                <h2 className="text-3xl font-black">Game Over!</h2>
                {myRank && (
                  <div className="mt-4">
                    <p className="text-white/60 text-sm">Your final rank</p>
                    <p className="text-6xl font-black text-accent-300 mt-1">#{myRank}</p>
                    <p className="text-xl font-bold text-white/80 mt-2">
                      {myScore.toLocaleString()} points
                    </p>
                  </div>
                )}
              </div>

              {leaderboard.length > 0 && (
                <div className="bg-white/10 rounded-2xl p-4 border border-white/20 text-left">
                  <h3 className="text-sm font-semibold text-white/60 mb-3 text-center">FINAL LEADERBOARD</h3>
                  <Leaderboard entries={leaderboard} myPlayerId={myPlayerID} maxEntries={10} />
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate(`/results/${pin}`)}
                  className="w-full py-3 bg-white text-primary-700 font-bold rounded-xl hover:bg-gray-100 transition-colors"
                >
                  View Full Results
                </button>
                <button
                  onClick={() => navigate('/join')}
                  className="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
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
