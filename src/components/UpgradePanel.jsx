import { UPGRADE_LIST, upgradeCost } from '../data/upgrades.js'
import { formatNumber } from '../data/progression.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Wins shop. Sits at the bottom of the screen so every control stays inside
 * comfortable thumb reach on a phone, and stays deliberately short so it never
 * eats the play area.
 */
function UpgradeButton({ upgrade, wins, level, onBuy, onBuyMax }) {
  const maxed = level >= upgrade.maxLevel
  const cost = maxed ? Infinity : upgradeCost(upgrade.id, level)
  const affordable = !maxed && wins >= cost

  return (
    <div
      className={`flex-1 rounded-xl border-2 px-2 py-1.5 transition ${
        affordable ? 'border-emerald-300/70 bg-emerald-500/15' : 'border-black/40 bg-white/5'
      }`}
      title={upgrade.blurb}
    >
      <div className="flex items-center gap-1">
        <span className="text-sm leading-none">{upgrade.icon}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-wide text-white/80">
          {upgrade.name}
        </span>
        <span className="text-[10px] font-semibold text-white/40">{level}</span>
      </div>

      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            onBuy(upgrade.id)
          }}
          disabled={maxed}
          className={`arcade h-9 flex-1 text-[11px] ${
            affordable ? 'arcade-green' : 'arcade-slate'
          }`}
        >
          {maxed ? 'MAX' : formatNumber(cost)}
        </button>
        <button
          type="button"
          aria-label={`Buy as many ${upgrade.name} levels as possible`}
          onPointerDown={(e) => {
            e.stopPropagation()
            onBuyMax(upgrade.id)
          }}
          disabled={maxed || !affordable}
          className="arcade arcade-blue h-9 w-9 text-[9px] tracking-tight"
        >
          ALL
        </button>
      </div>
    </div>
  )
}

export default function UpgradePanel() {
  const wins = useGameStore((s) => s.wins)
  const upgradeLevels = useGameStore((s) => s.upgradeLevels)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const buyUpgradeMax = useGameStore((s) => s.buyUpgradeMax)

  return (
    <div className="arcade-panel pointer-events-auto flex gap-1.5 p-1.5">
      {UPGRADE_LIST.map((upgrade) => (
        <UpgradeButton
          key={upgrade.id}
          upgrade={upgrade}
          wins={wins}
          level={upgradeLevels[upgrade.id] ?? 0}
          onBuy={buyUpgrade}
          onBuyMax={buyUpgradeMax}
        />
      ))}
    </div>
  )
}
