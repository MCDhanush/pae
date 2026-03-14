import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { gameAPI } from '../../lib/api'
import { useGameStore } from '../../store/gameStore'
import type { LeaderboardEntry } from '../../types'

interface QuestionStat {
  question_id: string; text: string
  correct_count: number; total_answers: number; avg_time_taken: number
}
interface ResultsData {
  session_id: string; quiz_title: string
  total_players: number; total_questions: number
  leaderboard: LeaderboardEntry[]; question_stats: QuestionStat[]
}

type Tab = 'leaderboard' | 'questions'

const RANK_COLORS = ['text-amber-400', 'text-slate-400', 'text-amber-700']
const PODIUM_HEIGHTS = ['h-24', 'h-32', 'h-20'] // [2nd, 1st, 3rd]
const PODIUM_GRADIENTS = [
  'from-slate-600 to-slate-500',
  'from-amber-600 to-yellow-500',
  'from-amber-900 to-amber-700',
]

function RankIcon({ rank }: { rank: number }) {
  if (rank === 0) return (
    <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l3.057-3 3.943 7.9L15.943 0 19 3l-2 8H7L5 3zm2 9h10l1 9H6l1-9z" />
    </svg>
  )
  if (rank === 1) return (
    <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l3.057-3 3.943 7.9L15.943 0 19 3l-2 8H7L5 3zm2 9h10l1 9H6l1-9z" />
    </svg>
  )
  if (rank === 2) return (
    <svg className="w-5 h-5 text-amber-700" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l3.057-3 3.943 7.9L15.943 0 19 3l-2 8H7L5 3zm2 9h10l1 9H6l1-9z" />
    </svg>
  )
  return <span className="text-white/30 text-sm font-bold">#{rank + 1}</span>
}

export default function ResultsPage() {
  const { pin } = useParams<{ pin: string }>()
  const navigate = useNavigate()
  const { myPlayerID } = useGameStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [data, setData] = useState<ResultsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard')

  useEffect(() => {
    if (!pin) return
    setIsLoading(true)
    gameAPI.getResults(pin)
      .then(setData)
      .catch(() => setError('Could not load results. The game may not exist or has been deleted.'))
      .finally(() => setIsLoading(false))
  }, [pin])

  // GSAP entry animations after data loads
  useEffect(() => {
    if (!data || !containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.from('.gsap-stat', { opacity: 0, y: 20, duration: 0.4, stagger: 0.08, ease: 'power2.out' })
      gsap.from('.gsap-podium-col', { opacity: 0, y: 40, duration: 0.5, stagger: 0.1, ease: 'back.out(1.4)', delay: 0.3 })
      gsap.from('.gsap-row', { opacity: 0, x: -20, duration: 0.35, stagger: 0.06, ease: 'power2.out', delay: 0.5 })
    }, containerRef)
    return () => ctx.revert()
  }, [data])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full border-2 border-violet-500/50 border-t-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">Loading results…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Results Unavailable</h2>
          <p className="text-white/40 text-sm">{error ?? 'Something went wrong.'}</p>
          <button onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 bg-white/10 border border-white/15 rounded-xl text-white text-sm font-semibold hover:bg-white/15 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const top3 = data.leaderboard.slice(0, 3)
  // Podium order: [2nd, 1st, 3rd]
  const podiumOrder = [top3[1], top3[0], top3[2]]
  const podiumRankIndex = [1, 0, 2]

  const avgScore = data.leaderboard.length
    ? Math.round(data.leaderboard.reduce((a, e) => a + e.score, 0) / data.leaderboard.length)
    : 0

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors text-sm font-medium group">
            <div className="w-7 h-7 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span className="hidden sm:block">Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white/30 text-xs">PIN</span>
            <span className="text-base font-black tracking-[0.25em] text-violet-300">{pin}</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Title */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-500/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">{data.quiz_title}</h1>
          <p className="text-white/40 text-sm mt-1">
            {data.total_players} player{data.total_players !== 1 ? 's' : ''} · {data.total_questions} question{data.total_questions !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Players', value: data.total_players, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'from-violet-500 to-purple-600' },
            { label: 'Questions', value: data.total_questions, icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-indigo-500 to-blue-600' },
            { label: 'Avg Score', value: avgScore.toLocaleString(), icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'from-amber-500 to-orange-600' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="gsap-stat bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-2`}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </div>
              <p className="text-xl font-black text-white">{value}</p>
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Podium */}
        {top3.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest text-center mb-6">Top Players</h2>
            <div className="flex items-end justify-center gap-4">
              {podiumOrder.map((entry, pos) => {
                if (!entry) return <div key={pos} className="w-28 flex-1 max-w-[120px]" />
                const rankIdx = podiumRankIndex[pos]
                return (
                  <div key={entry.player_id} className="gsap-podium-col flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-bold text-sm`}>
                      {entry.nickname.charAt(0).toUpperCase()}
                    </div>
                    <RankIcon rank={rankIdx} />
                    <p className="text-xs font-bold text-white/80 text-center truncate w-full">{entry.nickname}</p>
                    <p className="text-xs text-violet-300 font-black">{entry.score.toLocaleString()}</p>
                    <div className={`w-full ${PODIUM_HEIGHTS[pos]} bg-gradient-to-t ${PODIUM_GRADIENTS[pos]} rounded-t-xl flex items-center justify-center`}>
                      <span className="text-white/70 font-black text-lg">#{rankIdx + 1}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="flex gap-1 bg-white/5 border border-white/10 p-1 rounded-2xl w-fit mb-5">
            {(['leaderboard', 'questions'] as Tab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {tab === 'leaderboard' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  )}
                </svg>
                {tab === 'leaderboard' ? 'Leaderboard' : 'Question Stats'}
              </button>
            ))}
          </div>

          {/* LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              {data.leaderboard.length === 0 ? (
                <p className="text-center text-white/30 py-12 text-sm">No players recorded.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs font-bold text-white/30 px-5 py-3 w-10">#</th>
                      <th className="text-left text-xs font-bold text-white/30 px-4 py-3">Player</th>
                      <th className="text-right text-xs font-bold text-white/30 px-5 py-3">Score</th>
                      <th className="text-right text-xs font-bold text-white/30 px-5 py-3 hidden sm:table-cell">Correct</th>
                      <th className="text-right text-xs font-bold text-white/30 px-5 py-3 hidden md:table-cell">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((entry, i) => {
                      const isMe = entry.player_id === myPlayerID
                      const inTop3 = i < 3
                      return (
                        <tr key={entry.player_id}
                          className={`gsap-row border-b border-white/5 last:border-0 transition-colors ${isMe ? 'bg-violet-500/10' : 'hover:bg-white/5'}`}>
                          <td className="px-5 py-3.5">
                            {inTop3
                              ? <RankIcon rank={i} />
                              : <span className="text-white/25 font-bold text-sm">{i + 1}</span>
                            }
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                                {entry.nickname.charAt(0).toUpperCase()}
                              </div>
                              <span className={`font-semibold text-sm ${inTop3 ? RANK_COLORS[i] : 'text-white/90'} ${isMe ? 'text-violet-300' : ''}`}>
                                {entry.nickname}
                              </span>
                              {isMe && (
                                <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-bold">You</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-white">{entry.score.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-right text-white/40 text-sm hidden sm:table-cell">
                            {entry.correct_answers ?? '—'}/{data.total_questions}
                          </td>
                          <td className="px-5 py-3.5 text-right text-white/40 text-sm hidden md:table-cell">
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

          {/* QUESTION STATS */}
          {activeTab === 'questions' && (
            <div className="space-y-3">
              {data.question_stats.length === 0 ? (
                <p className="text-center text-white/30 py-12 text-sm">No question stats available.</p>
              ) : (
                data.question_stats.map((stat, i) => {
                  const pct = stat.total_answers > 0 ? Math.round((stat.correct_count / stat.total_answers) * 100) : 0
                  const difficulty = pct >= 70 ? 'easy' : pct >= 40 ? 'medium' : 'hard'
                  const diffStyles = {
                    easy: { badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', bar: 'bg-emerald-500' },
                    medium: { badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300', bar: 'bg-amber-500' },
                    hard: { badge: 'bg-red-500/15 border-red-500/30 text-red-300', bar: 'bg-red-500' },
                  }[difficulty]
                  return (
                    <div key={stat.question_id} className="gsap-row bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-white/80 text-sm font-medium leading-snug">{stat.text}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${diffStyles.badge}`}>
                          {difficulty}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-white/30 mb-1.5">
                          <span>{stat.correct_count} correct of {stat.total_answers}</span>
                          <span className="font-bold text-white/70">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${diffStyles.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-white/25">
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
          <button onClick={() => navigate('/dashboard')}
            className="flex-1 py-3 bg-white/10 border border-white/15 rounded-2xl text-white font-semibold text-sm hover:bg-white/15 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <button onClick={() => navigate('/')}
            className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            New Game
          </button>
        </div>
      </main>
    </div>
  )
}
