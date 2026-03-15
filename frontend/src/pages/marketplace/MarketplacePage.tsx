import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useAuthStore } from '../../store/authStore'
import { marketplaceAPI } from '../../lib/api'
import type { Quiz } from '../../types'
import PAELogo from '../../components/ui/PAELogo'

const CATEGORIES = ['All', 'Science', 'Math', 'History', 'Language', 'Geography', 'Technology', 'Arts', 'Other']

const CATEGORY_COLORS: Record<string, string> = {
  Science: 'from-emerald-500 to-teal-600',
  Math: 'from-blue-500 to-indigo-600',
  History: 'from-amber-500 to-orange-600',
  Language: 'from-violet-500 to-purple-600',
  Geography: 'from-cyan-500 to-sky-600',
  Technology: 'from-rose-500 to-pink-600',
  Arts: 'from-fuchsia-500 to-pink-600',
  Other: 'from-gray-500 to-slate-600',
}

function getCategoryGradient(category?: string) {
  if (!category) return 'from-violet-500 to-indigo-600'
  return CATEGORY_COLORS[category] ?? 'from-violet-500 to-indigo-600'
}

export default function MarketplacePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')

  const fetchQuizzes = useCallback(async (category: string, q: string) => {
    setLoading(true)
    try {
      const result = await marketplaceAPI.list(
        category === 'All' ? '' : category,
        q,
      )
      setQuizzes(result ?? [])
    } catch {
      setQuizzes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuizzes(activeCategory, search)
  }, [activeCategory, search, fetchQuizzes])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // GSAP card entrance
  useEffect(() => {
    if (loading) return
    const ctx = gsap.context(() => {
      gsap.from('.mkt-card', {
        opacity: 0, y: 28, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'all',
      })
    }, containerRef)
    return () => ctx.revert()
  }, [loading, quizzes.length])

  const handleCopy = async (quiz: Quiz) => {
    if (!user || user.role !== 'teacher') {
      navigate('/login')
      return
    }
    setCopyingId(quiz.id)
    try {
      await marketplaceAPI.copy(quiz.id)
      setCopiedId(quiz.id)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // ignore
    } finally {
      setCopyingId(null)
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white"
      ref={containerRef}
    >
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="animate-blobFloat absolute top-[-8%] left-[-4%] w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/"><PAELogo variant="dark" size="sm" /></Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-sm text-white/50 hover:text-white/80 transition-colors hidden sm:block"
            >
              Dashboard
            </Link>
            {user?.role === 'teacher' && (
              <Link
                to="/quiz/create"
                className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                + New Quiz
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/15 border border-violet-500/25 rounded-full text-violet-300 text-xs font-semibold mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Quiz Marketplace
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Discover & Share Quizzes
          </h1>
          <p className="text-white/40 max-w-lg mx-auto text-sm">
            Browse publicly shared quizzes from teachers worldwide. Copy any quiz to your library in one click.
          </p>
        </div>

        {/* Search + filters */}
        <div className="mb-6 space-y-4">
          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search quizzes…"
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-white/30 text-xs mb-4 text-center">
            {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} found
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-white/30 text-sm">No quizzes found.</p>
            {user?.role === 'teacher' && (
              <p className="text-white/20 text-xs mt-1">
                Be the first to{' '}
                <Link to="/quiz/create" className="text-violet-400 hover:underline">create and publish</Link>{' '}
                a quiz!
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map(quiz => (
              <div
                key={quiz.id}
                className="mkt-card group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden hover:border-white/20 hover:bg-white/8 transition-all duration-300"
              >
                {/* Gradient top bar */}
                <div className={`h-1.5 bg-gradient-to-r ${getCategoryGradient(quiz.category)}`} />

                <div className="p-5">
                  {/* Category + usage */}
                  <div className="flex items-center justify-between mb-3">
                    {quiz.category ? (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r ${getCategoryGradient(quiz.category)} text-white`}>
                        {quiz.category}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white/40">
                        General
                      </span>
                    )}
                    {quiz.usage_count > 0 && (
                      <div className="flex items-center gap-1 text-white/30 text-xs">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {quiz.usage_count} cop{quiz.usage_count !== 1 ? 'ies' : 'y'}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-white text-base leading-snug mb-1 line-clamp-2">
                    {quiz.title}
                  </h3>

                  {/* Description */}
                  {quiz.description && (
                    <p className="text-white/40 text-xs leading-relaxed line-clamp-2 mb-3">
                      {quiz.description}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-[10px] text-white/30 mb-4">
                    <span>{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
                    {quiz.teacher_name && <span>by {quiz.teacher_name}</span>}
                  </div>

                  {/* CTA */}
                  {user?.role === 'teacher' ? (
                    <button
                      onClick={() => handleCopy(quiz)}
                      disabled={copyingId === quiz.id}
                      className={`w-full py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        copiedId === quiz.id
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40'
                      } disabled:opacity-60`}
                    >
                      {copyingId === quiz.id ? (
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : copiedId === quiz.id ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied to Library!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy to My Library
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 rounded-2xl text-xs font-semibold text-center bg-white/5 border border-white/10 text-white/40">
                      {user ? 'Teachers can copy this quiz' : (
                        <Link to="/login" className="text-violet-400 hover:underline">Login to copy</Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
