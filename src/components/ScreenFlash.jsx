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
      // Red, and stronger the closer the bite takes you to the end. Kept
      // light: this fires every time something lands, so it has to register
      // without blinding you mid-fight.
      on(EVENTS.PLAYER_HURT, ({ health, max }) =>
        flash('rgba(244,63,94,0.85)', 0.16 + (1 - health / max) * 0.28)
      ),
      on(EVENTS.STAGE_CLEAR, ({ boss }) =>
        flash(boss ? 'rgba(255,183,3,0.85)' : 'rgba(226,255,251,0.7)', boss ? 0.55 : 0.3)
      ),
      on(EVENTS.EVOLVE, () => flash('rgba(255,214,102,0.9)', 0.7)),
      on(EVENTS.REBIRTH, () => flash('rgba(201,163,255,0.95)', 0.9)),
      /*
       * Crossing between the hub and the arena, or from one biome into the
       * next, used to wash the screen white.
       *
       * Both are *seams*, and the whole point of the corridor is that there
       * are none: the hub rises into the arena down a ramp you can see the
       * length of, and the biomes lerp their colours over a second and a half.
       * A flash on top of that announces a loading screen that is not there.
       * What is left flashes for things that actually happened to you.
       */
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
