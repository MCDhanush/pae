import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { gameAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import type { LeaderboardEntry } from '../../types'
import Button from '../../components/ui/Button'

interface QuestionStat {
  question_id: string
  text: string
  correct_count: number
  total_answers: number
  avg_time_taken: number
}

interface ResultsData {
  session_id: string
  quiz_title: string
  total_players: number
  total_questions: number
  leaderboard: LeaderboardEntry[]
  question_stats: QuestionStat[]
}

const MEDAL_COLORS = ['text-yellow-400', 'text-gray-400', 'text-amber-600']
const MEDAL_EMOJIS = ['🥇', '🥈', '🥉']

type Tab = 'leaderboard' | 'questions'

export default function ResultsPage() {
  const { pin } = useParams<{ pin: string }>()
  const navigate = useNavigate()
  const { myPlayerID } = useGameStore()

  const [data, setData] = useState<ResultsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard')

  useEffect(() => {
    if (!pin) return

    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const results = await gameAPI.getResults(pin)
        setData(results)
      } catch (err) {
        console.error('Failed to load results:', err)
        setError('Could not load results. The game may not exist or has been deleted.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [pin])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">😕</div>
          <h2 className="text-xl font-bold text-white">Results Unavailable</h2>
          <p className="text-gray-400 text-sm">{error ?? 'Something went wrong.'}</p>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const top3 = data.leaderboard.slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">PIN:</span>
            <span className="text-lg font-black tracking-widest text-accent-400">{pin}</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Export / share logic can go here
            }}
          >
            Export
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Title + summary */}
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-3xl font-black">{data.quiz_title}</h1>
          <p className="text-gray-400 text-sm">
            {data.total_players} player{data.total_players !== 1 ? 's' : ''} · {data.total_questions} question{data.total_questions !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Players', value: data.total_players },
            { label: 'Questions', value: data.total_questions },
            {
              label: 'Avg Score',
              value: data.leaderboard.length
                ? Math.round(
                    data.leaderboard.reduce((acc, e) => acc + e.score, 0) / data.leaderboard.length
                  ).toLocaleString()
                : '—',
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-gray-800 rounded-2xl p-4 border border-gray-700 text-center"
            >
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-gray-400 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Podium — top 3 */}
        {top3.length > 0 && (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <h2 className="text-sm font-semibold text-gray-400 mb-6 text-center tracking-widest">
              TOP PLAYERS
            </h2>

            {/* Podium visual */}
            <div className="flex items-end justify-center gap-4 mb-6">
              {/* 2nd */}
              {top3[1] && (
                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-2xl">🥈</span>
                  <div className="w-full bg-gray-700 rounded-t-xl flex flex-col items-center py-3 px-2" style={{ height: '80px' }}>
                    <p className="font-bold text-sm text-white truncate w-full text-center">
                      {top3[1].nickname}
                    </p>
                    <p className="text-gray-300 text-xs">{top3[1].score.toLocaleString()} pts</p>
                  </div>
                  <div className="w-full h-1 bg-gray-500 rounded-b" />
                </div>
              )}

              {/* 1st */}
              {top3[0] && (
                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-3xl">🥇</span>
                  <div
                    className="w-full bg-yellow-500/20 border border-yellow-500/40 rounded-t-xl flex flex-col items-center py-4 px-2"
                    style={{ height: '112px' }}
                  >
                    <p className="font-black text-base text-yellow-300 truncate w-full text-center">
                      {top3[0].nickname}
                    </p>
                    <p className="text-yellow-200/80 text-sm font-bold mt-1">
                      {top3[0].score.toLocaleString()} pts
                    </p>
                  </div>
                  <div className="w-full h-1 bg-yellow-500 rounded-b" />
                </div>
              )}

              {/* 3rd */}
              {top3[2] && (
                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-2xl">🥉</span>
                  <div className="w-full bg-gray-700 rounded-t-xl flex flex-col items-center py-3 px-2" style={{ height: '64px' }}>
                    <p className="font-bold text-sm text-white truncate w-full text-center">
                      {top3[2].nickname}
                    </p>
                    <p className="text-gray-300 text-xs">{top3[2].score.toLocaleString()} pts</p>
                  </div>
                  <div className="w-full h-1 bg-amber-700 rounded-b" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="flex gap-1 bg-gray-800 p-1 rounded-xl border border-gray-700 w-fit">
            {(['leaderboard', 'questions'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors',
                  activeTab === tab
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white',
                )}
              >
                {tab === 'leaderboard' ? 'Leaderboard' : 'Question Stats'}
              </button>
            ))}
          </div>

          {/* LEADERBOARD TAB */}
          {activeTab === 'leaderboard' && (
            <div className="mt-4 bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              {data.leaderboard.length === 0 ? (
                <p className="text-center text-gray-500 py-12 text-sm">No players yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3 w-12">#</th>
                      <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Player</th>
                      <th className="text-right text-xs font-semibold text-gray-400 px-5 py-3">Score</th>
                      <th className="text-right text-xs font-semibold text-gray-400 px-5 py-3 hidden sm:table-cell">Correct</th>
                      <th className="text-right text-xs font-semibold text-gray-400 px-5 py-3 hidden md:table-cell">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((entry, i) => {
                      const isMe = entry.player_id === myPlayerID
                      const inTop3 = i < 3
                      return (
                        <tr
                          key={entry.player_id}
                          className={clsx(
                            'border-b border-gray-700/50 last:border-0 transition-colors',
                            isMe ? 'bg-primary-900/40' : 'hover:bg-gray-700/30',
                          )}
                        >
                          <td className="px-5 py-3.5">
                            {inTop3 ? (
                              <span className="text-lg">{MEDAL_EMOJIS[i]}</span>
                            ) : (
                              <span className="text-gray-500 font-bold text-sm">{i + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={clsx(
                                  'font-semibold text-sm',
                                  inTop3 ? MEDAL_COLORS[i] : 'text-white',
                                  isMe && 'text-accent-300',
                                )}
                              >
                                {entry.nickname}
                              </span>
                              {isMe && (
                                <span className="text-xs bg-accent-500/20 text-accent-300 border border-accent-500/30 px-1.5 py-0.5 rounded-full font-medium">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-white">
                            {entry.score.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-400 text-sm hidden sm:table-cell">
                            {entry.correct_answers ?? '—'}/{data.total_questions}
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-400 text-sm hidden md:table-cell">
                            {entry.avg_time != null ? `${entry.avg_time.toFixed(1)}s` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* QUESTION STATS TAB */}
          {activeTab === 'questions' && (
            <div className="mt-4 space-y-3">
              {data.question_stats.length === 0 ? (
                <p className="text-center text-gray-500 py-12 text-sm">No question stats available.</p>
              ) : (
                data.question_stats.map((stat, i) => {
                  const pct =
                    stat.total_answers > 0
                      ? Math.round((stat.correct_count / stat.total_answers) * 100)
                      : 0
                  const difficulty =
                    pct >= 70 ? 'easy' : pct >= 40 ? 'medium' : 'hard'
                  const diffColor =
                    difficulty === 'easy'
                      ? 'text-green-400 bg-green-500/10 border-green-500/30'
                      : difficulty === 'medium'
                        ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                        : 'text-red-400 bg-red-500/10 border-red-500/30'
                  const barColor =
                    difficulty === 'easy'
                      ? 'bg-green-500'
                      : difficulty === 'medium'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'

                  return (
                    <div
                      key={stat.question_id}
                      className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-gray-500 font-bold text-sm pt-0.5 shrink-0">
                            Q{i + 1}
                          </span>
                          <p className="text-white text-sm font-medium leading-snug">{stat.text}</p>
                        </div>
                        <span
                          className={clsx(
                            'shrink-0 text-xs font-semibold px-2 py-1 rounded-full border capitalize',
                            diffColor,
                          )}
                        >
                          {difficulty}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                          <span>{stat.correct_count} correct of {stat.total_answers}</span>
                          <span className="font-bold text-white">{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full transition-all', barColor)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        Avg time: {stat.avg_time_taken != null ? `${stat.avg_time_taken.toFixed(1)}s` : '—'}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button variant="secondary" onClick={() => navigate('/dashboard')} fullWidth>
            Back to Dashboard
          </Button>
          <Button variant="primary" onClick={() => navigate('/')} fullWidth>
            New Game
          </Button>
        </div>
      </main>
    </div>
  )
}