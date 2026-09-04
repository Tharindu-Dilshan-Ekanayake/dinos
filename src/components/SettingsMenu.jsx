import { useState } from 'react'
import { useGameStore } from '../store/useGameStore.js'
import { clearSave, persistenceAvailable } from '../systems/persistence.js'
import { formatNumber } from '../data/progression.js'

/**
 * Corner settings menu: mute, name, and a guarded save wipe.
 */
export default function SettingsMenu({ open, onToggle }) {
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const resetSave = useGameStore((s) => s.resetSave)
  const playerName = useGameStore((s) => s.playerName)
  const setPlayerName = useGameStore((s) => s.setPlayerName)
  const rebirths = useGameStore((s) => s.rebirths)
  const lifetimeWins = useGameStore((s) => s.lifetimeWins)
  const bestStage = useGameStore((s) => s.bestStage)

  const [confirmingReset, setConfirmingReset] = useState(false)

  const doReset = () => {
    // Clear the stored copy first, then the live state, so the debounced writer
    // has nothing stale left to flush back out.
    clearSave()
    resetSave()
    setConfirmingReset(false)
    onToggle(false)
  }

  return (
    <div className="pointer-events-auto relative">
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="arcade arcade-blue h-11 w-11 text-lg"
          onPointerDown={(e) => {
            e.stopPropagation()
            toggleMute()
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          aria-label="Settings"
          className="arcade arcade-slate h-11 w-11 text-lg"
          onPointerDown={(e) => {
            e.stopPropagation()
            onToggle(!open)
          }}
        >
          ⚙️
        </button>
      </div>

      {open && (
        <div
          className="arcade-panel absolute right-0 top-full mt-2 w-64 animate-slide-up p-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="hud-label">Settings</div>

          <label className="mt-2 block">
            <span className="text-[11px] text-white/60">Leaderboard name</span>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Anonymous Dino"
              maxLength={16}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/80 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
            />
          </label>

          <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-slate-900/50 p-2 text-[11px] text-white/60">
            <div className="flex justify-between">
              <span>Rebirths</span>
              <span className="font-semibold text-white/85">{rebirths}</span>
            </div>
            <div className="flex justify-between">
              <span>Lifetime wins</span>
              <span className="font-semibold text-white/85">{formatNumber(lifetimeWins)}</span>
            </div>
            <div className="flex justify-between">
              <span>Best stage</span>
              <span className="font-semibold text-white/85">{bestStage + 1}</span>
            </div>
          </div>

          {!persistenceAvailable && (
            <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-[11px] text-amber-200">
              Storage is unavailable here, so progress will not be saved.
            </p>
          )}

          {confirmingReset ? (
            <div className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/15 p-2">
              <p className="text-[11px] text-rose-100">
                Erase everything, including {rebirths} rebirth{rebirths === 1 ? '' : 's'}? This
                cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="hud-button h-9 flex-1 text-xs"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setConfirmingReset(false)
                  }}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="hud-button h-9 flex-1 border-rose-300/60 bg-rose-500/40 text-xs text-white"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    doReset()
                  }}
                >
                  Erase
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="hud-button mt-3 h-10 w-full border-rose-400/30 text-xs text-rose-200"
              onPointerDown={(e) => {
                e.stopPropagation()
                setConfirmingReset(true)
              }}
            >
              Reset Save
            </button>
          )}
        </div>
      )}
    </div>
  )
}
