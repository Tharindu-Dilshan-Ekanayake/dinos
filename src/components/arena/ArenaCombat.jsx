import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ATTACK_RANGE } from '../../data/arena.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playSwing } from '../../systems/audio.js'
import { EVENTS, emit } from '../../systems/events.js'
import { consumeAttack } from '../../systems/input.js'
import { enemySlots, packState, setLastImpact } from '../../systems/arenaEnemies.js'
import { playerPosition } from '../../systems/playerState.js'

/** Auto-fight swings this many times a second. */
const AUTO_ATTACK_INTERVAL = 0.45

/**
 * Turns attack input into damage on whatever the player is standing next to.
 *
 * An attack only lands inside ATTACK_RANGE, which is what makes the arena a
 * place you move through rather than a button you hold from the doorway. When
 * you are out of range the swing is refused and the HUD says why.
 *
 * Auto-fight exists because a walkable clicker is miserable to play one tap at
 * a time; it still respects range, so positioning keeps mattering.
 */
export default function ArenaCombat() {
  const autoTimer = useRef(0)
  const lastPrompt = useRef(null)
  const lastRemaining = useRef(-1)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const state = useGameStore.getState()

    const targetSlot = packState.targetSlot
    const hasTarget = targetSlot >= 0
    const inRange = hasTarget && packState.inRange

    const swing = () => {
      if (!inRange) return false
      const target = enemySlots[targetSlot]
      setLastImpact(target.x, 1.2, target.z)
      state.attack([target.x, 1.2, target.z])
      return true
    }

    // Manual swings: a tap, a click, or the attack button.
    if (consumeAttack()) {
      // The swing is heard whether or not it finds anything - a blow through
      // empty air still swishes, and that thinner sound is the feedback that
      // you are out of reach.
      playSwing({ connects: inRange, heavy: state.evolutionIndex >= 6 })
      if (hasTarget && !inRange) {
        emit(EVENTS.DENIED, { reason: 'range' })
      } else {
        swing()
      }
    }

    // Auto-fight.
    if (state.autoFight && inRange) {
      autoTimer.current += delta
      while (autoTimer.current >= AUTO_ATTACK_INTERVAL) {
        autoTimer.current -= AUTO_ATTACK_INTERVAL
        playSwing({ heavy: state.evolutionIndex >= 6 })
        swing()
      }
    } else {
      autoTimer.current = 0
    }

    // Tell the HUD what the player is up against, but only when it changes.
    const prompt = !hasTarget
      ? 'clear'
      : inRange
        ? 'fight'
        : 'approach'
    // Re-emit when either the situation or the head-count changes, so the
    // "enemies left" readout tracks the pack thinning out.
    if (prompt !== lastPrompt.current || packState.aliveCount !== lastRemaining.current) {
      lastPrompt.current = prompt
      lastRemaining.current = packState.aliveCount
      emit(EVENTS.ARENA_PROMPT, {
        kind: prompt,
        remaining: packState.aliveCount,
        range: ATTACK_RANGE,
      })
    }
  })

  return null
}

/** Distance from the player to the current target, for HUD readouts. */
export function targetDistance() {
  if (packState.targetSlot < 0) return Infinity
  const target = enemySlots[packState.targetSlot]
  return Math.hypot(playerPosition.x - target.x, playerPosition.z - target.z)
}
