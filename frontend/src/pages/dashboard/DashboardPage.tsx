import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import gsap from 'gsap'
import { useAuthStore } from '../../store/authStore'
import { quizAPI, gameAPI, sessionAPI } from '../../lib/api'
import type { Quiz, SessionWithQuiz, Player } from '../../types'
import type { UpdateProfilePayload } from '../../types'
import PAELogo from '../../components/ui/PAELogo'

type Tab = 'overview' | 'sessions' | 'profile'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<string, string> = {
  waiting: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  active: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  finished: 'bg-white/10 border-white/20 text-white/50',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout, updateProfile, isLoading: authLoading, error: authError, clearError } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<Tab>('overview')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<SessionWithQuiz[]>([])
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStartingGame, setIsStartingGame] = useState<string | null>(null)

  // Session detail
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [sessionPlayers, setSessionPlayers] = useState<Record<string, Player[]>>({})
  const [loadingPlayers, setLoadingPlayers] = useState<string | null>(null)

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    institution: user?.institution ?? '',
    institution_type: user?.institution_type ?? '',
    location: user?.location ?? '',
    years_of_exp: user?.years_of_exp?.toString() ?? '',
    bio: user?.bio ?? '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoadingQuizzes(true)
    setIsLoadingSessions(true)
    try {
      const [quizList, sessionList] = await Promise.all([quizAPI.list(), sessionAPI.list()])
      setQuizzes(quizList ?? [])
      setSessions(sessionList ?? [])
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setIsLoadingQuizzes(false)
      setIsLoadingSessions(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // GSAP tab change animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gsap-tab-content', {
        opacity: 0,
        y: 20,
        duration: 0.4,
        ease: 'power2.out',
        clearProps: 'all',  // ← never stays invisible
      })
      gsap.from('.gsap-card', {
        opacity: 0,
        y: 24,
        duration: 0.4,
        stagger: { each: 0.07, ease: 'power1.inOut' },
        ease: 'power2.out',
        delay: 0.05,
        clearProps: 'all',  // ← never stays invisible
      })
    }, containerRef)

    return () => ctx.revert()
  }, [tab])

  // Sync profile form when user loads
  useEffect(() => {
    if (user) {
      setProfileForm(f => ({
        ...f,
        name: user.name ?? '',
        institution: user.institution ?? '',
        institution_type: user.institution_type ?? '',
        location: user.location ?? '',
        years_of_exp: user.years_of_exp?.toString() ?? '',
        bio: user.bio ?? '',
      }))
    }
  }, [user])

  const handleDeleteQuiz = async () => {
    if (!deleteQuizId) return
    setIsDeleting(true)
    try {
      await quizAPI.delete(deleteQuizId)
      setQuizzes(prev => prev.filter(q => q.id !== deleteQuizId))
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

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
      return
    }
    setExpandedSessionId(sessionId)
    if (sessionPlayers[sessionId]) return
    setLoadingPlayers(sessionId)
    try {
      const players = await sessionAPI.getPlayers(sessionId)
      setSessionPlayers(prev => ({ ...prev, [sessionId]: players ?? [] }))
    } catch {
      setSessionPlayers(prev => ({ ...prev, [sessionId]: [] }))
    } finally {
      setLoadingPlayers(null)
    }
  }

  const handleProfileSave = async () => {
    setProfileError(null)
    clearError()
    if (profileForm.new_password && profileForm.new_password !== profileForm.confirm_password) {
      setProfileError('New passwords do not match')
      return
    }
    const payload: UpdateProfilePayload = {
      name: profileForm.name || undefined,
      institution: profileForm.institution || undefined,
      institution_type: profileForm.institution_type || undefined,
      location: profileForm.location || undefined,
      years_of_exp: profileForm.years_of_exp ? parseInt(profileForm.years_of_exp) : undefined,
      bio: profileForm.bio || undefined,
      current_password: profileForm.current_password || undefined,
      new_password: profileForm.new_password || undefined,
    }
    try {
      await updateProfile(payload)
      setProfileSaved(true)
      setProfileForm(f => ({ ...f, current_password: '', new_password: '', confirm_password: '' }))
      setTimeout(() => setProfileSaved(false), 3000)
    } catch {
      // error from store
    }
  }

  const sessionsChartData = (() => {
    const days: Record<string, number> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0
    }
    sessions.forEach(s => {
      const key = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (key in days) days[key]++
    })
    return Object.entries(days).map(([date, sessions]) => ({ date, sessions }))
  })()

  const stats = [
    { label: 'My Quizzes', value: quizzes.length, iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'from-violet-500 to-purple-600' },
    { label: 'Total Sessions', value: sessions.length, iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-indigo-500 to-blue-600' },
    { label: 'Active Now', value: sessions.filter(s => s.status === 'active').length, iconPath: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 8v4l2 2m4-2a8 8 0 11-16 0 8 8 0 0116 0z', color: 'from-rose-500 to-pink-600' },
    { label: 'Total Questions', value: quizzes.reduce((a, q) => a + q.questions.length, 0), iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-amber-500 to-orange-600' },
  ]

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'sessions', label: 'Sessions', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white" ref={containerRef}>
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")` }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <PAELogo variant="dark" size="sm" />

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-white/80">{user?.name}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/') }}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Welcome + Create */}
        <div className="animate-fadeInDown flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          {user?.role === 'teacher' && (
            <Link
              to="/quiz/create"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Quiz
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="animate-fadeInUp flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 mb-6 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="gsap-tab-content space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map(stat => (
                <div key={stat.label} className="gsap-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.iconPath} />
                    </svg>
                  </div>
                  <p className="text-2xl font-black text-white">{stat.value}</p>
                  <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Sessions (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={sessionsChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                  <Line type="monotone" dataKey="sessions" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* My Quizzes — teachers only */}
            {user?.role === 'teacher' && <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">My Quizzes</h3>
                <Link to="/quiz/create" className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                  + New Quiz
                </Link>
              </div>
              {isLoadingQuizzes ? (
                <div className="p-5 space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}
                </div>
              ) : quizzes.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-white/30 text-sm">No quizzes yet.</p>
                  <Link to="/quiz/create" className="text-violet-400 text-sm font-medium hover:underline mt-1 block">Create your first quiz</Link>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {quizzes.map(quiz => (
                    <div key={quiz.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors group">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white/90 text-sm truncate">{quiz.title}</p>
                        <p className="text-xs text-white/30 mt-0.5">{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''} · {formatDate(quiz.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartGame(quiz.id)}
                          disabled={isStartingGame === quiz.id}
                          className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Start game"
                        >
                          {isStartingGame === quiz.id ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <Link to={`/quiz/${quiz.id}/edit`} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit quiz">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button onClick={() => setDeleteQuizId(quiz.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete quiz">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {/* Student message */}
            {user?.role === 'student' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-white font-bold mb-2">Welcome, Student!</h3>
                <p className="text-white/40 text-sm mb-5">View your previous quiz attempts in the Sessions tab.</p>
                <button
                  onClick={() => setTab('sessions')}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  View My Attempts
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === 'sessions' && (
          <div className="gsap-tab-content space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">All Sessions</h2>
              <span className="text-sm text-white/40">{sessions.length} total</span>
            </div>

            {isLoadingSessions ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">No sessions yet. Start a game from your quizzes.</p>
              </div>
            ) : (
              sessions.map(session => (
                <div key={session.id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left"
                    onClick={() => handleExpandSession(session.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <span className="text-indigo-300 font-bold text-xs">{session.pin}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white/90 text-sm truncate">{session.quiz_title ?? 'Quiz Session'}</p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {session.player_count ?? 0} player{(session.player_count ?? 0) !== 1 ? 's' : ''} · {formatDate(session.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold capitalize ${STATUS_STYLES[session.status] ?? STATUS_STYLES.waiting}`}>
                        {session.status}
                      </span>
                      {session.status !== 'finished' && (
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/game/host/${session.pin}`) }}
                          className="px-3 py-1 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs font-semibold hover:bg-violet-500/30 transition-colors"
                        >
                          Resume
                        </button>
                      )}
                      <svg className={`w-4 h-4 text-white/30 transition-transform ${expandedSessionId === session.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded: participant list */}
                  {expandedSessionId === session.id && (
                    <div className="border-t border-white/10 px-5 py-4">
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Participants</h4>
                      {loadingPlayers === session.id ? (
                        <div className="flex gap-1">
                          {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                        </div>
                      ) : (sessionPlayers[session.id] ?? []).length === 0 ? (
                        <p className="text-white/30 text-xs">No participants recorded.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(sessionPlayers[session.id] ?? []).map(p => (
                            <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[9px] font-bold">
                                {p.nickname.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs text-white/70 font-medium">{p.nickname}</span>
                              <span className="text-[10px] text-violet-300 font-bold ml-1">{p.score}pts</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {session.status === 'finished' && (
                        <button
                          onClick={() => navigate(`/results/${session.pin}`)}
                          className="mt-3 text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                        >
                          View Full Results →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div className="gsap-tab-content max-w-xl space-y-5">
            <h2 className="text-lg font-bold text-white">Profile Settings</h2>

            {/* Account info */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Account Info</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 font-medium block mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 font-medium block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    className="w-full px-3 py-2.5 bg-white/3 border border-white/10 rounded-xl text-white/40 text-sm cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Teacher profile */}
            {user?.role === 'teacher' && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Teacher Profile</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Institution</label>
                    <input
                      type="text"
                      value={profileForm.institution}
                      onChange={e => setProfileForm(f => ({ ...f, institution: e.target.value }))}
                      placeholder="School / College name"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Institution Type</label>
                    <select
                      value={profileForm.institution_type}
                      onChange={e => setProfileForm(f => ({ ...f, institution_type: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                    >
                      <option value="" className="bg-gray-900">Select type</option>
                      <option value="school" className="bg-gray-900">School</option>
                      <option value="college" className="bg-gray-900">College</option>
                      <option value="university" className="bg-gray-900">University</option>
                      <option value="other" className="bg-gray-900">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Location</label>
                    <input
                      type="text"
                      value={profileForm.location}
                      onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="City, Country"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Years of Experience</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={profileForm.years_of_exp}
                      onChange={e => setProfileForm(f => ({ ...f, years_of_exp: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 font-medium block mb-1.5">Bio</label>
                  <textarea
                    rows={3}
                    value={profileForm.bio}
                    onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                    placeholder="Tell students a bit about yourself…"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all resize-none"
                  />
                </div>
              </div>
            )}

            {/* Change password */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Change Password</h3>
              <p className="text-xs text-white/30">Leave blank to keep your current password.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 font-medium block mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={profileForm.current_password}
                    onChange={e => setProfileForm(f => ({ ...f, current_password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={profileForm.new_password}
                      onChange={e => setProfileForm(f => ({ ...f, new_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 font-medium block mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={profileForm.confirm_password}
                      onChange={e => setProfileForm(f => ({ ...f, confirm_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Errors + success */}
            {(profileError || authError) && (
              <div className="p-4 bg-red-500/15 border border-red-500/25 rounded-2xl text-red-300 text-sm">
                {profileError || authError}
              </div>
            )}
            {profileSaved && (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/25 rounded-2xl text-emerald-300 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Profile saved successfully!
              </div>
            )}

            <button
              onClick={handleProfileSave}
              disabled={authLoading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteQuizId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteQuizId(null)} />
          <div className="relative bg-gray-900 border border-white/15 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Quiz</h3>
            <p className="text-white/50 text-sm mb-5">Are you sure? This action cannot be undone and all associated sessions will be affected.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteQuizId(null)}
                className="flex-1 py-2.5 bg-white/10 border border-white/15 rounded-xl text-white text-sm font-semibold hover:bg-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuiz}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 rounded-xl text-white text-sm font-bold hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
