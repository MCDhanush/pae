import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PAELogo from '../components/ui/PAELogo'

const sections = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'for-teachers', label: 'For Teachers' },
  { id: 'for-students', label: 'For Students' },
  { id: 'quiz-types', label: 'Quiz Types' },
  { id: 'ai-generator', label: 'AI Question Generator' },
  { id: 'live-sessions', label: 'Live Sessions' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'plans-pricing', label: 'Plans & Pricing' },
  { id: 'faq', label: 'FAQ' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
        <span className="w-1 h-7 rounded-full bg-gradient-to-b from-violet-400 to-indigo-500 inline-block shrink-0" />
        {title}
      </h2>
      <div className="space-y-4 text-white/70 leading-relaxed">{children}</div>
    </section>
  )
}

const ICON_COLORS: Record<string, string> = {
  violet: 'bg-violet-500/15 border-violet-500/20 text-violet-400',
  emerald: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400',
  blue: 'bg-blue-500/15 border-blue-500/20 text-blue-400',
  amber: 'bg-amber-500/15 border-amber-500/20 text-amber-400',
  rose: 'bg-rose-500/15 border-rose-500/20 text-rose-400',
  indigo: 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400',
}

function Icon({ path, color = 'violet', size = 'md' }: { path: string; color?: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const wrap = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  return (
    <div className={`${wrap} rounded-xl border flex items-center justify-center shrink-0 ${ICON_COLORS[color] ?? ICON_COLORS.violet}`}>
      <svg className={sz} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
      </svg>
    </div>
  )
}

function Card({ iconPath, iconColor = 'violet', title, children }: { iconPath: string; iconColor?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <Icon path={iconPath} color={iconColor} />
        <h3 className="text-white font-bold text-base">{title}</h3>
      </div>
      <p className="text-white/60 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Badge({ children, color = 'violet' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-500/20 border-violet-500/30 text-violet-300',
    green: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    amber: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
    rose: 'bg-rose-500/20 border-rose-500/30 text-rose-300',
  }
  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-black text-sm shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-white font-semibold text-sm mb-1">{title}</p>
        <p className="text-white/55 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function PricingTier({
  name, price, badge, features, highlight,
}: {
  name: string; price: string; badge?: string; features: string[]; highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? 'bg-violet-500/10 border-violet-500/40' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-bold">{name}</p>
        {badge && <Badge color={highlight ? 'violet' : 'green'}>{badge}</Badge>}
      </div>
      <p className={`text-3xl font-black mb-4 ${highlight ? 'text-violet-300' : 'text-white'}`}>{price}</p>
      <ul className="space-y-2">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-white/60">
            <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/5 backdrop-blur-xl sticky top-0 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/"><PAELogo variant="dark" size="sm" /></Link>
            <span className="hidden sm:block text-white/20">|</span>
            <span className="hidden sm:block text-sm font-semibold text-white/50">Documentation</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/marketplace"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white/90 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10"
            >
              Marketplace
            </Link>
            <Link
              to="/login"
              className="hidden sm:flex px-3 py-1.5 text-xs font-semibold text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 rounded-xl transition-colors border border-violet-500/30"
            >
              Sign In
            </Link>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 text-white/60 hover:text-white/90 rounded-lg"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu — inside header so it stays sticky */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-white/10 bg-gray-950/95 backdrop-blur-xl px-4 py-5 space-y-5">

            {/* Quick links */}
            <div className="flex gap-2">
              <Link
                to="/marketplace"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Marketplace
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-500/15 border border-violet-500/30 rounded-xl text-sm font-semibold text-violet-300 hover:bg-violet-500/25 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-600 rounded-xl text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Sign Up
              </Link>
            </div>

            {/* On this page */}
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2.5">On this page</p>
              <nav className="space-y-0.5">
                {sections.map(s => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === s.id
                        ? 'bg-violet-500/15 text-violet-300'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    {activeSection === s.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    )}
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>

          </div>
        )}
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 flex gap-10">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24">
            <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">On this page</p>
            <nav className="space-y-0.5">
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? 'bg-violet-500/15 text-violet-300 border-l-2 border-violet-400'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  {s.label}
                </a>
              ))}
            </nav>

            <div className="mt-8 p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
              <p className="text-xs font-bold text-violet-300 mb-1">Get Started Free</p>
              <p className="text-xs text-white/40 mb-3">Create your first quiz in minutes.</p>
              <Link
                to="/register"
                className="block text-center px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-bold text-white transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* ── INTRODUCTION ── */}
          <Section id="introduction" title="What is PAE?">
            <p className="text-lg text-white/80 leading-relaxed">
              PAE is a <strong className="text-white">real-time multiplayer quiz platform</strong> — like Kahoot, but built for educators who want more control. Teachers create rich quiz content, share a 6-character PIN, and students join instantly from any device. No app installation required.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              <Card
                iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                iconColor="violet"
                title="Engage Students"
              >
                Live leaderboards, timed questions, and instant feedback keep every student actively participating.
              </Card>
              <Card
                iconPath="M13 10V3L4 14h7v7l9-11h-7z"
                iconColor="indigo"
                title="AI-Powered"
              >
                Generate full question sets from any topic in seconds using the built-in AI generator.
              </Card>
              <Card
                iconPath="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                iconColor="emerald"
                title="Track Progress"
              >
                Per-student, per-quiz analytics let teachers identify who needs help before the next lesson.
              </Card>
            </div>

          </Section>

          {/* ── GETTING STARTED ── */}
          <Section id="getting-started" title="Getting Started">
            <p>You can use PAE as a <strong className="text-white">Teacher</strong> (create & host quizzes) or as a <strong className="text-white">Student</strong> (join games with a PIN). Here's the fastest path for each.</p>

            <div className="grid sm:grid-cols-2 gap-6 mt-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Icon path="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" color="violet" />
                  <h3 className="text-white font-bold">Teacher Quick Start</h3>
                </div>
                <div className="space-y-4">
                  <Step number={1} title="Create an account">Register at <code className="text-violet-300 text-xs bg-violet-500/10 px-1 py-0.5 rounded">/register</code> and choose the Teacher role.</Step>
                  <Step number={2} title="Build your first quiz">Go to Dashboard → New Quiz. Add questions manually or use the AI generator.</Step>
                  <Step number={3} title="Start a live session">Click the play button next to any quiz. Share the 6-character PIN with your class.</Step>
                  <Step number={4} title="View results">When the session ends, review per-student scores and correct/incorrect breakdowns.</Step>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" color="blue" />
                  <h3 className="text-white font-bold">Student Quick Start</h3>
                </div>
                <div className="space-y-4">
                  <Step number={1} title="Get the PIN">Your teacher will share a 6-character game PIN (e.g. ABC123).</Step>
                  <Step number={2} title="Join the game">Go to <code className="text-violet-300 text-xs bg-violet-500/10 px-1 py-0.5 rounded">/join</code> or use the Join Game form in your dashboard. Enter the PIN and your name.</Step>
                  <Step number={3} title="Wait in the lobby">You'll see a waiting screen until the teacher starts the game.</Step>
                  <Step number={4} title="Answer questions">Select your answer before the timer runs out. Points are based on speed and accuracy.</Step>
                </div>
              </div>
            </div>
          </Section>

          {/* ── FOR TEACHERS ── */}
          <Section id="for-teachers" title="For Teachers">
            <p>Teachers have full control over quiz creation, session management, and student analytics.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Dashboard Overview</h3>
            <p>After logging in, your dashboard shows:</p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2 ml-2">
              <li><strong className="text-white">Overview tab</strong> — stats (quizzes, sessions, active now), Plan &amp; Usage, activity chart, and your quiz list.</li>
              <li><strong className="text-white">Sessions tab</strong> — every game session you've ever hosted, with participant counts and results.</li>
              <li><strong className="text-white">Profile tab</strong> — update your name, institution, bio, and change your password.</li>
            </ul>

            <h3 className="text-white font-semibold mt-6 mb-3">Creating a Quiz</h3>
            <div className="space-y-3">
              <Step number={1} title="Title & cover">Give your quiz a name and optional cover image (max 2 MB, JPEG/PNG/WebP).</Step>
              <Step number={2} title="Add questions">Use the question editor to add up to any number of questions. Choose from four question types (see Quiz Types section).</Step>
              <Step number={3} title="Question images">Each question can optionally have up to 3 images. Images are stored in Google Cloud Storage.</Step>
              <Step number={4} title="Time limits">Set a per-question time limit (default 20 seconds). Students must answer before the timer expires.</Step>
              <Step number={5} title="Save & publish">Save as a draft or publish to the Marketplace for other teachers to discover.</Step>
            </div>

            <h3 className="text-white font-semibold mt-6 mb-3">Hosting a Live Session</h3>
            <p>Click the play ▶ icon on any quiz card. The system creates a unique session with a 6-character PIN. You'll land on the Host Screen which shows:</p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2 ml-2">
              <li>The PIN for students to join</li>
              <li>A live lobby listing everyone who has joined</li>
              <li>Start Game button (visible once at least one student is in the lobby)</li>
              <li>Question display with timer and live answer distribution</li>
              <li>Leaderboard shown after each question</li>
            </ul>

            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
              <strong>Session limit:</strong> Free accounts can host up to 30 sessions. Purchase additional sessions or upgrade to unlimited — see Plans &amp; Pricing.
            </div>

            <h3 className="text-white font-semibold mt-6 mb-3">Admin Accounts</h3>
            <p>Admin users have no session or AI limits. Admin access is granted by the platform owner — contact your administrator to request it. Once granted, log out and log back in for it to take effect.</p>
          </Section>

          {/* ── FOR STUDENTS ── */}
          <Section id="for-students" title="For Students">
            <p>Students can join games as guests (no account needed) or log in with a student account to track their history.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Joining a Game</h3>
            <div className="space-y-3">
              <Step number={1} title="Get the PIN">Your teacher shares a 6-character PIN when they start a session.</Step>
              <Step number={2} title="Enter PIN + name">Go to <code className="text-violet-300 text-xs bg-violet-500/10 px-1 py-0.5 rounded">/join</code> (or the Join Game card on your dashboard). Enter the PIN and choose a display name.</Step>
              <Step number={3} title="Lobby">You'll see a waiting screen with other players. The game starts when the teacher presses Start.</Step>
              <Step number={4} title="Answer questions">Each question is displayed with a countdown timer. Tap/click your answer. Correct answers score more points when answered faster.</Step>
              <Step number={5} title="Leaderboard">A live leaderboard shows after every question so you can see your ranking in real time.</Step>
              <Step number={6} title="Final results">At the end, full results are displayed showing everyone's scores.</Step>
            </div>

            <h3 className="text-white font-semibold mt-6 mb-3">Marketplace & Solo Play</h3>
            <p>Students can browse publicly available quizzes in the <Link to="/marketplace" className="text-violet-400 hover:text-violet-300 underline">Marketplace</Link> and play them solo at their own pace — no live session required. Solo play tracks your score and correct answers but doesn't affect any teacher's session count.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Tracking Your History</h3>
            <p>Logged-in students see a <strong className="text-white">Sessions</strong> tab in their dashboard listing every quiz they've attempted, with scores and accuracy percentage.</p>
          </Section>

          {/* ── QUIZ TYPES ── */}
          <Section id="quiz-types" title="Quiz Types">
            <p>PAE supports four question formats, each suited to different assessment styles.</p>

            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="violet">MCQ</Badge>
                  <h3 className="text-white font-bold">Multiple Choice</h3>
                </div>
                <p className="text-sm text-white/60">Classic 4-option single-answer question. One option is marked correct. Displayed as coloured answer tiles on the student screen. Best for factual recall and comprehension checks.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="blue">IMAGE</Badge>
                  <h3 className="text-white font-bold">Image-Based</h3>
                </div>
                <p className="text-sm text-white/60">Same as MCQ but the question or answer options can include images. Teachers upload images (max 3 per question, max 2 MB each). Ideal for visual subjects like geography, biology, or art.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="green">MATCH</Badge>
                  <h3 className="text-white font-bold">Match Pair</h3>
                </div>
                <p className="text-sm text-white/60">Students drag-and-drop items to match pairs (e.g. country → capital, term → definition). Built with dnd-kit. All pairs must be correctly matched for full marks. Great for vocabulary and mapping exercises.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="amber">FITB</Badge>
                  <h3 className="text-white font-bold">Fill in the Blank</h3>
                </div>
                <p className="text-sm text-white/60">A sentence with one or more blanks. Students type their answer. Answers are matched case-insensitively. Multiple accepted answers can be configured (e.g. "UK" and "United Kingdom" both accepted).</p>
              </div>
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 text-sm">
              <strong className="text-white">Tip:</strong> <span className="text-white/60">You can mix question types within a single quiz. The AI generator currently produces Multiple Choice questions; other types can be added manually in the quiz editor.</span>
            </div>
          </Section>

          {/* ── AI GENERATOR ── */}
          <Section id="ai-generator" title="AI Question Generator">
            <p>The AI generator creates a complete set of multiple-choice questions from any topic or subject you describe. Just tell it what you want to teach and it handles the rest.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">How to Use</h3>
            <div className="space-y-3">
              <Step number={1} title="Open AI Generate">Inside the quiz editor, click the AI Generate button in the question toolbar.</Step>
              <Step number={2} title="Describe your topic">Type a topic or subject (e.g. "Year 9 photosynthesis", "World War II causes", "Python list comprehensions").</Step>
              <Step number={3} title="Set question count">Choose how many questions to generate (up to 20 per batch).</Step>
              <Step number={4} title="Review & import">The generated questions appear in a preview. You can edit, remove, or import them all into your quiz.</Step>
            </div>

            <h3 className="text-white font-semibold mt-6 mb-3">Usage Limits</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/50 py-2 pr-6 font-semibold">Plan</th>
                    <th className="text-left text-white/50 py-2 pr-6 font-semibold">AI Generations</th>
                    <th className="text-left text-white/50 py-2 font-semibold">Reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr><td className="py-2 pr-6 text-white/70">Free</td><td className="py-2 pr-6 text-white/70">3 generations</td><td className="py-2 text-white/40">No reset (one-time)</td></tr>
                  <tr><td className="py-2 pr-6 text-white/70">+10 Pack (₹49)</td><td className="py-2 pr-6 text-white/70">+10 added to balance</td><td className="py-2 text-white/40">Cumulative</td></tr>
                  <tr><td className="py-2 pr-6 text-white/70">+20 Pack (₹79)</td><td className="py-2 pr-6 text-white/70">+20 added to balance</td><td className="py-2 text-white/40">Cumulative</td></tr>
                  <tr><td className="py-2 pr-6 text-violet-300 font-semibold">Unlimited (₹299)</td><td className="py-2 pr-6 text-violet-300">Unlimited forever</td><td className="py-2 text-white/40">—</td></tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
              <strong>Note:</strong> Failed AI generations (network error, timeout, etc.) do <em>not</em> consume a credit. Your quota is only used when questions are successfully generated.
            </div>
          </Section>

          {/* ── LIVE SESSIONS ── */}
          <Section id="live-sessions" title="Live Sessions">
            <p>A <strong className="text-white">Session</strong> is one live instance of a quiz being played with real students. Sessions are real-time — every event (player join, question start, answer, leaderboard) is delivered instantly via MQTT.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Session Lifecycle</h3>
            <div className="space-y-3">
              <Step number={1} title="Waiting (Lobby)">Teacher creates the session. A unique 6-character PIN is generated. Students join and appear in the lobby in real time.</Step>
              <Step number={2} title="Active">Teacher presses Start. Questions are sent one by one with a countdown timer. Students tap their answer and receive instant feedback.</Step>
              <Step number={3} title="Leaderboard">After each question, the top players are shown on a leaderboard screen (both host and student views).</Step>
              <Step number={4} title="Finished">After the last question, the session is marked finished. Full results are available at <code className="text-violet-300 text-xs bg-violet-500/10 px-1 py-0.5 rounded">/results/:pin</code>.</Step>
            </div>

            <h3 className="text-white font-semibold mt-6 mb-3">Resuming a Session</h3>
            <p>If you accidentally close the host window, navigate to the Sessions tab in your dashboard and click <strong className="text-white">Resume</strong> next to any waiting or active session. The game state is preserved and students stay connected.</p>
          </Section>

          {/* ── MARKETPLACE ── */}
          <Section id="marketplace" title="Marketplace">
            <p>The Marketplace is a public library of quizzes shared by teachers. Anyone — including non-logged-in visitors — can browse and play quizzes in solo mode.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Publishing a Quiz</h3>
            <p>When creating or editing a quiz, toggle <strong className="text-white">Publish to Marketplace</strong>. Published quizzes appear in the public listing with your name, subject, and question count.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Solo Play</h3>
            <p>From a quiz's preview page in the Marketplace, click <strong className="text-white">Play Solo</strong>. Solo mode works like a live session but you're the only player — no PIN, no lobby, no teacher needed. Your score and accuracy are tracked in your student history.</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Cloning a Quiz</h3>
            <p>Teachers can clone any public marketplace quiz into their own account to use as a starting point. The cloned quiz is private by default.</p>
          </Section>

          {/* ── ANALYTICS ── */}
          <Section id="analytics" title="Analytics">
            <p>The Analytics page (teachers only, at <code className="text-violet-300 text-xs bg-violet-500/10 px-1 py-0.5 rounded">/analytics</code>) gives a deep view into how your class is performing.</p>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <Card
                iconPath="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                iconColor="emerald"
                title="Session Trends"
              >
                A line chart showing sessions hosted per day over the last 30 days, helping you spot active teaching periods.
              </Card>
              <Card
                iconPath="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                iconColor="amber"
                title="Top Students"
              >
                A leaderboard of your highest-scoring students across all sessions.
              </Card>
              <Card
                iconPath="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                iconColor="rose"
                title="Question Difficulty"
              >
                Per-question accuracy rates across all sessions, so you can identify which topics students struggle with most.
              </Card>
              <Card
                iconPath="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                iconColor="blue"
                title="Quiz Performance"
              >
                Average score per quiz, letting you compare how different quizzes perform in terms of engagement and difficulty.
              </Card>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-white/60">
              Analytics update automatically after each completed session. No manual refresh needed.
            </div>
          </Section>

          {/* ── PLANS & PRICING ── */}
          <Section id="plans-pricing" title="Plans & Pricing">
            <p>PAE is free to use with generous limits. Purchase add-ons when you need more capacity — all prices are in Indian Rupees (INR).</p>

            <h3 className="text-white font-semibold mt-6 mb-3">Session Plans</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <PricingTier
                name="Free"
                price="₹0"
                features={['30 game sessions', '3 AI generations', 'All quiz types', 'Marketplace access', 'Full analytics']}
              />
              <PricingTier
                name="+50 Sessions"
                price="₹99"
                badge="POPULAR"
                features={['+50 sessions added', 'New cap: 80 sessions', 'Cumulative (stackable)', 'Instant activation']}
              />
              <PricingTier
                name="+100 Sessions"
                price="₹179"
                features={['+100 sessions added', 'New cap: 130 sessions', 'Better per-session value', 'Instant activation']}
              />
            </div>

            <h3 className="text-white font-semibold mt-8 mb-3">Unlimited Plan</h3>
            <div className="max-w-xs">
              <PricingTier
                name="Unlimited Plan"
                price="₹299"
                badge="BEST VALUE"
                highlight
                features={['Unlimited game sessions', 'AI limits still apply', 'Never run out of sessions', 'Instant activation']}
              />
            </div>

            <h3 className="text-white font-semibold mt-8 mb-3">AI Generation Packs</h3>
            <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
              <PricingTier
                name="+10 AI Generations"
                price="₹49"
                features={['+10 credits added', '₹4.90 per generation', 'Never expires']}
              />
              <PricingTier
                name="+20 AI Generations"
                price="₹79"
                badge="SAVE"
                features={['+20 credits added', '₹3.95 per generation', 'Better value']}
              />
            </div>

            <h3 className="text-white font-semibold mt-8 mb-3">Payment Process</h3>
            <div className="space-y-3">
              <Step number={1} title="Choose a plan">Click Upgrade in the dashboard header or any upgrade prompt.</Step>
              <Step number={2} title="Razorpay checkout">A secure Razorpay payment dialog opens. Pay with UPI, card, net banking, or wallet.</Step>
              <Step number={3} title="Instant activation">On payment success, a new JWT is issued with your updated limits. No page reload needed.</Step>
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
              All purchases are one-time (not subscriptions). Session credits are cumulative — buying +50 sessions twice gives you +100 sessions total.
            </div>
          </Section>

          {/* ── FAQ ── */}
          <Section id="faq" title="Frequently Asked Questions">
            {[
              {
                q: 'Do students need an account to join a game?',
                a: 'No. Students can join any game with just a PIN and a display name — no account required. However, creating a student account lets them track their attempt history across sessions.',
              },
              {
                q: 'How many students can join a single session?',
                a: "There is no hard cap on player count per session. The platform has been tested with up to 60 concurrent players. Performance depends on HiveMQ's public broker capacity.",
              },
              {
                q: 'Can I edit a quiz after it has been used in a session?',
                a: 'Yes. Editing a quiz does not affect past sessions. Future sessions will use the updated version.',
              },
              {
                q: 'What happens if the host closes their browser mid-game?',
                a: 'The session remains active in the backend. Return to the Sessions tab in your dashboard and click Resume to re-enter the host view.',
              },
              {
                q: 'Are images stored permanently?',
                a: 'Yes. Images are uploaded to Google Cloud Storage and are retained as long as the quiz exists. Deleting a quiz removes its associated images.',
              },
              {
                q: 'What is the maximum question time limit?',
                a: 'The default is 20 seconds per question. You can configure this per-question in the quiz editor (range: 5–120 seconds).',
              },
              {
                q: 'Can I use PAE offline?',
                a: 'No. PAE requires an internet connection for real-time communication between the host and all players.',
              },
              {
                q: 'How do I become an admin?',
                a: 'Admin status is granted by the platform owner. Contact your administrator to request admin access, then log out and log back in for it to take effect.',
              },
              {
                q: 'Do session credits expire?',
                a: 'No. Purchased session and AI credits never expire. They stay on your account until used.',
              },
              {
                q: 'How is scoring calculated?',
                a: 'Correct answers earn points. The faster a student answers, the more points they receive (time-bonus scoring). Incorrect or unanswered questions score zero.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm flex items-center justify-between list-none select-none hover:bg-white/5 transition-colors">
                  {q}
                  <svg className="w-4 h-4 text-white/40 group-open:rotate-180 transition-transform shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-4 text-sm text-white/55 leading-relaxed border-t border-white/10 pt-3">{a}</div>
              </details>
            ))}
          </Section>

          {/* Footer CTA */}
          <div className="mt-8 bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/20 rounded-3xl p-8 text-center">
            <h2 className="text-2xl font-black text-white mb-2">Ready to get started?</h2>
            <p className="text-white/50 text-sm mb-6">Create your free account and run your first quiz in minutes.</p>
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/register"
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Create Free Account
              </Link>
              <Link
                to="/marketplace"
                className="px-6 py-3 bg-white/5 border border-white/15 rounded-2xl text-white/70 font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
