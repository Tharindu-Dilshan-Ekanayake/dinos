import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
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
 * Turns attack input into damage on whatever the player is currently targeting.
 *
 * A manual swing - a tap, a click, or the attack button - always lands on the
 * current target regardless of distance: this is a clicker at heart, and
 * making a click do nothing just because the dino hasn't walked over yet read
 * as broken rather than as a positioning game. Auto-fight is the one place
 * range still matters: it exists so a walkable clicker is not miserable to
 * play one tap at a time, and it only swings once you have actually closed
 * the distance, which is what keeps walking up to the pack meaningful.
 */
export default function ArenaCombat() {
  const autoTimer = useRef(0)
  const lastPrompt = useRef(null)
  const lastRemaining = useRef(-1)

  /*
   * Where the blow lands, in screen pixels.
   *
   * The floating numbers fall back to the middle of the screen when nothing
   * tells them better, which in the arena meant every hit and every `+n 💪`
   * piled up in the same spot regardless of which enemy you were fighting or
   * where it was standing. Projected through the camera they sit over the dino
   * being hit, so the damage you deal and the damage you gain both read as
   * coming out of the fight.
   */
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const projected = useMemo(() => new THREE.Vector3(), [])

  const toScreen = (x, y, z) => {
    projected.set(x, y, z).project(camera)
    // Behind the camera the projection turns inside out; better to say nothing
    // and let the number take its default place than to throw it off-screen.
    if (projected.z > 1) return null
    return [
      (projected.x * 0.5 + 0.5) * size.width,
      (-projected.y * 0.5 + 0.5) * size.height,
    ]
  }

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const state = useGameStore.getState()
    // Mounted permanently now (see ArenaScene.jsx), so this has to say for
    // itself that a swing - manual or auto-fight - only ever lands while you
    // are actually standing in the arena, not on your way up to the gate.
    if (state.scene !== 'arena') return

    const targetSlot = packState.targetSlot
    const hasTarget = targetSlot >= 0
    const inRange = hasTarget && packState.inRange

    const swing = () => {
      if (!hasTarget) return false
      const target = enemySlots[targetSlot]
      setLastImpact(target.x, 1.2, target.z)
      state.attack([target.x, 1.2, target.z], toScreen(target.x, 1.6, target.z))
      return true
    }

    // Manual swings: a tap, a click, or the attack button. These always land
    // on whatever the current target is; an empty room (no target at all)
    // still swings - same as clicking against nothing in the hub - it just
    // has nothing to set as the impact point, so the training gain and its
    // feedback fire with no target attached.
    if (consumeAttack()) {
      playSwing({ connects: hasTarget, heavy: state.evolutionIndex >= 6 })
      if (!swing()) state.attack()
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
