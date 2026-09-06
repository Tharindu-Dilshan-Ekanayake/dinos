import { useEffect, useRef } from 'react'
import { formatNumber } from '../data/progression.js'
import { EVENTS, on } from '../systems/events.js'

/**
 * "+1" style combat numbers.
 *
 * Nodes are created, animated and reaped imperatively. Holding them in React
 * state would re-render this subtree on every single click; here a burst of
 * taps costs a few appendChild calls and the compositor does the rest.
 */
const MAX_NODES = 26

export default function FloatingTexts() {
  const layer = useRef(null)
  const live = useRef([])

  useEffect(() => {
    const container = layer.current
    if (!container) return

    const spawn = (text, x, y, className, style = {}) => {
      // Hard cap: if the player is clicking faster than the animations finish,
      // drop the oldest rather than growing the DOM without bound.
      while (live.current.length >= MAX_NODES) {
        const oldest = live.current.shift()
        oldest?.remove()
      }

      const node = document.createElement('div')
      node.className = `float-text text-outline ${className}`
      node.textContent = text
      node.style.left = `${x}px`
      node.style.top = `${y}px`
      node.style.setProperty('--tilt', `${(Math.random() - 0.5) * 14}deg`)
      Object.assign(node.style, style)

      node.addEventListener(
        'animationend',
        () => {
          node.remove()
          live.current = live.current.filter((n) => n !== node)
        },
        { once: true }
      )

      container.appendChild(node)
      live.current.push(node)
    }

    const centre = () => [window.innerWidth / 2, window.innerHeight * 0.42]

    const unsubscribers = [
      on(EVENTS.HIT, ({ damage, crit, source, screen, combo }) => {
        if (source !== 'click') return
        const [cx, cy] = screen ?? centre()
        // Jitter so stacked clicks stay readable.
        const x = cx + (Math.random() - 0.5) * 48
        const y = cy + (Math.random() - 0.5) * 28

        if (crit) {
          spawn(`CRIT ${formatNumber(damage)}`, x, y, 'text-[26px] text-rose-300')
        } else {
          const grow = 1 + Math.min(combo, 8) * 0.045
          spawn(`-${formatNumber(damage)}`, x, y, 'text-amber-200', {
            fontSize: `${Math.round(19 * grow)}px`,
          })
        }
      }),

      /*
       * The damage a click *earns*, as opposed to the damage it deals. Thrown
       * up and to the right of the tap so it never lands on top of the hit
       * number, and tinted green because it is the number that only ever goes
       * up - which is the whole hook of the game.
       */
      on(EVENTS.DAMAGE_GAIN, ({ gain, screen }) => {
        const [cx, cy] = screen ?? centre()
        spawn(
          `+${formatNumber(gain)} 💪`,
          cx + 34 + Math.random() * 18,
          cy - 26 - Math.random() * 16,
          'text-[20px] text-emerald-300'
        )
      }),

      /*
       * A treadmill, once a second, carrying that whole second.
       *
       * Same muscle and same green as a click's gain, because it is the same
       * number going up by another route - and the point of a pad is that it
       * is your click power being multiplied, not some separate currency.
       */
      on(EVENTS.TRAIN_GAIN, ({ gain, multiplier }) => {
        const [cx, cy] = centre()
        spawn(
          `+${formatNumber(gain)} 💪`,
          cx + (Math.random() - 0.5) * 90,
          cy - 34 - Math.random() * 30,
          'text-emerald-300',
          // A faster pad throws a bigger number, and it should look bigger.
          { fontSize: `${Math.round(20 + Math.min(multiplier, 40) * 0.4)}px` }
        )
      }),

      on(EVENTS.STAGE_CLEAR, ({ reward, boss }) => {
        const [cx, cy] = centre()
        spawn(
          `+${formatNumber(reward)} WIN${reward === 1 ? '' : 'S'}`,
          cx,
          cy - 40,
          boss ? 'text-[38px] text-amber-300' : 'text-[28px] text-emerald-300'
        )
        if (boss) spawn('BOSS DOWN', cx, cy - 96, 'text-[22px] text-amber-200')
      }),

      /*
       * Falling. There is no panel to read it off any more, so the one thing
       * worth knowing - what the run cost you - is thrown up where every other
       * number in this game appears.
       */
      on(EVENTS.DEATH, ({ lostWins }) => {
        const [cx, cy] = centre()
        spawn('YOU FELL', cx, cy - 60, 'text-[34px] text-rose-300')
        if (lostWins > 0) {
          spawn(
            `-${formatNumber(lostWins)} WINS`,
            cx,
            cy - 8,
            'text-[24px] text-rose-200'
          )
        }
      }),

      on(EVENTS.EVOLVE, ({ to }) => {
        const [cx, cy] = centre()
        spawn(`EVOLVED - ${to.name.toUpperCase()}`, cx, cy - 130, 'text-[30px] text-yellow-200')
      }),

      on(EVENTS.REBIRTH, ({ multiplier }) => {
        const [cx, cy] = centre()
        spawn(`REBIRTH x${multiplier.toFixed(1)}`, cx, cy - 130, 'text-[34px] text-violet-200')
      }),
    ]

    return () => {
      unsubscribers.forEach((off) => off())
      live.current.forEach((node) => node.remove())
      live.current = []
    }
  }, [])

  return <div ref={layer} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" />
}
