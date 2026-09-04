import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MAX_ENEMIES } from '../../data/arena.js'
import {
  ENEMY_ATTACK_INTERVAL,
  ENEMY_ATTACK_RANGE,
  HEALTH_FLUSH_INTERVAL,
  HEALTH_REGEN_PER_SECOND,
  REGEN_DELAY,
  enemyBite,
} from '../../data/combat.js'
import { stageHealth } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { enemySlots, packState, slotHealthRatio } from '../../systems/arenaEnemies.js'
import { playerPosition } from '../../systems/playerState.js'
import { getTimeScale } from '../../systems/timeScale.js'

/**
 * The pack biting back.
 *
 * Any enemy still standing within reach takes a bite on its own cooldown, so
 * wading into the middle of five of them costs five times what facing one
 * does. Walking out of reach stops it - the cooldown resets, so backing off
 * and coming in again always buys you a fresh moment before the first bite.
 *
 * Health is accumulated here and committed to the store a few times a second
 * rather than on every frame or every bite: the store is what the save and the
 * HUD hang off, and a fight should not be writing to it sixty times a second.
 */
export default function EnemyAttacks() {
  // One cooldown per pack slot, plus the pending damage and quiet timers.
  const state = useMemo(
    () => ({
      cooldowns: new Float32Array(MAX_ENEMIES),
      pendingDamage: 0,
      pendingHeal: 0,
      sinceHit: REGEN_DELAY,
      flush: 0,
    }),
    []
  )

  const wasStage = useRef(-1)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05) * getTimeScale()
    const store = useGameStore.getState()

    if (store.scene !== 'arena') return

    // A new level is a clean slate: nothing gets a bite in for free the
    // instant you walk through the gate.
    if (store.stageIndex !== wasStage.current) {
      wasStage.current = store.stageIndex
      state.cooldowns.fill(0)
      state.pendingDamage = 0
      state.sinceHit = 0
    }

    if (store.dead) return

    if (!store.stageCleared) {
      const ratio = Math.max(0, Math.min(1, store.enemyHealth / stageHealth(store.stageIndex)))
      const bite = enemyBite(store.clickPower, store.stageIndex)
      const rangeSquared = ENEMY_ATTACK_RANGE * ENEMY_ATTACK_RANGE

      for (let slot = 0; slot < packState.slotCount; slot++) {
        if (slotHealthRatio(ratio, slot, packState.slotCount) <= 0) {
          state.cooldowns[slot] = 0
          continue
        }

        const enemy = enemySlots[slot]
        const dx = playerPosition.x - enemy.x
        const dz = playerPosition.z - enemy.z

        if (dx * dx + dz * dz > rangeSquared) {
          // Out of reach: it has to wind up again next time it closes.
          state.cooldowns[slot] = 0
          continue
        }

        state.cooldowns[slot] += delta
        if (state.cooldowns[slot] >= ENEMY_ATTACK_INTERVAL) {
          state.cooldowns[slot] -= ENEMY_ATTACK_INTERVAL
          state.pendingDamage += bite
          state.sinceHit = 0
        }
      }
    }

    // Regeneration, once the fight has let up for a moment.
    state.sinceHit += delta
    if (state.pendingDamage <= 0 && state.sinceHit >= REGEN_DELAY) {
      state.pendingHeal += HEALTH_REGEN_PER_SECOND * delta
    }

    state.flush += delta
    if (state.flush < HEALTH_FLUSH_INTERVAL) return
    state.flush = 0

    if (state.pendingDamage > 0) {
      const amount = state.pendingDamage
      state.pendingDamage = 0
      state.pendingHeal = 0
      store.hurtPlayer(amount)
    } else if (state.pendingHeal > 0) {
      const amount = state.pendingHeal
      state.pendingHeal = 0
      store.healPlayer(amount)
    }
  })

  return null
}
