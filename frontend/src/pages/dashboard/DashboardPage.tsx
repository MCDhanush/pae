import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import gsap from 'gsap'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import { quizAPI, gameAPI, sessionAPI, studentAPI, playerAPI, paymentAPI, type PlanType } from '../../lib/api'
import type { Quiz, SessionWithQuiz, Player, PlayerAttempt } from '../../types'
import type { UpdateProfilePayload } from '../../types'
import PAELogo from '../../components/ui/PAELogo'

type Tab = 'overview' | 'sessions' | 'profile'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<string, string> = {
  waiting: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  active: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  finished: 'bg-green-500/90 border-white/20 text-white/90',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout, updateProfile, isLoading: authLoading, error: authError, clearError } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const resetGame = useGameStore(s => s.reset)
  const setGamePlayerID = useGameStore(s => s.setMyPlayerID)
  const setGameNickname = useGameStore(s => s.setMyNickname)

  const [tab, setTab] = useState<Tab>('overview')
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<SessionWithQuiz[]>([])
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStartingGame, setIsStartingGame] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradePendingQuizId, setUpgradePendingQuizId] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [showAIUpgradeModal, setShowAIUpgradeModal] = useState(false)
  const [aiUsage, setAIUsage] = useState<{ used: number; limit: number; remaining: number; unlimited?: boolean } | null>(null)

  // Student attempts
  const [attempts, setAttempts] = useState<PlayerAttempt[]>([])
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false)

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
    if (!user) return
    if (user.role === 'teacher') {
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
      quizAPI.getAIUsage().then(setAIUsage).catch(() => {})
    } else {
      // Student: load attempts
      setIsLoadingAttempts(true)
      try {
        const attemptList = await studentAPI.getAttempts()
        setAttempts(attemptList ?? [])
      } catch (err) {
        console.error('Failed to fetch student attempts:', err)
      } finally {
        setIsLoadingAttempts(false)
      }
    }
  }, [user])

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
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        setUpgradePendingQuizId(quizId)
        setShowUpgradeModal(true)
      } else {
        console.error('Failed to create session:', err)
      }
    } finally {
      setIsStartingGame(null)
    }
  }

  const handleUpgrade = async (planType: PlanType) => {
    setIsUpgrading(true)
    try {
      // Load Razorpay script if not already loaded
      if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
          document.head.appendChild(script)
        })
      }

      // Create order on backend
      const order = await paymentAPI.createOrder(planType)

      // Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay
        const rzp = new RazorpayConstructor({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: 'PAE',
          description: order.description,
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const result = await paymentAPI.verifyPayment({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_type: planType,
              })
              localStorage.setItem('auth_token', result.token)
              await useAuthStore.getState().loadUser()
              // Refresh AI usage after any purchase
              quizAPI.getAIUsage().then(setAIUsage).catch(() => {})
              resolve()
            } catch (e) {
              reject(e)
            }
          },
          modal: { ondismiss: () => reject(new Error('cancelled')) },
          theme: { color: '#7c3aed' },
        })
        rzp.open()
      })

      // Retry session creation after upgrade
      setShowUpgradeModal(false)
      const pendingId = upgradePendingQuizId
      setUpgradePendingQuizId(null)
      if (pendingId) {
        await handleStartGame(pendingId)
      }
    } catch (err: unknown) {
      if ((err as Error).message !== 'cancelled') {
        console.error('Payment failed:', err)
      }
    } finally {
      setIsUpgrading(false)
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

  const attemptsChartData = (() => {
    const days: Record<string, number> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0
    }
    attempts.forEach(a => {
      const key = new Date(a.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (key in days) days[key] += a.score
    })
    return Object.entries(days).map(([date, score]) => ({ date, score }))
  })()

  const stats = user?.role === 'teacher'
    ? [
        { label: 'My Quizzes', value: quizzes.length, iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'from-violet-500 to-purple-600' },
        { label: 'Total Sessions', value: sessions.length, iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-indigo-500 to-blue-600' },
        { label: 'Active Now', value: sessions.filter(s => s.status === 'active').length, iconPath: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 8v4l2 2m4-2a8 8 0 11-16 0 8 8 0 0116 0z', color: 'from-rose-500 to-pink-600' },
        { label: 'Total Questions', value: quizzes.reduce((a, q) => a + q.questions.length, 0), iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-amber-500 to-orange-600' },
      ]
    : [
        { label: 'Quiz Attempts', value: attempts.length, iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'from-violet-500 to-purple-600' },
        { label: 'Total Score', value: attempts.reduce((a, att) => a + att.score, 0), iconPath: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'from-indigo-500 to-blue-600' },
        { label: 'Avg Score', value: attempts.length > 0 ? Math.round(attempts.reduce((a, att) => a + att.score, 0) / attempts.length) : 0, iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'from-emerald-500 to-teal-600' },
        { label: 'Accuracy', value: attempts.length > 0 ? Math.round((attempts.reduce((a, att) => a + att.correct_answers, 0) / attempts.reduce((a, att) => a + att.total_questions, 0)) * 100) : 0, iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-rose-500 to-pink-600' },
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
        <div className="animate-blobFloat absolute top-[-10%] left-[-5%] w-[700px] h-[700px] rounded-full bg-violet-600/35 blur-3xl" />
        <div className="animate-blobFloat2 absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-600/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")` }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/"><PAELogo variant="dark" size="sm" /></Link>

          <div className="flex items-center gap-3">
            {/* Desktop menu */}
            <Link
              to="/marketplace"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white/90 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Marketplace
            </Link>
            {user?.role === 'teacher' && (
              <Link
                to="/analytics"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white/90 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </Link>
            )}
            <div className="hidden sm:flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-white/80">{user?.name}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/') }}
              className="hidden sm:block px-3 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/10"
            >
              Sign Out
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 text-white/60 hover:text-white/90 rounded-lg"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-white/5 px-4 py-4 space-y-3">
            <Link
              to="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/70 hover:text-white/90 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Marketplace
            </Link>
            {user?.role === 'teacher' && (
              <Link
                to="/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/70 hover:text-white/90 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </Link>
            )}
            <div className="border-t border-white/10 pt-3 mt-3 space-y-3">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center font-bold text-xs">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-white/80">{user?.name}</span>
              </div>
              <button
                onClick={() => { logout(); navigate('/'); setMobileMenuOpen(false) }}
                className="w-full px-3 py-2 text-sm text-white/50 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors border border-transparent"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Welcome + Create */}
        <div className="animate-fadeInDown flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              {user?.role === 'teacher' 
                ? `${quizzes.length} quiz${quizzes.length !== 1 ? 'zes' : ''} · ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`
                : `${attempts.length} attempt${attempts.length !== 1 ? 's' : ''} · ${attempts.reduce((a, att) => a + att.score, 0)} total point${attempts.reduce((a, att) => a + att.score, 0) !== 1 ? 's' : ''}`
              }
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
                  <p className="text-2xl font-black text-white">{stat.value}{stat.label === 'Accuracy' ? '%' : ''}</p>
                  <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Plan & Usage card — teachers only */}
            {user?.role === 'teacher' && (() => {
              const isPro = user.is_pro || user.is_admin
              const sessionCap = isPro ? null : 30 + (user.extra_sessions ?? 0)
              const sessionUsed = sessions.length
              const sessionPct = sessionCap ? Math.min(100, Math.round((sessionUsed / sessionCap) * 100)) : 0
              const aiUsed = aiUsage?.used ?? 0
              const aiLimit = aiUsage?.limit ?? 3
              const aiPct = aiUsage?.unlimited ? 0 : Math.min(100, Math.round((aiUsed / aiLimit) * 100))
              return (
                <div className="gsap-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Plan & Usage</h3>
                    {isPro ? (
                      <span className="text-[11px] bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2.5 py-1 rounded-full font-bold">PRO / ADMIN</span>
                    ) : (
                      <span className="text-[11px] bg-white/5 border border-white/10 text-white/40 px-2.5 py-1 rounded-full font-semibold">Free Plan</span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {/* Sessions */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-white/60 font-medium">Game Sessions</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">
                            {isPro ? <span className="text-violet-300 font-semibold">Unlimited</span> : `${sessionUsed} / ${sessionCap}`}
                          </span>
                          {!isPro && (
                            <button
                              onClick={() => setShowUpgradeModal(true)}
                              className="text-[11px] text-violet-400 hover:text-violet-300 font-bold transition-colors"
                            >
                              + Get more
                            </button>
                          )}
                        </div>
                      </div>
                      {!isPro && (
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${sessionPct >= 90 ? 'bg-rose-500' : sessionPct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                            style={{ width: `${sessionPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {/* AI Generations */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-white/60 font-medium">AI Generations</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">
                            {aiUsage?.unlimited ? <span className="text-violet-300 font-semibold">Unlimited</span> : `${aiUsed} / ${aiLimit}`}
                          </span>
                          {!aiUsage?.unlimited && (
                            <button
                              onClick={() => setShowAIUpgradeModal(true)}
                              className="text-[11px] text-violet-400 hover:text-violet-300 font-bold transition-colors"
                            >
                              + Get more
                            </button>
                          )}
                        </div>
                      </div>
                      {!aiUsage?.unlimited && (
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${aiPct >= 90 ? 'bg-rose-500' : aiPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${aiPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Chart - Teacher: Sessions | Student: Scores */}
            {user?.role === 'teacher' ? (
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
            ) : (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Your Scores (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={attemptsChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                      cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

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

            {/* Student - Join Game */}
            {user?.role === 'student' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="max-w-md">
                  <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Join a Game
                  </h3>
                  <p className="text-white/40 text-sm mb-5">Enter the game PIN to join and play instantly</p>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    const pin = (formData.get('pin') as string).toUpperCase()
                    const nickname = formData.get('nickname') as string
                    
                    if (!pin || pin.length !== 6) {
                      alert('PIN must be exactly 6 characters')
                      return
                    }
                    
                    try {
                      const result = await playerAPI.join({ pin, nickname })
                      if (result.player_id) {
                        resetGame()
                        setGamePlayerID(result.player_id)
                        setGameNickname(nickname)
                        navigate(`/play/${pin}`)
                      }
                    } catch (err) {
                      alert('Could not join game. Check your PIN and try again.')
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-white/80 mb-2">Game PIN</label>
                      <input
                        type="text"
                        name="pin"
                        placeholder="E.g. ABC123"
                        maxLength={6}
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white/80 mb-2">Your Name</label>
                      <input
                        type="text"
                        name="nickname"
                        defaultValue={user?.name ?? ''}
                        placeholder="Enter your name"
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all"
                    >
                      Join Game
                    </button>
                  </form>
                  
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <Link
                      to="/marketplace"
                      className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-semibold transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Browse Marketplace
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === 'sessions' && user?.role === 'student' && (
          <div className="gsap-tab-content space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">My Quiz Attempts</h2>
              <span className="text-sm text-white/40">{attempts.length} total</span>
            </div>

            {isLoadingAttempts ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />)}
              </div>
            ) : attempts.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">No attempts yet. Join a game using a PIN to get started!</p>
                <Link to="/join" className="text-violet-400 text-sm font-medium hover:underline mt-1 block">Join a Game</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {attempts.map(attempt => (
                  <div key={attempt.player_id} className="gsap-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white/90 text-sm truncate">{attempt.quiz_title || 'Quiz'}</p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {attempt.correct_answers}/{attempt.total_questions} correct · {formatDate(attempt.played_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-violet-300">{attempt.score}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SESSIONS TAB (teacher) ── */}
        {tab === 'sessions' && user?.role === 'teacher' && (
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
          <div className="gsap-tab-content space-y-5">
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

      {/* Upgrade modal — tiered session plans */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowUpgradeModal(false); setUpgradePendingQuizId(null) }} />
          <div className="relative bg-gray-900 border border-violet-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Get More Sessions</h3>
              <p className="text-white/50 text-sm">You've hit your session limit. Pick a plan to continue.</p>
            </div>

            <div className="space-y-2.5 mb-5">
              {/* +50 sessions */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center justify-between hover:border-violet-500/40 transition-colors">
                <div>
                  <p className="text-white font-semibold text-sm">+50 Sessions</p>
                  <p className="text-white/40 text-xs mt-0.5">Cap becomes 80 sessions</p>
                </div>
                <button
                  onClick={() => handleUpgrade('sessions_50')}
                  disabled={isUpgrading}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isUpgrading && <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  ₹99
                </button>
              </div>

              {/* +100 sessions */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center justify-between hover:border-violet-500/40 transition-colors">
                <div>
                  <p className="text-white font-semibold text-sm">+100 Sessions</p>
                  <p className="text-white/40 text-xs mt-0.5">Cap becomes 130 sessions</p>
                </div>
                <button
                  onClick={() => handleUpgrade('sessions_100')}
                  disabled={isUpgrading}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isUpgrading && <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  ₹179
                </button>
              </div>

              {/* Unlimited */}
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-white font-semibold text-sm">Unlimited</p>
                    <span className="text-[10px] bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">BEST</span>
                  </div>
                  <p className="text-white/40 text-xs">Sessions + AI — forever</p>
                </div>
                <button
                  onClick={() => handleUpgrade('sessions_unlimited')}
                  disabled={isUpgrading}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isUpgrading && <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  ₹299
                </button>
              </div>
            </div>

            <button
              onClick={() => { setShowUpgradeModal(false); setUpgradePendingQuizId(null) }}
              className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/50 text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Credits upgrade modal */}
      {showAIUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAIUpgradeModal(false)} />
          <div className="relative bg-gray-900 border border-violet-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Buy AI Generations</h3>
              <p className="text-white/50 text-sm">
                {aiUsage ? `${aiUsage.used} / ${aiUsage.limit} used` : 'Top up your AI question generation credits'}
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center justify-between hover:border-violet-500/40 transition-colors">
                <div>
                  <p className="text-white font-semibold text-sm">+10 Generations</p>
                  <p className="text-white/40 text-xs mt-0.5">Generate up to 10 more AI question sets</p>
                </div>
                <button
                  onClick={() => { setShowAIUpgradeModal(false); handleUpgrade('ai_10') }}
                  disabled={isUpgrading}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                >
                  ₹49
                </button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center justify-between hover:border-violet-500/40 transition-colors">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-white font-semibold text-sm">+20 Generations</p>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">SAVE</span>
                  </div>
                  <p className="text-white/40 text-xs">₹3.95/gen vs ₹4.90 — better value</p>
                </div>
                <button
                  onClick={() => { setShowAIUpgradeModal(false); handleUpgrade('ai_20') }}
                  disabled={isUpgrading}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                >
                  ₹79
                </button>
              </div>
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-white font-semibold text-sm">Unlimited Plan</p>
                    <span className="text-[10px] bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">BEST</span>
                  </div>
                  <p className="text-white/40 text-xs">Sessions + AI — both unlimited forever</p>
                </div>
                <button
                  onClick={() => { setShowAIUpgradeModal(false); handleUpgrade('sessions_unlimited') }}
                  disabled={isUpgrading}
                  className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                >
                  ₹299
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowAIUpgradeModal(false)}
              className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/50 text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
