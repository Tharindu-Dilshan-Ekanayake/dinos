import { EVOLUTIONS, nextEvolution } from '../data/evolutions.js'
import { formatNumber } from '../data/progression.js'
import { UPGRADE_LIST, upgradeCost } from '../data/upgrades.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * The stat strip along the bottom of the screen.
 *
 * Everything a player checks between clicks, in one place: what their damage
 * is, which dino is earning it and how fast, how close the next tier is, and
 * what they can buy right now. It follows the reference game's layout - a big
 * damage readout over a tier bar over a row of priced upgrade buttons - but
 * sits at the bottom, out of the way of the headline and the level list.
 *
 * Shown in the hub and the arena alike, because clicking earns damage in both.
 */
export default function BottomDetails() {
  // The formatted text, so a click only re-renders this when the digits move.
  const damageText = useGameStore((s) => formatNumber(s.clickPower))
  const wins = useGameStore((s) => s.wins)
  const totalWins = useGameStore((s) => s.totalWins)
  const evolutionIndex = useGameStore((s) => s.evolutionIndex)
  const unlockedIndex = useGameStore((s) => s.unlockedIndex)
  const upgradeLevels = useGameStore((s) => s.upgradeLevels)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)

  const equipped = EVOLUTIONS[evolutionIndex] ?? EVOLUTIONS[0]
  const next = nextEvolution(unlockedIndex)

  // Progress toward the next tier unlocking, measured in lifetime Wins.
  const from = EVOLUTIONS[unlockedIndex]?.unlockAtWins ?? 0
  const to = next?.unlockAtWins ?? from
  const progress = next ? Math.min(1, Math.max(0, (totalWins - from) / Math.max(1, to - from))) : 1

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-20 flex justify-center px-2 sm:bottom-20">
      <div className="arcade-panel w-full max-w-sm px-3 py-2">
        {/* Damage, and what is earning it. */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-black uppercase leading-none tracking-wide text-amber-300 drop-shadow">
            {damageText}
            <span className="ml-1 text-[0.65rem] text-white/60">DAMAGE</span>
          </span>
          <span className="truncate text-[0.65rem] font-black uppercase tracking-wider text-white/70">
            {equipped.name}
            <span className="ml-1 text-emerald-300">+{formatNumber(equipped.power)}/click</span>
          </span>
        </div>

        {/* Tier progress: the bar the reference game calls a level. */}
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-[0.55rem] font-black uppercase tracking-wider text-white/50">
            <span>Tier {unlockedIndex + 1}</span>
            <span>
              {next ? `${formatNumber(totalWins)} / ${formatNumber(to)} wins` : 'MAX'}
            </span>
          </div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-900/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Priced upgrades, buyable without opening the shop. */}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {UPGRADE_LIST.map((upgrade) => {
            const level = upgradeLevels[upgrade.id] ?? 0
            const maxed = level >= upgrade.maxLevel
            const cost = upgradeCost(upgrade.id, level)
            const afford = !maxed && wins >= cost

            return (
              <button
                key={upgrade.id}
                type="button"
                disabled={!afford}
                onPointerDown={(e) => {
                  // The click that buys must not also swing at the enemy.
                  e.stopPropagation()
                  if (afford) buyUpgrade(upgrade.id)
                }}
                className={`arcade pointer-events-auto h-10 flex-col gap-0 px-1 ${
                  maxed ? 'arcade-slate' : afford ? 'arcade-green' : 'arcade-slate opacity-60'
                }`}
              >
                <span className="text-[0.65rem] leading-none">
                  {upgrade.icon} {maxed ? 'MAX' : formatNumber(cost)}
                </span>
                <span className="text-[0.5rem] leading-none opacity-80">Lv {level}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
