import { AREAS } from '../data/areas.js'
import { formatNumber } from '../data/progression.js'
import { damageRating, isBoss, recommendedDamage } from '../data/stages.js'
import { useGameStore } from '../store/useGameStore.js'

/** Colour and wording for each damage rating. */
export const RATING = {
  easy: { text: 'text-emerald-300', chip: 'bg-emerald-500/25 text-emerald-100', label: 'Easy' },
  fair: { text: 'text-amber-300', chip: 'bg-amber-500/25 text-amber-100', label: 'Fair fight' },
  risky: { text: 'text-orange-400', chip: 'bg-orange-500/25 text-orange-100', label: 'Grindy' },
  blocked: { text: 'text-rose-400', chip: 'bg-rose-500/25 text-rose-100', label: 'Too strong' },
}

/**
 * Where you are and how this level suits you.
 *
 * Parked in the left column rather than centred: the middle of the screen
 * belongs to the gate sign, which announces the level *ahead*. The recommended
 * number comes straight from the stage's health curve, and its colour says how
 * the fight will actually go at the player's current damage.
 */
export default function StageHeadline() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const clickPower = useGameStore((s) => s.clickPower)
  const areaIndex = useGameStore((s) => s.areaIndex)

  const area = AREAS[areaIndex] ?? AREAS[0]
  const recommended = recommendedDamage(stageIndex)
  const rating = RATING[damageRating(clickPower, stageIndex)] ?? RATING.fair
  const boss = isBoss(stageIndex)

  return (
    <div className="pointer-events-none absolute left-3 top-28 z-10 w-44 sm:top-24">
      <div className="arcade-panel px-3 py-2">
        <div
          className="text-[9px] font-black uppercase tracking-[0.2em]"
          style={{ color: area.enemyAccent }}
        >
          {area.name}
        </div>

        <div className="arcade-value text-2xl leading-none">
          {boss && <span className="mr-1 text-amber-300">★</span>}
          Stage {stageIndex + 1}
        </div>

        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/50">
            Needs
          </span>
          <span className={`text-lg font-black leading-none ${rating.text}`}>
            {formatNumber(recommended)}
          </span>
        </div>

        <div
          className={`mt-1 rounded-md px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide ${rating.chip}`}
        >
          {rating.label} - you hit {formatNumber(clickPower)}
        </div>
      </div>
    </div>
  )
}
