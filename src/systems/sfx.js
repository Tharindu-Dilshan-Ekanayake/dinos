import { EVENTS, on } from './events.js'
import {
  playAreaChange,
  playDenied,
  playEvolve,
  playHit,
  playPurchase,
  playRebirth,
  playStageClear,
} from './audio.js'

/**
 * Wires game events to the synthesised SFX.
 *
 * Installed once at boot rather than from a component, so audio never depends
 * on a particular part of the tree being mounted. Muting is handled inside the
 * audio module via the master gain.
 */
let installed = false

export function installSfx() {
  if (installed) return () => {}
  installed = true

  const unsubscribers = [
    on(EVENTS.HIT, ({ damage, maxHealth, crit, combo, source }) => {
      // Idle ticks fire ten times a second - silent by design.
      if (source !== 'click') return
      const share = maxHealth > 0 ? Math.min(1, damage / maxHealth) : 0.25
      playHit({ intensity: 0.25 + share * 0.75, combo, crit })
    }),
    on(EVENTS.STAGE_CLEAR, ({ boss }) => playStageClear({ boss })),
    on(EVENTS.EVOLVE, () => playEvolve()),
    on(EVENTS.REBIRTH, () => playRebirth()),
    on(EVENTS.AREA_CHANGE, () => playAreaChange()),
    on(EVENTS.PURCHASE, () => playPurchase()),
    on(EVENTS.DENIED, () => playDenied()),
  ]

  return () => {
    unsubscribers.forEach((off) => off())
    installed = false
  }
}
