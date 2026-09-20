import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useAuthStore } from '../../store/authStore'
import { marketplaceAPI, quizAPI } from '../../lib/api'
import type { Quiz } from '../../types'
import PAELogo from '../../components/ui/PAELogo'

const CATEGORIES = ['All', 'Science', 'Math', 'History', 'Language', 'Geography', 'Technology', 'Arts', 'Other']

const CATEGORY_COLORS: Record<string, string> = {
  Science: 'from-[#bfe4df] to-[#d9f1ef]',
  Math: 'from-[#c9e3f0] to-[#dbeaf6]',
  History: 'from-[#f6dfaa] to-[#fff1c7]',
  Language: 'from-[#bfe4df] to-[#c9e3f0]',
  Geography: 'from-[#c9e3f0] to-[#edf7fb]',
  Technology: 'from-[#f4c7c3] to-[#ffe7e3]',
  Arts: 'from-[#f6dfaa] to-[#fcefd0]',
  Other: 'from-[#dbe7ea] to-[#edf2f3]',
}

function getCategoryGradient(category?: string) {
  if (!category) return 'from-[#0f6b78] to-[#2874d0]'
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Other']
}

function getCategoryTextColor(category?: string) {
  const normalized = category?.trim().toLowerCase()
  if (normalized === 'math' || normalized === 'accountancy' || normalized === 'accounting') return 'text-[#23638f]'
  if (normalized === 'science' || normalized === 'language') return 'text-[#0b5262]'
  if (normalized === 'history' || normalized === 'arts') return 'text-[#7a5b13]'
  if (normalized === 'technology') return 'text-[#8d3f49]'
  return 'text-[#526b78]'
}

export default function MarketplacePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [importingId, setImportingId] = useState<string | null>(null)
  // Set of marketplace quiz IDs already imported by this teacher
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
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

  // Load already-imported source IDs for this teacher
  useEffect(() => {
    if (user?.role !== 'teacher') return
    quizAPI.list().then(list => {
      const ids = new Set<string>()
      list.forEach(q => { if (q.source_id) ids.add(q.source_id) })
      setImportedIds(ids)
    }).catch(() => {})
  }, [user])

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

  const handleImport = async (quiz: Quiz) => {
    if (!user || user.role !== 'teacher') {
      navigate('/login')
      return
    }
    if (importedIds.has(quiz.id)) return
    setImportingId(quiz.id)
    try {
      await marketplaceAPI.import(quiz.id)
      setImportedIds(prev => new Set(prev).add(quiz.id))
    } catch {
      // ignore (409 = already imported, handled via importedIds)
    } finally {
      setImportingId(null)
    }
  }

  return (
    <div
      className="route-light min-h-screen max-w-full overflow-x-hidden border-t-2 border-[#e5a92f]/70 bg-gradient-to-br from-[#fffdf8] via-[#f6faf9] to-[#eaf4f7]"
      ref={containerRef}
    >
      {/* Background blobs */}
      <div className="fixed inset-0 max-w-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-8%] left-[-4%] h-[500px] w-[500px] max-w-[80vw] rounded-full bg-[#0f8f7c]/20 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-[400px] w-[400px] max-w-[70vw] rounded-full bg-[#2874d0]/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 sticky top-0 border-b border-white/10 bg-[#102f3b]/90 shadow-[0_4px_18px_rgba(6,47,60,0.25)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="rounded-xl px-2 py-1"><PAELogo variant="light" size="sm" /></Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-sm font-semibold text-white/70 transition-colors hover:text-[#b8eee7]"
            >
              Dashboard
            </Link>
            {user?.role === 'teacher' && (
              <Link
                to="/quiz/create"
                className="rounded-xl bg-[#d9f1ef] px-3 py-1.5 text-xs font-bold text-[#0b5262] shadow-sm transition-colors hover:bg-[#c4e8e5]"
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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#9ecbc9] bg-[#d9f1ef] px-3 py-1 text-xs font-semibold text-[#0b5262] shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Quiz Marketplace
          </div>
          <h1 className="mb-2 text-3xl font-black text-white sm:text-4xl">
            Discover & Share Quizzes
          </h1>
          <p className="mx-auto max-w-lg text-sm text-white/55">
            Browse publicly shared quizzes from teachers worldwide. Import any quiz to your library in one click.
          </p>
        </div>

        {/* Search + filters */}
        <div className="mb-6 space-y-4">
          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search quizzes…"
              className="w-full rounded-2xl border border-white/15 bg-white/10 py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 shadow-sm transition-all focus:border-[#6bc7bf]/60 focus:bg-white/15 focus:outline-none"
            />
          </div>

          {/* Category pills */}
          <div className="flex max-w-full gap-2 flex-wrap justify-center overflow-hidden px-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-[#0f8f7c] text-white shadow-lg shadow-[#0f8f7c]/30'
                    : 'border border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="mb-4 text-center text-xs text-white/35">
            {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} found
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5" />
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/35">No quizzes found.</p>
            {user?.role === 'teacher' && (
              <p className="text-white/20 text-xs mt-1">
                Be the first to{' '}
                <Link to="/quiz/create" className="text-violet-400 hover:underline">create and publish</Link>{' '}
                a quiz for others to import!
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map(quiz => (
              <div
                key={quiz.id}
                className="mkt-card group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:shadow-lg"
              >
                {/* Gradient top bar */}
                <div className={`h-1.5 bg-gradient-to-r ${getCategoryGradient(quiz.category)}`} />

                {/* Clickable content area → preview page */}
                <button
                  onClick={() => navigate(`/marketplace/${quiz.id}`, { state: { quiz } })}
                  className="w-full text-left p-5 pb-3 block"
                >
                  {/* Category + usage */}
                  <div className="flex items-center justify-between mb-3">
                    {quiz.category ? (
                      <span className={`rounded-full border border-white/70 bg-gradient-to-r px-2.5 py-1 text-[10px] font-bold ${getCategoryGradient(quiz.category)} ${getCategoryTextColor(quiz.category)}`}>
                        {quiz.category}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/50">
                        General
                      </span>
                    )}
                    {quiz.usage_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-white/30">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {quiz.usage_count} import{quiz.usage_count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="mb-1 line-clamp-2 text-base font-bold leading-snug text-white transition-colors group-hover:text-[#0f6b78]">
                    {quiz.title}
                  </h3>

                  {/* Description */}
                  {quiz.description && (
                    <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-white/40">
                      {quiz.description}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-[10px] text-white/30">
                    <span>{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
                    {quiz.teacher_name && <span>by {quiz.teacher_name}</span>}
                  </div>
                </button>

                {/* CTA row */}
                <div className="px-5 pb-5 pt-2 flex gap-2">
                  {/* Preview button – always visible */}
                  <button
                    onClick={() => navigate(`/marketplace/${quiz.id}`, { state: { quiz } })}
                    className="flex-1 rounded-2xl border border-white/12 bg-white/8 py-2.5 text-xs font-semibold text-white/60 transition-all hover:bg-white/15 hover:text-white flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview
                  </button>

                  {/* Import – teachers only */}
                  {user?.role === 'teacher' && (
                    <button
                      onClick={() => handleImport(quiz)}
                      disabled={importingId === quiz.id || importedIds.has(quiz.id)}
                      className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        importedIds.has(quiz.id)
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 cursor-default'
                          : 'bg-[#d9f1ef] text-[#0b5262] shadow-sm hover:bg-[#c4e8e5] disabled:opacity-60'
                      }`}
                    >
                      {importingId === quiz.id ? (
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : importedIds.has(quiz.id) ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Imported
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Import
                        </>
                      )}
                    </button>
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
