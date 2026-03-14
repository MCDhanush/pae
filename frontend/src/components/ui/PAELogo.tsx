interface PAELogoProps {
  variant?: 'dark' | 'light'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { box: 28, icon: 14, text: 'text-base' },
  md: { box: 36, icon: 18, text: 'text-lg' },
  lg: { box: 48, icon: 24, text: 'text-2xl' },
}

export default function PAELogo({ variant = 'dark', size = 'md', className = '' }: PAELogoProps) {
  const s = SIZES[size]
  const isDark = variant === 'dark'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon mark */}
      <div
        style={{ width: s.box, height: s.box }}
        className="shrink-0 relative"
      >
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="pae-grad-dark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
            <linearGradient id="pae-grad-light" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="40" height="40" rx="10" fill={isDark ? 'url(#pae-grad-dark)' : 'url(#pae-grad-light)'} />
          {/* Subtle inner glow */}
          <rect width="40" height="40" rx="10" fill="url(#pae-grad-dark)" opacity="0.2" />
          {/* P letterform - stem */}
          <rect x="9" y="9" width="3.5" height="22" rx="1.75" fill="white" />
          {/* P letterform - bowl top */}
          <path
            d="M12.5 9 H19 Q26 9 26 15.5 Q26 22 19 22 H12.5"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Accent dot — quiz/answer indicator */}
          <circle cx="30" cy="30" r="4" fill="rgba(255,255,255,0.25)" />
          <circle cx="30" cy="30" r="2" fill="white" opacity="0.9" />
        </svg>
      </div>

      {/* Wordmark */}
      <span
        className={`font-black tracking-tight leading-none ${s.text} ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        PAE
      </span>
    </div>
  )
}
