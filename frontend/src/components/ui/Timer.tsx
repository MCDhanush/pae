import clsx from 'clsx'

interface TimerProps {
  total: number
  remaining: number
  showSeconds?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Timer({ total, remaining, showSeconds = true, size = 'md' }: TimerProps) {
  const percentage = total > 0 ? (remaining / total) * 100 : 0

  const barColor = clsx(
    'h-full rounded-full transition-all duration-1000 ease-linear',
    percentage > 50
      ? 'bg-green-500'
      : percentage > 25
        ? 'bg-yellow-500'
        : 'bg-red-500',
  )

  const textColor = clsx(
    'font-bold tabular-nums',
    percentage > 50
      ? 'text-green-700'
      : percentage > 25
        ? 'text-yellow-700'
        : 'text-red-700',
    size === 'sm' && 'text-lg',
    size === 'md' && 'text-2xl',
    size === 'lg' && 'text-4xl',
  )

  const barHeight = clsx(
    'w-full bg-gray-200 rounded-full overflow-hidden',
    size === 'sm' && 'h-2',
    size === 'md' && 'h-3',
    size === 'lg' && 'h-4',
  )

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {showSeconds && (
        <div className={textColor}>
          {remaining}s
        </div>
      )}
      <div className={barHeight}>
        <div
          className={barColor}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={remaining}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  )
}
