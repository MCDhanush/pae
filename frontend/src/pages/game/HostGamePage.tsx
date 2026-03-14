import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
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
} from '../../mqtt'
import type { Player } from '../../types'
import Timer from '../../components/ui/Timer'
import Button from '../../components/ui/Button'
import PlayerList from '../../components/game/PlayerList'
import Leaderboard from '../../components/game/Leaderboard'

type GamePhase = 'lobby' | 'question' | 'question_end' | 'game_over'

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

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
        if (prev <= 1) {
          stopTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [stopTimer, setTimeRemaining])

  // Load session + connect to MQTT
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

        // Connect to HiveMQ as host (no playerID)
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
          setPhase('question')
          startTimer(payload.question.time_limit)
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
      // REST call triggers MQTT game_start + question_start server-side
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
      // REST call triggers MQTT question_start for next question server-side
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
      // REST call triggers MQTT game_end server-side
      await gameAPI.end(session.pin)
    } catch (err) {
      console.error('Failed to end game:', err)
    } finally {
      setIsEnding(false)
    }
  }

  const handleViewResults = () => {
    navigate(`/results/${pin}`)
  }

  const mqttClient = getMQTT()
  const isConnected = mqttClient?.connected ?? false

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top bar */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-2.5 h-2.5 rounded-full',
              isConnected ? 'bg-green-400' : 'bg-red-400',
            )} />
            <span className="text-sm font-medium text-gray-300">
              {isConnected ? 'Connected' : 'Connecting…'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">PIN:</span>
            <span className="text-2xl font-black tracking-widest text-accent-400">{pin}</span>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={handleEndGame}
            isLoading={isEnding}
          >
            End Game
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* LOBBY */}
        {phase === 'lobby' && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center mt-4">
              <p className="text-gray-400 text-sm mb-2">Share this PIN with players:</p>
              <div className="inline-block bg-gray-800 rounded-3xl px-10 py-6 border border-gray-700">
                <div className="text-7xl font-black tracking-widest text-accent-400 select-all">
                  {pin}
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-3">
                Go to <span className="text-white font-medium">pae-quiz.app/join</span> and enter the PIN
              </p>
            </div>

            <div className="w-full max-w-2xl bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <PlayerList players={players} />
            </div>

            <Button
              variant="accent"
              size="lg"
              onClick={handleStartGame}
              isLoading={isStarting}
              disabled={players.length === 0}
            >
              {players.length === 0 ? 'Waiting for players...' : `Start Game (${players.length} player${players.length !== 1 ? 's' : ''})`}
            </Button>
          </div>
        )}

        {/* ACTIVE QUESTION */}
        {(phase === 'question' || phase === 'question_end') && currentQuestion && (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Main question area */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Question</span>
                  <span className="text-white font-bold">{questionIndex + 1}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">{totalQuestions}</span>
                </div>
                <span className="text-sm text-gray-400">{currentQuestion.points} pts</span>
              </div>

              {phase === 'question' && (
                <Timer
                  total={currentQuestion.time_limit}
                  remaining={timeRemaining}
                  size="lg"
                />
              )}

              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                {currentQuestion.image && (
                  <img
                    src={currentQuestion.image}
                    alt="Question"
                    className="w-full max-h-48 object-contain rounded-xl mb-4"
                  />
                )}
                <h2 className="text-2xl font-bold text-white text-center mb-6">
                  {currentQuestion.text}
                </h2>

                {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'image_based') &&
                  currentQuestion.options && (
                    <div className="grid grid-cols-2 gap-3">
                      {currentQuestion.options.map((opt, i) => (
                        <div
                          key={opt.id}
                          className={clsx(
                            'flex items-center gap-3 p-4 rounded-xl text-white font-semibold',
                            OPTION_COLORS[i % 4],
                            phase === 'question_end' && correctAnswer === opt.id && 'ring-4 ring-white',
                            phase === 'question_end' && correctAnswer !== opt.id && 'opacity-50',
                          )}
                        >
                          <span className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center font-bold text-sm shrink-0">
                            {OPTION_LABELS[i]}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {phase === 'question_end' && correctAnswer === opt.id && (
                            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                {currentQuestion.type === 'fill_blank' && (
                  <div className="text-center">
                    <p className="text-gray-300 text-lg">{currentQuestion.text.replace('[blank]', '______')}</p>
                    {phase === 'question_end' && correctAnswer && (
                      <div className="mt-4 inline-block px-6 py-3 bg-green-500 rounded-xl text-white font-bold">
                        Answer: {correctAnswer}
                      </div>
                    )}
                  </div>
                )}

                {currentQuestion.type === 'match_pair' && currentQuestion.match_pairs && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentQuestion.match_pairs.map((pair, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="flex-1 p-3 bg-gray-700 rounded-lg text-sm text-center">{pair.left}</div>
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <div className="flex-1 p-3 bg-primary-800 rounded-lg text-sm text-center">{pair.right}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {phase === 'question_end' && (
                <div className="flex gap-3 justify-end">
                  {questionIndex + 1 < totalQuestions ? (
                    <Button variant="accent" size="lg" onClick={handleNextQuestion} isLoading={isNexting}>
                      Next Question
                    </Button>
                  ) : (
                    <Button variant="primary" size="lg" onClick={handleEndGame} isLoading={isEnding}>
                      End Game
                    </Button>
                  )}
                </div>
              )}

              {phase === 'question' && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => {
                    stopTimer()
                    setPhase('question_end')
                  }}>
                    Skip to Results
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">LIVE LEADERBOARD</h3>
                <Leaderboard entries={leaderboard} compact maxEntries={5} />
              </div>
              <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  PLAYERS ({players.length})
                </h3>
                <PlayerList players={players} compact maxVisible={10} />
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {phase === 'game_over' && (
          <div className="flex flex-col items-center gap-8 py-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-black">Game Over!</h2>
              <p className="text-gray-400 mt-2">Here are the final results</p>
            </div>

            <div className="w-full max-w-lg bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <Leaderboard entries={leaderboard} />
            </div>

            <div className="flex gap-4">
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="primary" onClick={handleViewResults}>
                Full Results
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
