import { useEffect } from 'react'
import {
  REBIRTH_MULTIPLIER_PER,
  REBIRTH_WINS_REQUIRED,
  formatNumber,
  rebirthMultiplier,
} from '../data/progression.js'
import { EVOLUTIONS } from '../data/evolutions.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Rebirth confirmation. A Tailwind modal rather than window.confirm, so the
 * player can see exactly what they trade away and what they gain before
 * committing.
 */
export default function RebirthModal({ open, onClose }) {
  const rebirths = useGameStore((s) => s.rebirths)
  const totalWins = useGameStore((s) => s.totalWins)
  const stageIndex = useGameStore((s) => s.stageIndex)
  const evolutionIndex = useGameStore((s) => s.evolutionIndex)
  const doRebirth = useGameStore((s) => s.rebirth)

  const eligible = totalWins >= REBIRTH_WINS_REQUIRED
  const current = rebirthMultiplier(rebirths)
  const projected = rebirthMultiplier(rebirths + 1)

  // Escape closes, matching what a keyboard user expects from a dialog.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const confirm = () => {
    if (doRebirth()) onClose()
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm rebirth"
    >
      <div className="arcade-panel w-full max-w-sm animate-pop-in p-5">
        <div className="text-center">
          <div className="text-3xl">🥚</div>
          <h2 className="mt-1 text-xl font-black uppercase tracking-wide text-violet-200">
            Rebirth?
          </h2>
        </div>

        <p className="mt-3 text-center text-sm leading-relaxed text-white/70">
          You restart at Stage 1 as a {EVOLUTIONS[0].name} and lose your Wins and upgrades.
          Every rebirth is permanent and stacks.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="hud-label">Now</div>
            <div className="mt-1 text-2xl font-black text-white/80">x{current.toFixed(1)}</div>
          </div>
          <div className="rounded-xl border border-violet-400/40 bg-violet-500/15 p-3">
            <div className="hud-label text-violet-200/70">After</div>
            <div className="mt-1 text-2xl font-black text-violet-200">x{projected.toFixed(1)}</div>
          </div>
        </div>

        <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs text-white/60">
          <div className="flex justify-between">
            <span>You give up</span>
            <span className="font-semibold text-rose-300">
              Stage {stageIndex + 1} - {EVOLUTIONS[evolutionIndex].name}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Run wins</span>
            <span className="font-semibold text-white/80">{formatNumber(totalWins)}</span>
          </div>
          <div className="flex justify-between">
            <span>You gain</span>
            <span className="font-semibold text-emerald-300">
              +{Math.round(REBIRTH_MULTIPLIER_PER * 100)}% permanent power
            </span>
          </div>
        </div>

        {!eligible && (
          <p className="mt-3 rounded-lg bg-rose-500/15 p-2 text-center text-xs text-rose-200">
            You need {formatNumber(REBIRTH_WINS_REQUIRED - totalWins)} more run wins.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="arcade arcade-slate h-12 flex-1"
            onPointerDown={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!eligible}
            className="arcade arcade-purple h-12 flex-1"
            onPointerDown={(e) => {
              e.stopPropagation()
              confirm()
            }}
          >
            Rebirth
          </button>
        </div>
      </div>
    </div>
  )
}
