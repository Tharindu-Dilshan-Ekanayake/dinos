import { EVOLUTIONS, nextEvolution } from '../data/evolutions.js'
import { formatNumber, rebirthMultiplier } from '../data/progression.js'
import { UPGRADE_LIST, upgradeCost } from '../data/upgrades.js'
import { useGameStore } from '../store/useGameStore.js'
import PlayerHealthBar from './PlayerHealthBar.jsx'

/**
 * The stat strip along the bottom of the screen.
 *
 * Everything a player checks between clicks, in one place: what their damage
 * is, what their rebirths are multiplying it by, how close the next tier is,
 * and what they can buy right now. It follows the reference game's layout - a
 * multiplier line over a big damage readout over a level bar over a row of
 * priced buttons - but sits at the bottom, out of the way of the headline and
 * the level list.
 *
 * There is no plaque behind it any more.
 *
 * A dark rounded card under the numbers is what a *menu* looks like, and this
 * is not a menu - it is a readout, the same as the damage number floating over
 * a dino's head. Lettered heavily enough to read against grass, lava or snow
 * on its own, it stops being a panel sitting on the game and becomes part of
 * it, which is the whole difference between the reference's HUD and a toolbar.
 *
 * Shown in the hub and the arena alike, because clicking earns damage in both.
 */
export default function BottomDetails() {
  // The formatted text, so a click only re-renders this when the digits move.
  const damageText = useGameStore((s) => formatNumber(s.clickPower))
  const wins = useGameStore((s) => s.wins)
  const totalWins = useGameStore((s) => s.totalWins)
  const rebirths = useGameStore((s) => s.rebirths)
  const unlockedIndex = useGameStore((s) => s.unlockedIndex)
  const upgradeLevels = useGameStore((s) => s.upgradeLevels)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const scene = useGameStore((s) => s.scene)

  const next = nextEvolution(unlockedIndex)

  // Progress toward the next tier unlocking, measured in lifetime Wins.
  const from = EVOLUTIONS[unlockedIndex]?.unlockAtWins ?? 0
  const to = next?.unlockAtWins ?? from
  const progress = next ? Math.min(1, Math.max(0, (totalWins - from) / Math.max(1, to - from))) : 1

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-20 flex justify-center px-3 sm:bottom-20">
      <div className="w-full max-w-[28rem]">
        {/* What every rebirth so far is worth, said once and small. */}
        <div className="rb-text rb-text-sm text-center text-[0.8rem] normal-case leading-none">
          {`Rebirth: x${rebirthMultiplier(rebirths).toFixed(2)}`}
        </div>

        {/*
          The number the whole game is about, at the size that says so.

          Gold rather than white: it is the one figure on screen that is a
          score, and everything else down here - the level, the prices - is
          something you spend or earn *toward* it.
        */}
        <div className="rb-text rb-text-lg mt-1 text-center text-[2rem] leading-none text-[#ffc93c]">
          {`${damageText} Damage`}
        </div>

        {/* Tier progress: the bar the reference game calls a level. */}
        <div className="level-bar mt-2">
          <div className="level-bar-fill" style={{ width: `${progress * 100}%` }} />
          <div className="level-bar-label">
            <span>{`Level ${unlockedIndex + 1}`}</span>
            <span>{next ? `${formatNumber(totalWins)} / ${formatNumber(to)}` : 'MAX'}</span>
          </div>
        </div>

        {/* Nothing can bite you in the hub, so nothing there to report. */}
        {scene === 'arena' && <PlayerHealthBar />}

        {/* Priced upgrades, buyable without opening the shop. */}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
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
                className={`arcade pointer-events-auto h-14 gap-2 px-1 ${
                  maxed ? 'arcade-slate' : afford ? 'arcade-green' : 'arcade-slate opacity-60'
                }`}
              >
                {/*
                  A picture and a figure, on one line, and nothing else.

                  It carried its level on a second line underneath, which is
                  honest and which nobody reads: at this size the level was
                  half the height of the price and sat where the reference puts
                  clear space, so a row of three buttons came out as six lines
                  of type in the corner of a fight. The level belongs in the
                  shop, where you go to think about it; down here the only
                  question is what it costs.
                */}
                <span className="text-2xl leading-none">{upgrade.icon}</span>
                <span className="text-[1.1rem] leading-none">
                  {maxed ? 'MAX' : formatNumber(cost)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
