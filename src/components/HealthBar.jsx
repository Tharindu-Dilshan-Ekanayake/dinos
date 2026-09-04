import { useEffect, useRef } from 'react'
import { formatNumber } from '../data/progression.js'
import { isBoss, stageHealth } from '../data/stages.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Enemy health readout.
 *
 * Health changes on every click and ten times a second from idle damage.
 * Subscribing React to it would re-render the HUD constantly, so this reads
 * the store from an rAF loop and writes straight to the DOM. Only the stage
 * number - which changes once per kill - goes through React.
 */
export default function HealthBar() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const boss = isBoss(stageIndex)

  const fill = useRef(null)
  const ghost = useRef(null)
  const label = useRef(null)

  useEffect(() => {
    let raf = 0
    let shown = 1
    let trailing = 1
    let lastText = ''
    let previous = performance.now()

    const tick = (now) => {
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now

      const { enemyHealth, stageIndex: currentStage } = useGameStore.getState()
      const max = stageHealth(currentStage)
      const ratio = Math.max(0, Math.min(1, enemyHealth / max))

      shown += (ratio - shown) * Math.min(1, delta * 24)
      trailing += (ratio - trailing) * Math.min(1, delta * 5)

      if (fill.current) fill.current.style.transform = `scaleX(${Math.max(0, shown)})`
      if (ghost.current) ghost.current.style.transform = `scaleX(${Math.max(0, trailing)})`

      const text = `${formatNumber(Math.max(0, enemyHealth))} / ${formatNumber(max)}`
      if (label.current && text !== lastText) {
        label.current.textContent = text
        lastText = text
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="hud-label">
          {boss ? <span className="text-amber-300">Boss - Stage {stageIndex + 1}</span> : `Stage ${stageIndex + 1}`}
        </span>
        <span ref={label} className="font-mono text-xs font-semibold text-white/80" />
      </div>

      <div className="relative h-4 w-full overflow-hidden rounded-full border border-white/15 bg-slate-900/80">
        <div
          ref={ghost}
          className="absolute inset-0 origin-left bg-white/35"
          style={{ transform: 'scaleX(1)' }}
        />
        <div
          ref={fill}
          className={`absolute inset-0 origin-left ${
            boss
              ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
              : 'bg-gradient-to-r from-rose-600 to-rose-400'
          }`}
          style={{ transform: 'scaleX(1)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
      </div>
    </div>
  )
}
