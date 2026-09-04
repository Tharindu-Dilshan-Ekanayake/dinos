import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Shown when your dino falls, either way it can happen.
 *
 * There are two: walking through a gate you are underpowered for, which the
 * arena lets you do on purpose after warning you in red, and being worn down
 * by the pack in a level you stayed in too long. The screen has to say which
 * one it was and what to do about it, rather than just "you died".
 */
export default function DeathOverlay() {
  const dead = useGameStore((s) => s.dead)
  const reason = useGameStore((s) => s.deathReason)
  const respawn = useGameStore((s) => s.respawn)

  if (!dead) return null

  const stage = (reason?.stageIndex ?? 0) + 1
  const required = reason?.required ?? 0
  const damage = reason?.damage ?? 0
  const shortfall = Math.max(0, required - damage)
  const lostWins = reason?.lostWins ?? 0
  const slain = reason?.cause === 'slain'

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-rose-950/80 p-4 backdrop-blur-sm">
      <div className="arcade-panel w-full max-w-sm animate-pop-in p-5 text-center">
        <div className="text-4xl">💀</div>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-rose-300">
          {slain ? 'The pack got you' : 'Your dino fell'}
        </h2>

        {slain ? (
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Stage {stage} chewed you down to nothing. Every dino still standing
            near you bites, so a pack you cannot drop quickly will drop you
            instead.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Stage {stage} was too strong. You walked in with{' '}
            <span className="font-black text-amber-300">{formatNumber(damage)}</span> damage and it
            demands at least{' '}
            <span className="font-black text-rose-300">{formatNumber(required)}</span>.
          </p>
        )}

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left text-xs text-white/60">
          {!slain && (
            <div className="flex justify-between">
              <span>Damage short by</span>
              <span className="font-black text-rose-300">{formatNumber(shortfall)}</span>
            </div>
          )}
          {lostWins > 0 && (
            <div className="mt-1 flex justify-between">
              <span>Wins lost</span>
              <span className="font-black text-rose-300">{formatNumber(lostWins)}</span>
            </div>
          )}
          <p className="mt-2 leading-relaxed">
            {slain
              ? 'Back off when your health drops - out of reach, it comes back. Kill the pack faster by training on a pad, buying Bite Force, or equipping a stronger evolution. And bank your Wins on a Return pad before pushing deeper.'
              : 'Train on a pad in the hub, buy Bite Force, or equip a stronger evolution before you try that gate again. Next time, step on a Return pad to bank your Wins first.'}
          </p>
        </div>

        <button
          type="button"
          className="arcade arcade-green mt-4 h-12 w-full text-sm"
          onPointerDown={(e) => {
            e.stopPropagation()
            respawn()
          }}
        >
          Back to the Hub
        </button>
      </div>
    </div>
  )
}
