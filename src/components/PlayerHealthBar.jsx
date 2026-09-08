import { useEffect, useRef } from 'react'
import { MAX_PLAYER_HEALTH } from '../data/combat.js'
import { useGameStore } from '../store/useGameStore.js'

/**
 * Your own health, under the level bar.
 *
 * It used to hang in a plaque on the left of the screen with the enemy pack's
 * bar above it - two readouts in a corner nobody looks at during a fight, in a
 * place the reference keeps empty. Wearing the level bar's own chrome and
 * sitting directly beneath it, the bottom of the screen becomes one block you
 * read in a single glance: what you hit for, how far up the tiers you are, and
 * how much of you is left.
 *
 * Read from an rAF loop and written straight to the DOM rather than subscribed
 * through React: health moves on every bite and continuously while it
 * regenerates, and re-rendering the HUD for that would cost more than the
 * fight does.
 *
 * The bar shifts colour as it drains - green, amber, red - because in the
 * middle of a pack you read the colour long before you read the number.
 */
export default function PlayerHealthBar() {
  const fill = useRef(null)
  const label = useRef(null)
  const panel = useRef(null)

  useEffect(() => {
    let raf = 0
    let shown = 1
    let previous = performance.now()
    let lastText = ''

    const tick = (now) => {
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now

      const { playerHealth } = useGameStore.getState()
      const ratio = Math.max(0, Math.min(1, playerHealth / MAX_PLAYER_HEALTH))

      // Chases hard on the way down so a bite reads as a hit, and eases on the
      // way back up so regeneration reads as recovery.
      const rate = ratio < shown ? 18 : 6
      shown += (ratio - shown) * Math.min(1, delta * rate)

      if (fill.current) {
        fill.current.style.transform = `scaleX(${Math.max(0, shown)})`
        fill.current.style.backgroundColor =
          ratio > 0.55 ? '#4ade80' : ratio > 0.28 ? '#fbbf24' : '#f43f5e'
      }

      // A low bar pulses, so you notice it without watching it.
      if (panel.current) {
        const urgent = ratio <= 0.28 && ratio > 0
        panel.current.style.opacity = urgent
          ? String(0.75 + Math.abs(Math.sin(now / 260)) * 0.25)
          : '1'
      }

      const text = `${Math.max(0, Math.ceil(playerHealth))}%`
      if (label.current && text !== lastText) {
        lastText = text
        label.current.textContent = text
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={panel} className="level-bar level-bar-slim mt-2">
      {/*
        The fill is scaled rather than resized, so a bite lands on the same
        frame it is dealt instead of waiting on a layout pass - and its colour
        is driven from the loop above, which is why the gradient the level bar
        wears is switched off here.
      */}
      <div
        ref={fill}
        className="level-bar-fill w-full origin-left"
        style={{ backgroundColor: '#4ade80', backgroundImage: 'none', transform: 'scaleX(1)' }}
      />
      <div className="level-bar-label">
        <span>Health</span>
        <span ref={label}>100%</span>
      </div>
    </div>
  )
}
