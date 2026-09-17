import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import PAELogo from '../components/ui/PAELogo'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { platformAPI } from '../lib/api'
import type { PlatformStats } from '../types'
import { useAuthStore } from '../store/authStore'
import "../index.css"

// ─── Static content ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Multiple Quiz Types',
    description: 'Multiple choice, image-based, match-pair, and fill-in-the-blank — all in one platform.',
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Real-time Gameplay',
    description: 'Powered by HiveMQ MQTT — scores update instantly as every answer comes in.',
    gradient: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Live Leaderboard',
    description: 'Dynamic leaderboard refreshes after every question. Celebrate top performers live.',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Image-Rich Questions',
    description: 'Upload up to 3 cloud-hosted images per quiz to make visual questions come alive.',
    gradient: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-50',
    text: 'text-sky-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: 'Teacher Dashboard',
    description: 'Manage quizzes, host sessions, and review full session history — all in one place.',
    gradient: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'No App Required',
    description: 'Students join instantly from any browser with just a PIN — no account, no download.',
    gradient: 'from-indigo-500 to-violet-600',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
]

const STAT_CONFIG = [
  {
    key: 'total_quizzes' as const,
    label: 'Quizzes Created',
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-200',
    chartColor: '#0f6b78',
    chartName: 'Quizzes',
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    key: 'total_sessions' as const,
    label: 'Game Sessions',
    gradient: 'from-amber-400 to-orange-500',
    shadow: 'shadow-amber-200',
    chartColor: '#e5a92f',
    chartName: 'Sessions',
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'total_participants' as const,
    label: 'Total Participants',
    gradient: 'from-sky-500 to-blue-600',
    shadow: 'shadow-sky-200',
    chartColor: '#3B82F6',
    chartName: 'Players',
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'total_teachers' as const,
    label: 'Active Teachers',
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-200',
    chartColor: '#10B981',
    chartName: 'Teachers',
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path d="M12 14l9-5-9-5-9 5 9 5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
]

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === 0) return
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setCount(Math.round(eased * target))
      if (elapsed < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return count
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  cfg,
  value,
  delay,
}: {
  cfg: typeof STAT_CONFIG[number]
  value: number
  delay: number
}) {
  const animated = useCountUp(value, 1400)

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cfg.gradient} p-6 shadow-lg ${cfg.shadow} text-white`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative circle */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-4 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          {cfg.icon}
        </div>
        <div className="text-4xl font-black tracking-tight mb-1">
          {animated.toLocaleString()}
        </div>
        <div className="text-sm font-medium text-white/80">{cfg.label}</div>
      </div>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; payload: { fill: string } }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="font-black text-gray-900">{payload[0].value.toLocaleString()}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

gsap.registerPlugin(ScrollTrigger)

export default function LandingPage() {
  const { token } = useAuthStore()
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    platformAPI.getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [])

  // GSAP ScrollTrigger animations
  // Replace your GSAP useEffect with this:

useEffect(() => {
  const ctx = gsap.context(() => {
    // Stat cards
    gsap.from('.gsap-stat-card', {
      scrollTrigger: { 
        trigger: '.gsap-stats-section', 
        start: 'top 85%',
        once: true,
      },
      opacity: 0, y: 40, duration: 0.5, stagger: 0.1, ease: 'power2.out',
      clearProps: 'all',
    })

    // Feature cards — THIS is the main fix
    gsap.from('.gsap-feature-card', {
      scrollTrigger: { 
        trigger: '.gsap-features-section', 
        start: 'top 85%',
        once: true,
      },
      opacity: 0, y: 40, scale: 0.97, duration: 0.6,
      stagger: { each: 0.1, ease: 'power1.inOut' },
      ease: 'power3.out',
      clearProps: 'all',  // ← removes inline styles after animation
    })

    // How it works cards
    gsap.from('.gsap-hiw-card', {
      scrollTrigger: { 
        trigger: '.gsap-hiw-section', 
        start: 'top 85%',
        once: true,
      },
      opacity: 0, x: -40, duration: 0.5, stagger: 0.15, ease: 'power2.out',
      clearProps: 'all',
    })

    // Step items
    gsap.from('.gsap-step', {
      scrollTrigger: { 
        trigger: '.gsap-hiw-section', 
        start: 'top 75%',
        once: true,
      },
      opacity: 0, x: 20, duration: 0.35, stagger: 0.1, ease: 'power2.out', delay: 0.3,
      clearProps: 'all',
    })

    // CTA
    gsap.from('.gsap-cta', {
      scrollTrigger: { 
        trigger: '.gsap-cta-section', 
        start: 'top 85%',
        once: true,
      },
      opacity: 0, y: 30, duration: 0.5, ease: 'power2.out',
      clearProps: 'all',
    })
  }, pageRef)

  // Refresh after stats load changes page height
  const t = setTimeout(() => ScrollTrigger.refresh(), 150)

  return () => { ctx.revert(); clearTimeout(t) }
}, [statsLoading]) // ← re-run after skeleton → real cards

  const chartData = stats
    ? STAT_CONFIG.map((c) => ({
        name: c.chartName,
        value: stats[c.key],
        fill: c.chartColor,
      }))
    : []

  return (
    <div className="min-h-screen bg-white" ref={pageRef}>

      {/* ── Navbar ────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#dbe7e8] bg-white shadow-[0_4px_18px_rgba(24,50,71,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-[76px] items-center justify-between">

            {/* Logo */}
            <Link to="/" className="rounded-xl px-2 py-1 transition-colors hover:bg-[#edf7f6]">
              <PAELogo variant="light" size="md" />
            </Link>

            {/* Desktop nav */}
            <div className="hidden items-center gap-7 sm:flex">
              <Link to="/join" className="text-sm font-semibold text-[#486375] transition-colors hover:text-[#0f6b78]">
                Join Game
              </Link>
              <Link to="/docs" className="text-sm font-semibold text-[#486375] transition-colors hover:text-[#0f6b78]">
                Docs
              </Link>
              {token ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#d9f1ef] px-4 py-2.5 text-sm font-bold text-[#0b5262] shadow-sm transition-colors hover:bg-[#c4e8e5]"
                >
                  Dashboard
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-semibold text-[#486375] transition-colors hover:text-[#0f6b78]">
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0f6b78] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0b5262]"
                  >
                    Get Started
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-[#b8d9d8] bg-[#edf7f6] px-3 py-2 text-[#0b5262] shadow-sm transition-colors hover:border-[#0f6b78] hover:bg-[#d9f1ef] sm:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
              <span className="text-xs font-bold uppercase tracking-wide">{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="space-y-3 border-t border-[#dbe7e8] bg-[#f8fbfa] px-4 py-4 shadow-inner sm:hidden">
            <Link to="/join" onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#486375] hover:bg-[#e6f3f1] hover:text-[#0f6b78]">
              Join Game
            </Link>
            <Link to="/docs" onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#486375] hover:bg-[#e6f3f1] hover:text-[#0f6b78]">
              Docs
            </Link>
            {token ? (
              <button onClick={() => { setMobileMenuOpen(false); navigate('/dashboard') }}
                className="w-full rounded-xl bg-[#d9f1ef] py-2.5 text-sm font-bold text-[#0b5262] shadow-sm hover:bg-[#c4e8e5]">
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#486375] hover:bg-[#e6f3f1] hover:text-[#0f6b78]">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}
                  className="block w-full rounded-xl bg-[#0f6b78] py-2.5 text-center text-sm font-bold text-white shadow-sm hover:bg-[#0b5262]">
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#fffdf8] via-[#f6faf9] to-[#eaf4f7]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0f6b78] via-[#e5a92f] to-[#2874d0]" />
        {/* Reference-style curved navy decoration */}
        <div className="pointer-events-none absolute -left-40 -bottom-72 h-[620px] w-[700px] rounded-[48%] bg-[#062f3c] rotate-[24deg] opacity-95" />
        <div className="pointer-events-none absolute -left-32 -bottom-64 h-[500px] w-[620px] rounded-[48%] border-t-2 border-[#e5a92f] rotate-[24deg]" />
        <div className="pointer-events-none absolute -right-40 -top-72 h-[520px] w-[620px] rounded-[48%] border-t-2 border-[#e5a92f] rotate-[34deg]" />
        <div className="pointer-events-none absolute -right-36 -bottom-44 h-[430px] w-[480px] rounded-full bg-[#d8e9ed] opacity-70" />
        <div className="pointer-events-none absolute right-[18%] top-24 h-24 w-24 rounded-full border-[14px] border-[#e5a92f]/20" />
        <div className="pointer-events-none absolute left-[15%] top-40 h-3 w-3 rounded-full bg-[#e5a92f] shadow-[0_0_0_8px_rgba(229,169,47,0.14)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fadeInDown inline-flex items-center gap-2 rounded-full border border-[#c9dadd] bg-white/75 px-4 py-2 text-sm font-semibold text-[#0f6b78] shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live multiplayer quizzes — no setup required
            </div>

            <h1 className="animate-fadeInUp mt-7 text-5xl font-black leading-[0.98] tracking-tight text-[#183247] sm:text-6xl lg:text-7xl">
              Make Learning
              <br />
              <span className="bg-gradient-to-r from-[#0f8f7c] via-[#168da9] to-[#2874d0] bg-clip-text text-transparent">
                Competitive &amp; Fun
              </span>
            </h1>

            <p className="animate-fadeInUp delay-100 mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[#60778a] sm:text-xl">
              PAE lets teachers create engaging quizzes and host real-time multiplayer games.
              Students join instantly via a PIN — no account needed.
            </p>

            <div className="animate-fadeInUp delay-200 mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0f6b78] to-[#062f3c] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#0f6b78]/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create a Quiz
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                to="/join"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0f6b78] bg-white/70 px-8 py-4 text-base font-bold text-[#0f5262] transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Join a Game
              </Link>
            </div>

            <div className="animate-fadeInUp delay-300 mt-12 flex flex-col items-center justify-center gap-4 text-sm font-semibold text-[#183247] sm:flex-row sm:gap-6">
              <span className="flex min-w-[150px] items-center justify-center gap-2 text-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9f1ef] text-[#0f6b78]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7Z" />
                  </svg>
                </span>
                <span>Real-time<br className="sm:hidden" /> Play</span>
              </span>
              <span className="hidden h-10 w-px bg-[#a9c2c9] sm:block" aria-hidden="true" />
              <span className="flex min-w-[150px] items-center justify-center gap-2 text-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9edf5] text-[#1975ad]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 8v-2a4 4 0 0 0-3-3.87m-1-8a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span>No Account<br className="sm:hidden" /> Required</span>
              </span>
              <span className="hidden h-10 w-px bg-[#a9c2c9] sm:block" aria-hidden="true" />
              <span className="flex min-w-[150px] items-center justify-center gap-2 text-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbeaf6] text-[#23638f]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 12 2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 3c-2.755 0-5.29.93-7.318 2.484A12.003 12.003 0 0 0 3 12c0 4.268 2.23 8.014 5.603 10.148A11.954 11.954 0 0 0 12 21c1.64 0 3.198-.33 4.618-.934A12.003 12.003 0 0 0 21 12c0-1.42-.247-2.783-.7-4.05" />
                  </svg>
                </span>
                <span>Easy to<br className="sm:hidden" /> Use</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform Stats ────────────────────────────────────────────── */}
      <section className="gsap-stats-section bg-gradient-to-br from-[#f8fbfa] via-[#f4faf9] to-[#eaf4f7] py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Heading */}
          <div className="text-center mb-12">
            <span className="mb-3 inline-block rounded-full border border-[#b8d9d8] bg-[#d9f1ef] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0b5262]">
              By the numbers
            </span>
            <h2 className="text-3xl font-black text-[#183247] sm:text-4xl">Platform at a Glance</h2>
            <p className="mx-auto mt-3 max-w-md text-base text-[#60778a]">
              Real numbers from our growing community of educators and students.
            </p>
          </div>

          {/* Stat cards */}
          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
                {STAT_CONFIG.map((cfg, i) => (
                  <div key={cfg.key} className="gsap-stat-card">
                    <StatCard cfg={cfg} value={stats[cfg.key]} delay={i * 100} />
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Community Overview</h3>
                    <p className="text-sm text-gray-400 mt-0.5">Breakdown across all platform metrics</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {STAT_CONFIG.map((c) => (
                      <div key={c.key} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.chartColor }} />
                        {c.chartName}
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={48}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fill: '#6B7280', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.04)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 py-12">Stats temporarily unavailable.</p>
          )}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="gsap-features-section py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
              Everything you need for<br className="hidden sm:block" /> interactive learning
            </h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto text-base">
              Built for teachers who want a fast, fun, and effective quiz experience — and students who love competition.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="gsap-feature-card group relative p-6 rounded-2xl border border-gray-100 bg-white hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Subtle gradient on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`} />
                <div className={`relative w-12 h-12 rounded-xl ${feature.bg} ${feature.text} flex items-center justify-center mb-5`}>
                  {feature.icon}
                </div>
                <h3 className="relative font-bold text-gray-900 mb-2 text-base">{feature.title}</h3>
                <p className="relative text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="gsap-hiw-section py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
              How it works
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Up and running in minutes</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
            {/* Teachers */}
            <div className="gsap-hiw-card bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">For Teachers</h3>
              </div>
              <div className="space-y-5">
                {[
                  'Create an account and build your quiz with various question types.',
                  'Start a game session — a unique 6-digit PIN is generated instantly.',
                  'Launch the game when players are ready and control the pace.',
                  'Review the leaderboard and full session analytics after the game.',
                ].map((text, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
                      {i + 1}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Students */}
            <div className="gsap-hiw-card bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">For Students</h3>
              </div>
              <div className="space-y-5">
                {[
                  'Open your browser, no app download or account required.',
                  'Enter the PIN shared by your teacher and pick a nickname.',
                  'Wait in the lobby — see other players join in real-time.',
                  'Answer questions, race the clock, and climb the live leaderboard!',
                ].map((text, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
                      {i + 1}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="gsap-cta-section py-16 sm:py-24 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 relative overflow-hidden">
        <div className="absolute top-0 left-1/3 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="gsap-cta relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to make learning fun?</h2>
          <p className="text-white/70 mb-10 text-base max-w-xl mx-auto">
            Join educators already using PAE to bring competition and engagement into every classroom.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-violet-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-xl shadow-black/20"
            >
              Start for Free
            </Link>
            <Link
              to="/join"
              className="inline-flex items-center justify-center px-8 py-4 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white font-bold rounded-xl transition-colors border border-white/30"
            >
              Join a Game Now
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <PAELogo variant="dark" size="sm" />
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs">
              <Link to="/join" className="hover:text-gray-200 transition-colors">Join Game</Link>
              <Link to="/login" className="hover:text-gray-200 transition-colors">Sign In</Link>
              <Link to="/register" className="hover:text-gray-200 transition-colors">Register</Link>
              <Link to="/docs" className="hover:text-gray-200 transition-colors">Docs</Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-600">
              Built by{' '}
              <span className="text-violet-400 font-semibold">Dhanush</span>
              {' '}·{' '}
              <span className="text-gray-500">PAE Real-time Quiz Platform</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
