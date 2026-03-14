import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import gsap from 'gsap'
import {
  BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAuthStore } from '../../store/authStore'
import { analyticsAPI, sessionAPI } from '../../lib/api'
import type { SessionAnalytics, TeacherAnalyticsOverview, SessionWithQuiz } from '../../types'
import PAELogo from '../../components/ui/PAELogo'

type AnalyticsView = 'overview' | 'session'

const ACCURACY_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6']

function AccuracyBadge({ pct }: { pct: number }) {
  const cls = pct >= 70 ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : pct >= 40 ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : 'text-red-300 bg-red-500/15 border-red-500/30'
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cls}`}>
      {pct.toFixed(0)}%
    </span>
  )
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [view, setView] = useState<AnalyticsView>('overview')
  const [overview, setOverview] = useState<TeacherAnalyticsOverview | null>(null)
  const [sessions, setSessions] = useState<SessionWithQuiz[]>([])
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect students
  useEffect(() => {
    if (user && user.role !== 'teacher') navigate('/dashboard')
  }, [user, navigate])

  useEffect(() => {
    Promise.all([
      analyticsAPI.getOverview().catch(() => null),
      sessionAPI.list().catch(() => []),
    ]).then(([ov, ss]) => {
      setOverview(ov)
      setSessions(ss as SessionWithQuiz[])
      setLoading(false)
    }).catch(() => {
      setError('Failed to load analytics')
      setLoading(false)
    })
  }, [])

  const loadSession = useCallback(async (id: string) => {
    setSessionLoading(true)
    setView('session')
    try {
      const data = await analyticsAPI.getSession(id)
      setSessionAnalytics(data)
    } catch {
      setError('Failed to load session analytics')
    } finally {
      setSessionLoading(false)
    }
  }, [])

  // GSAP entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gsap-card', {
        opacity: 0, y: 24, duration: 0.5, stagger: 0.08, ease: 'power2.out', clearProps: 'all',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [view, loading])

  const finishedSessions = sessions.filter(s => s.status === 'finished')

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 text-white"
    >
      {/* Blob bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="animate-blobFloat absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard"><PAELogo variant="dark" size="sm" /></Link>
            <div className="h-5 w-px bg-white/15 hidden sm:block" />
            <span className="font-bold text-white/80 text-sm hidden sm:block">Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Page heading */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">Analytics Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">Deep insights into your quiz sessions and student performance.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/15 border border-red-500/25 rounded-2xl text-red-300 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* ── OVERVIEW STATS ── */}
            {view === 'overview' && (
              <div className="space-y-8">
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Quizzes',
                      value: overview?.total_quizzes ?? 0,
                      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
                      color: 'from-violet-500 to-purple-600',
                    },
                    {
                      label: 'Total Sessions',
                      value: overview?.total_sessions ?? finishedSessions.length,
                      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
                      color: 'from-amber-400 to-orange-500',
                    },
                    {
                      label: 'Total Students',
                      value: overview?.total_students ?? 0,
                      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
                      color: 'from-sky-500 to-blue-600',
                    },
                    {
                      label: 'Avg Score',
                      value: Math.round(overview?.avg_score_all_sessions ?? 0),
                      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                      color: 'from-emerald-500 to-teal-600',
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="gsap-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                        </svg>
                      </div>
                      <p className="text-2xl font-black text-white">{stat.value.toLocaleString()}</p>
                      <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Sessions per month chart */}
                {overview?.sessions_per_month && overview.sessions_per_month.length > 0 && (
                  <div className="gsap-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-6">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-5">Sessions Per Month</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={overview.sessions_per_month} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="count" name="Sessions" stroke="#7C3AED" strokeWidth={2.5} dot={{ fill: '#7C3AED', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Session list */}
                <div className="gsap-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Sessions — Click to Analyze</h3>
                  </div>
                  {finishedSessions.length === 0 ? (
                    <div className="py-14 text-center text-white/30 text-sm">No finished sessions yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {finishedSessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s.id)}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white/90 text-sm truncate">{s.quiz_title ?? 'Quiz Session'}</p>
                            <p className="text-xs text-white/30 mt-0.5">PIN: {s.pin} · {s.player_count ?? '?'} players</p>
                          </div>
                          <svg className="w-4 h-4 text-white/20 group-hover:text-violet-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SESSION ANALYTICS ── */}
            {view === 'session' && (
              <div className="space-y-8">
                {/* Back */}
                <button
                  onClick={() => { setView('overview'); setSessionAnalytics(null) }}
                  className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  All Sessions
                </button>

                {sessionLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />)}
                  </div>
                ) : sessionAnalytics ? (
                  <>
                    {/* Session header */}
                    <div>
                      <h2 className="text-2xl font-black text-white">{sessionAnalytics.quiz_title}</h2>
                      <p className="text-white/40 text-sm mt-1">
                        {sessionAnalytics.total_players} players · {sessionAnalytics.total_questions} questions
                      </p>
                    </div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Total Players', value: sessionAnalytics.total_players, color: 'from-violet-500 to-purple-600' },
                        { label: 'Avg Score', value: Math.round(sessionAnalytics.avg_score), color: 'from-amber-400 to-orange-500' },
                        { label: 'Completion Rate', value: `${(sessionAnalytics.completion_rate * 100).toFixed(0)}%`, color: 'from-emerald-500 to-teal-600' },
                        { label: 'Questions', value: sessionAnalytics.total_questions, color: 'from-sky-500 to-blue-600' },
                      ].map((m) => (
                        <div key={m.label} className="gsap-card bg-white/5 border border-white/10 rounded-2xl p-5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${m.color} mb-3`} />
                          <p className="text-2xl font-black text-white">{m.value}</p>
                          <p className="text-xs text-white/40">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Leaderboard */}
                    {sessionAnalytics.leaderboard.length > 0 && (
                      <div className="gsap-card bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/10">
                          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Top Performers</h3>
                        </div>
                        <div className="divide-y divide-white/5">
                          {sessionAnalytics.leaderboard.slice(0, 10).map((e) => (
                            <div key={e.player_id} className="flex items-center gap-3 px-5 py-3">
                              <span className={`text-sm font-black w-6 ${e.rank <= 3 ? 'text-amber-300' : 'text-white/30'}`}>
                                #{e.rank}
                              </span>
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                                {e.nickname.charAt(0).toUpperCase()}
                              </div>
                              <span className="flex-1 text-sm font-medium text-white/80">{e.nickname}</span>
                              <span className="font-black text-amber-300 text-sm">{e.score.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Question difficulty chart */}
                    {sessionAnalytics.question_stats.length > 0 && (
                      <>
                        <div className="gsap-card bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
                          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-5">Question Accuracy</h3>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={sessionAnalytics.question_stats.map((q, i) => ({
                              name: `Q${i + 1}`,
                              accuracy: parseFloat(q.accuracy_pct.toFixed(1)),
                              fill: q.accuracy_pct >= 70 ? '#10B981' : q.accuracy_pct >= 40 ? '#F59E0B' : '#EF4444',
                            }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                              <Tooltip
                                contentStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                                formatter={(v: number) => [`${v}%`, 'Accuracy']}
                              />
                              <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                                {sessionAnalytics.question_stats.map((q, i) => (
                                  <Cell key={i} fill={q.accuracy_pct >= 70 ? '#10B981' : q.accuracy_pct >= 40 ? '#F59E0B' : '#EF4444'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Per-question breakdown */}
                        <div className="gsap-card bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                          <div className="px-5 py-4 border-b border-white/10">
                            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Question Breakdown</h3>
                          </div>
                          <div className="divide-y divide-white/5">
                            {sessionAnalytics.question_stats.map((q, i) => (
                              <div key={q.question_id} className="px-5 py-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <span className="text-xs font-black text-white/40 mt-0.5 shrink-0">Q{i + 1}</span>
                                    <p className="text-sm font-medium text-white/80 line-clamp-2">{q.question_text}</p>
                                  </div>
                                  <AccuracyBadge pct={q.accuracy_pct} />
                                </div>
                                {/* Accuracy bar */}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-700"
                                      style={{
                                        width: `${q.accuracy_pct}%`,
                                        background: q.accuracy_pct >= 70 ? '#10B981' : q.accuracy_pct >= 40 ? '#F59E0B' : '#EF4444',
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-white/40 shrink-0">
                                    {q.correct_count}/{q.total_answers} correct
                                  </span>
                                </div>
                                {/* Answer distribution */}
                                {Object.keys(q.answer_distribution ?? {}).length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(q.answer_distribution).map(([ans, count], ci) => (
                                      <span
                                        key={ans}
                                        className="text-xs px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-white/50"
                                        style={{ borderColor: ACCURACY_COLORS[ci % ACCURACY_COLORS.length] + '40' }}
                                      >
                                        {ans}: {count}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-white/30">No analytics data available for this session.</div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
