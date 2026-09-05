import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Shown when your dino falls.
 *
 * There is one way now: the pack wore you down. Walking through a gate
 * underpowered used to be the other and killed you before you had swung once,
 * so this had a second face telling you what number you were short by. The
 * level itself is the test instead, and what this has to say is what went
 * wrong in the fight and what to do about it - not just "you died".
 */
export default function DeathOverlay() {
  const dead = useGameStore((s) => s.dead)
  const reason = useGameStore((s) => s.deathReason)
  const respawn = useGameStore((s) => s.respawn)

  if (!dead) return null

  const stage = (reason?.stageIndex ?? 0) + 1
  const lostWins = reason?.lostWins ?? 0

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-rose-950/80 p-4 backdrop-blur-sm">
      <div className="arcade-panel w-full max-w-sm animate-pop-in p-5 text-center">
        <div className="text-4xl">💀</div>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-rose-300">
          The pack got you
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Stage {stage} chewed you down to nothing. Every dino still standing
          near you bites, so a pack you cannot drop quickly will drop you
          instead.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-left text-xs text-white/60">
          {lostWins > 0 && (
            <div className="flex justify-between">
              <span>Wins lost</span>
              <span className="font-black text-rose-300">{formatNumber(lostWins)}</span>
            </div>
          )}
          <p className="mt-2 leading-relaxed">
            Back off when your health drops - out of reach it comes back, and
            walking into the level behind you leaves the pack there. Kill them
            faster by training on a pad, buying Bite Force, or equipping a
            stronger evolution. And bank your Wins on a Return pad before
            pushing deeper.
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
