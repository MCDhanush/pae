import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuthStore } from '../../store/authStore'
import { quizAPI, gameAPI, sessionAPI } from '../../lib/api'
import type { Quiz, SessionWithQuiz } from '../../types'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const classes = {
    waiting: 'badge-info',
    active: 'badge-success',
    finished: 'badge-warning',
  }[status] ?? 'badge-info'

  return <span className={`badge ${classes} capitalize`}>{status}</span>
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<SessionWithQuiz[]>([])
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStartingGame, setIsStartingGame] = useState<string | null>(null)

 const fetchData = useCallback(async () => {
  setIsLoadingQuizzes(true)
  setIsLoadingSessions(true)

  try {
    const [quizList, sessionList] = await Promise.all([
      quizAPI.list(),
      sessionAPI.list(),
    ])

    setQuizzes(quizList ?? [])
    setSessions(sessionList ?? []) // ✅ BEST FIX
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err)
  } finally {
    setIsLoadingQuizzes(false)
    setIsLoadingSessions(false)
  }
}, [])


  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDeleteQuiz = async () => {
    if (!deleteQuizId) return
    setIsDeleting(true)
    try {
      await quizAPI.delete(deleteQuizId)
      setQuizzes((prev) => prev.filter((q) => q.id !== deleteQuizId))
    } catch (err) {
      console.error('Failed to delete quiz:', err)
    } finally {
      setIsDeleting(false)
      setDeleteQuizId(null)
    }
  }

  const handleStartGame = async (quizId: string) => {
    setIsStartingGame(quizId)
    try {
      const session = await gameAPI.createSession(quizId)
      navigate(`/game/host/${session.pin}`)
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsStartingGame(null)
    }
  }

  // Build sessions over time chart data (last 7 days)
  const sessionsChartData = (() => {
    const days: Record<string, number> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      days[key] = 0
    }
    sessions.forEach((s) => {
      const key = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (key in days) days[key]++
    })
    return Object.entries(days).map(([date, count]) => ({ date, sessions: count }))
  })()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">PAE Quiz</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome + create */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-gray-500 mt-1">
              {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} • {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link to="/quiz/create">
            <Button
              variant="primary"
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              New Quiz
            </Button>
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'My Quizzes', value: quizzes.length, color: 'text-primary-600', bgColor: 'bg-primary-50' },
            { label: 'Total Sessions', value: sessions.length, color: 'text-accent-600', bgColor: 'bg-accent-50' },
            {
              label: 'Active Sessions',
              value: sessions.filter((s) => s.status === 'active').length,
              color: 'text-green-600',
              bgColor: 'bg-green-50',
            },
            {
              label: 'Total Questions',
              value: quizzes.reduce((acc, q) => acc + q.questions.length, 0),
              color: 'text-blue-600',
              bgColor: 'bg-blue-50',
            },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl p-4 ${stat.bgColor}`}>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-sm text-gray-600 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Sessions chart */}
        <Card title="Sessions (Last 7 Days)" className="mb-8">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sessionsChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={{ fill: '#7C3AED', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Quizzes */}
          <Card
            title="My Quizzes"
            actions={
              <Link to="/quiz/create" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                + Add New
              </Link>
            }
          >
            {isLoadingQuizzes ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : quizzes.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">No quizzes yet.</p>
                <Link to="/quiz/create" className="text-primary-600 text-sm font-medium hover:underline mt-1 block">
                  Create your first quiz
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{quiz.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''} · {formatDate(quiz.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartGame(quiz.id)}
                        disabled={isStartingGame === quiz.id}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                        title="Start game"
                      >
                        {isStartingGame === quiz.id ? (
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                      <Link
                        to={`/quiz/${quiz.id}/edit`}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit quiz"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => setDeleteQuizId(quiz.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete quiz"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Sessions */}
          <Card title="Recent Sessions">
            {isLoadingSessions ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">No sessions yet.</p>
                <p className="text-gray-300 text-xs mt-1">Start a game to see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
                    onClick={() =>
                      session.status !== 'finished' && navigate(`/game/host/${session.pin}`)
                    }
                  >
                    <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-accent-700 font-bold text-xs">{session.pin}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {session.quiz_title ?? 'Quiz Session'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {session.player_count ?? 0} player{(session.player_count ?? 0) !== 1 ? 's' : ''} · {formatDate(session.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteQuizId}
        onClose={() => setDeleteQuizId(null)}
        title="Delete Quiz"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Are you sure you want to delete this quiz? This action cannot be undone and all associated sessions will be affected.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteQuizId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteQuiz} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
