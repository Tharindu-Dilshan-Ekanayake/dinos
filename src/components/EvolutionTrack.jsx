import { EVOLUTIONS, nextEvolution } from '../data/evolutions.js'
import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Current tier plus progress toward the next unlock - the carrot that keeps
 * the clicking loop pointed somewhere.
 */
export default function EvolutionTrack() {
  const evolutionIndex = useGameStore((s) => s.evolutionIndex)
  const totalWins = useGameStore((s) => s.totalWins)

  const current = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const next = nextEvolution(evolutionIndex)

  const from = current.unlockAtWins
  const to = next?.unlockAtWins ?? from
  const progress = next ? Math.min(1, Math.max(0, (totalWins - from) / (to - from))) : 1

  return (
    <div className="arcade-panel px-3 py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="truncate text-sm font-black uppercase tracking-wide"
          style={{ color: current.aura }}
        >
          {current.name}
        </span>
        <span className="shrink-0 text-[10px] text-white/45">
          {next
            ? `${formatNumber(Math.max(0, to - totalWins))} to ${next.name}`
            : 'Max tier'}
        </span>
      </div>

      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-black/50 bg-slate-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-yellow-300 transition-[width] duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
