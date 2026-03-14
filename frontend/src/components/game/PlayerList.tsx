import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { Player } from '../../types'

interface PlayerListProps {
  players: Player[]
  maxVisible?: number
  compact?: boolean
}

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
]

function getAvatarColor(nickname: string): string {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function PlayerAvatar({ nickname, isNew }: { nickname: string; isNew?: boolean }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-1',
        isNew && 'animate-bounce-in',
      )}
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
          getAvatarColor(nickname),
        )}
      >
        {nickname.charAt(0).toUpperCase()}
      </div>
      <span className="text-xs text-gray-600 max-w-[56px] truncate text-center">{nickname}</span>
    </div>
  )
}

export default function PlayerList({ players, maxVisible, compact = false }: PlayerListProps) {
  const prevLengthRef = useRef(players.length)
  const newPlayerIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (players.length > prevLengthRef.current) {
      const newPlayers = players.slice(prevLengthRef.current)
      newPlayers.forEach((p) => newPlayerIds.current.add(p.id))
      // Clear new markers after animation
      setTimeout(() => {
        newPlayers.forEach((p) => newPlayerIds.current.delete(p.id))
      }, 600)
    }
    prevLengthRef.current = players.length
  }, [players])

  if (players.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm">Waiting for players to join...</p>
      </div>
    )
  }

  if (compact) {
    const displayed = maxVisible ? players.slice(0, maxVisible) : players
    const overflow = maxVisible && players.length > maxVisible ? players.length - maxVisible : 0

    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {displayed.map((player) => (
            <div
              key={player.id}
              title={player.nickname}
              className={clsx(
                'w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-xs',
                getAvatarColor(player.nickname),
                newPlayerIds.current.has(player.id) && 'animate-bounce-in',
              )}
            >
              {player.nickname.charAt(0).toUpperCase()}
            </div>
          ))}
          {overflow > 0 && (
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
              +{overflow}
            </div>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-700">
          {players.length} player{players.length !== 1 ? 's' : ''}
        </span>
      </div>
    )
  }

  const displayed = maxVisible ? players.slice(0, maxVisible) : players

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Players Joined</h3>
        <span className="badge badge-purple">
          {players.length} player{players.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {displayed.map((player) => (
          <PlayerAvatar
            key={player.id}
            nickname={player.nickname}
            isNew={newPlayerIds.current.has(player.id)}
          />
        ))}
        {maxVisible && players.length > maxVisible && (
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm">
              +{players.length - maxVisible}
            </div>
            <span className="text-xs text-gray-400">more</span>
          </div>
        )}
      </div>
    </div>
  )
}
