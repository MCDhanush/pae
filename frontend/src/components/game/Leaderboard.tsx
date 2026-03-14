import clsx from 'clsx'
import type { LeaderboardEntry } from '../../types'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  myPlayerId?: string | null
  compact?: boolean
  maxEntries?: number
}

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600']
const MEDAL_ICONS = ['🥇', '🥈', '🥉']

export default function Leaderboard({
  entries,
  myPlayerId,
  compact = false,
  maxEntries,
}: LeaderboardProps) {
  const displayed = maxEntries ? entries.slice(0, maxEntries) : entries

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">No scores yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {displayed.map((entry, index) => {
        const isMe = entry.player_id === myPlayerId
        const rank = entry.rank || index + 1

        return (
          <div
            key={entry.player_id}
            className={clsx(
              'flex items-center gap-3 rounded-xl transition-all duration-300 animate-fade-in',
              compact ? 'px-3 py-2' : 'px-4 py-3',
              isMe
                ? 'bg-primary-50 border-2 border-primary-300 shadow-sm'
                : rank <= 3
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-white border border-gray-100',
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Rank */}
            <div className={clsx(
              'font-bold shrink-0 text-center',
              compact ? 'w-6 text-sm' : 'w-8 text-base',
            )}>
              {rank <= 3 ? (
                <span className={MEDAL_COLORS[rank - 1]}>{MEDAL_ICONS[rank - 1]}</span>
              ) : (
                <span className="text-gray-500">#{rank}</span>
              )}
            </div>

            {/* Avatar */}
            <div className={clsx(
              'rounded-full bg-primary-600 text-white font-bold flex items-center justify-center shrink-0',
              compact ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm',
            )}>
              {entry.nickname.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className={clsx(
                'font-semibold truncate',
                compact ? 'text-sm' : 'text-base',
                isMe ? 'text-primary-700' : 'text-gray-900',
              )}>
                {entry.nickname}
                {isMe && <span className="ml-1 text-xs text-primary-500 font-normal">(you)</span>}
              </p>
            </div>

            {/* Score */}
            <div className={clsx(
              'font-bold tabular-nums shrink-0',
              compact ? 'text-sm' : 'text-base',
              isMe ? 'text-primary-600' : rank <= 3 ? 'text-yellow-700' : 'text-gray-700',
            )}>
              {entry.score.toLocaleString()}
            </div>
          </div>
        )
      })}

      {maxEntries && entries.length > maxEntries && (
        <p className="text-center text-xs text-gray-400 pt-1">
          +{entries.length - maxEntries} more players
        </p>
      )}
    </div>
  )
}
