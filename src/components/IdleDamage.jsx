import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/useGameStore.js'
import { packState } from '../systems/arenaEnemies.js'
import { getTimeScale } from '../systems/timeScale.js'

/**
 * Passive damage from the "Primal Instinct" upgrade.
 *
 * Driven by useFrame with a delta accumulator rather than setInterval: a timer
 * keeps firing while the tab is backgrounded and drifts against the render
 * clock, whereas this stays in lockstep with the animation the player sees.
 *
 * Damage is batched and flushed at FLUSH_INTERVAL instead of every frame, so
 * idle DPS costs the store ten writes a second rather than sixty.
 *
 * It only lands *in reach*, on the same rule a swing obeys. Left ticking from
 * anywhere it meant a pack was dead before you had walked up to it - by the
 * middle of a run the idle rate is thousands a second against a chamber worth
 * a few thousand, so every level ended in the doorway with nothing to fight.
 * Passive damage is meant to be a dino that keeps biting while you hold still,
 * not one that clears the room from the entrance.
 */
const FLUSH_INTERVAL = 0.1

export default function IdleDamage() {
  const accumulator = useRef(0)
  const pending = useRef(0)

  useFrame((_, rawDelta) => {
    const idleDps = useGameStore.getState().idleDps
    if (idleDps <= 0) return

    if (packState.targetSlot < 0 || !packState.inRange) {
      // Drop what was building up, so stepping back in does not land a lump
      // of damage banked while you were walking over.
      accumulator.current = 0
      pending.current = 0
      return
    }

    // Clamp so a long stall (tab hidden, GPU hiccup) cannot dump one huge tick.
    const delta = Math.min(rawDelta, 0.25) * getTimeScale()
    pending.current += idleDps * delta
    accumulator.current += delta

    if (accumulator.current < FLUSH_INTERVAL) return

    const amount = pending.current
    accumulator.current = 0
    pending.current = 0
    if (amount > 0) useGameStore.getState().idleTick(amount)
  })

  return null
}
