import { useEffect, useRef } from 'react'
import { EVENTS, on } from '../systems/events.js'

/**
 * Full-screen colour flash on the big moments.
 *
 * Driven by a self-cancelling rAF loop that only runs while a flash is
 * actually decaying, so the idle cost is zero.
 */
export default function ScreenFlash() {
  const el = useRef(null)
  const strength = useRef(0)
  const raf = useRef(0)

  useEffect(() => {
    const tick = () => {
      raf.current = 0
      const node = el.current
      if (!node) return

      strength.current *= 0.86
      if (strength.current < 0.01) {
        strength.current = 0
        node.style.opacity = '0'
        return
      }
      node.style.opacity = String(strength.current)
      raf.current = requestAnimationFrame(tick)
    }

    const flash = (color, amount) => {
      const node = el.current
      if (!node) return
      node.style.background = color
      strength.current = Math.max(strength.current, amount)
      node.style.opacity = String(strength.current)
      if (!raf.current) raf.current = requestAnimationFrame(tick)
    }

    const unsubscribers = [
      on(EVENTS.STAGE_CLEAR, ({ boss }) =>
        flash(boss ? 'rgba(255,183,3,0.85)' : 'rgba(226,255,251,0.7)', boss ? 0.55 : 0.3)
      ),
      on(EVENTS.EVOLVE, () => flash('rgba(255,214,102,0.9)', 0.7)),
      on(EVENTS.REBIRTH, () => flash('rgba(201,163,255,0.95)', 0.9)),
      on(EVENTS.AREA_CHANGE, () => flash('rgba(255,255,255,0.8)', 0.6)),
      on(EVENTS.SCENE_CHANGE, () => flash('rgba(255,255,255,0.9)', 0.85)),
    ]

    return () => {
      unsubscribers.forEach((off) => off())
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <div
      ref={el}
      className="pointer-events-none absolute inset-0 z-30 opacity-0 mix-blend-screen"
      style={{ transition: 'none' }}
    />
  )
}
