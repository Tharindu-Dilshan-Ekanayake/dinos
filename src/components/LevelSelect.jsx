import { useEffect, useRef } from 'react'
import { areaForStage } from '../data/areas.js'
import { formatNumber } from '../data/progression.js'
import {
  MAX_STAGES,
  damageRating,
  isBoss,
  recommendedDamage,
  requiredDamage,
} from '../data/stages.js'
import { useGameStore } from '../store/useGameStore.js'
import { RATING } from './StageHeadline.jsx'

/**
 * The level list.
 *
 * Read-only on purpose. Every arena run starts at Stage 1 and the only way
 * deeper is to walk there, so this is a progress board and a damage reference -
 * not a fast-travel menu that would undercut the walk.
 */
function StageButton({ index, current, bestStage, clickPower }) {
  const rating = RATING[damageRating(clickPower, index)] ?? RATING.fair
  const boss = isBoss(index)
  const isCurrent = index === current
  const reached = index <= bestStage
  const locked = !reached
  // Areas now rotate one per stage rather than one per fifteen-stage block
  // (see data/areas.js), so there is no contiguous run to head a section with
  // - this dot is what still says which world a given stage actually is.
  const area = areaForStage(index)

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border p-1.5 ${
        isCurrent
          ? 'border-white bg-white/20'
          : reached
            ? 'border-white/15 bg-white/5'
            : 'border-white/5 bg-slate-900/60 opacity-50'
      }`}
      title={
        locked
          ? `${area.name} - not reached yet, walk there`
          : `${area.name} - needs ${formatNumber(requiredDamage(index))} damage (tuned for ${formatNumber(recommendedDamage(index))})`
      }
    >
      <span
        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
        style={{ background: area.enemyAccent, opacity: locked ? 0.35 : 1 }}
      />
      <span className="text-xs font-black leading-none text-white/90">
        {locked ? '🔒' : boss ? '★' : index + 1}
      </span>
      {!locked && (
        <span className={`mt-0.5 text-[9px] font-bold leading-none ${rating.text}`}>
          {formatNumber(recommendedDamage(index))}
        </span>
      )}
    </div>
  )
}

export default function LevelSelect({ open, onClose }) {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const bestStage = useGameStore((s) => s.bestStage)
  // Closed, this returns a constant and the sheet stops re-rendering on every
  // click happening behind it.
  const clickPower = useGameStore((s) => (open ? s.clickPower : 0))
  const currentRef = useRef(null)

  // Drop the player straight at the level they are on rather than the top.
  useEffect(() => {
    if (open) currentRef.current?.scrollIntoView({ block: 'center' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Select level"
    >
      <div className="arcade-panel flex max-h-[80vh] w-full max-w-md animate-pop-in flex-col p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wide text-white">Levels</h2>
          <span className="text-[11px] text-white/50">
            Best: Stage {Math.min(MAX_STAGES, bestStage + 1)}
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-relaxed text-white/50">
          Numbers are the damage each level is tuned for. Every run starts at Stage 1 - walk
          through the gates to get back here. The dot on each tile is the world it's set in - a
          different one nearly every stage.
        </p>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: MAX_STAGES }, (_, index) => (
              <div key={index} ref={index === stageIndex ? currentRef : null}>
                <StageButton
                  index={index}
                  current={stageIndex}
                  bestStage={bestStage}
                  clickPower={clickPower}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="arcade arcade-red mt-3 h-11 w-full text-sm"
          onPointerDown={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
