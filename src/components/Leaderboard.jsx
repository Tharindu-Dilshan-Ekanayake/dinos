import { useEffect, useState } from 'react'
import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'
import {
  connectLeaderboard,
  disconnectLeaderboard,
  leaderboardEnabled,
  subscribeLeaderboard,
} from '../systems/leaderboard.js'

const STATUS_STYLES = {
  online: 'bg-emerald-400',
  connecting: 'bg-amber-400 animate-pulse',
  reconnecting: 'bg-amber-400 animate-pulse',
  error: 'bg-rose-400',
  offline: 'bg-white/30',
}

/**
 * Read-only board of the top players on a shared server. Hidden entirely when
 * no server is configured, so the single-player build carries no dead UI.
 */
export default function Leaderboard({ open, onToggle }) {
  const [board, setBoard] = useState(() => ({ status: 'offline', entries: [] }))

  useEffect(() => {
    if (!leaderboardEnabled) return undefined
    const unsubscribe = subscribeLeaderboard(setBoard)
    connectLeaderboard(() => {
      const s = useGameStore.getState()
      return {
        name: s.playerName,
        wins: s.lifetimeWins,
        rebirths: s.rebirths,
        bestStage: s.bestStage,
      }
    })
    return () => {
      unsubscribe()
      disconnectLeaderboard()
    }
  }, [])

  if (!leaderboardEnabled) return null

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-label="Leaderboard"
        className="arcade arcade-yellow h-11 gap-2 px-3 text-sm"
        onPointerDown={(e) => {
          e.stopPropagation()
          onToggle(!open)
        }}
      >
        <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[board.status] ?? STATUS_STYLES.offline}`} />
        🏆
      </button>

      {open && (
        <div
          className="arcade-panel absolute right-0 top-full mt-2 w-64 animate-slide-up p-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="hud-label">Top Dinos</span>
            <span className="text-[10px] uppercase text-white/40">{board.status}</span>
          </div>

          {board.entries.length === 0 ? (
            <p className="mt-2 text-[11px] text-white/50">
              {board.status === 'online'
                ? 'No scores posted yet.'
                : 'Waiting for the leaderboard server.'}
            </p>
          ) : (
            <ol className="mt-2 space-y-1">
              {board.entries.slice(0, 10).map((entry, i) => (
                <li
                  key={entry.id || `${entry.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-[11px]"
                >
                  <span className="w-4 text-white/40">{i + 1}</span>
                  <span className="flex-1 truncate font-semibold text-white/85">{entry.name}</span>
                  <span className="text-emerald-300">{formatNumber(entry.wins)}</span>
                  <span className="text-violet-300">x{entry.rebirths}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
