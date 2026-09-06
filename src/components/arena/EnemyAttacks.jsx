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
import { ATTACK_WINDUP_SECONDS, enemyAttackStyle } from '../../data/enemies.js'
import { isBoss, stageHealth } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playBite, playHurt } from '../../systems/audio.js'
import { EVENTS, emit } from '../../systems/events.js'
import { enemySlots, packState, slotHealthRatio } from '../../systems/arenaEnemies.js'
import { playerPosition } from '../../systems/playerState.js'
import { getTimeScale } from '../../systems/timeScale.js'

/**
 * Floor on the gap between two audible bites.
 *
 * A pack's cooldowns drift into step surprisingly easily, and five chomps on
 * the same frame is one loud click rather than five bites.
 */
const BITE_SOUND_INTERVAL = 0.12

/** How often your own dino is allowed to yelp, however hard it is being hit. */
const HURT_SOUND_INTERVAL = 0.7

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
      // Whether each slot has already announced the swing it is winding up.
      winding: new Uint8Array(MAX_ENEMIES),
      pendingDamage: 0,
      pendingHeal: 0,
      sinceHit: REGEN_DELAY,
      flush: 0,
      sinceBiteSound: BITE_SOUND_INTERVAL,
      sinceHurtSound: HURT_SOUND_INTERVAL,
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
      state.winding.fill(0)
      state.pendingDamage = 0
      state.sinceHit = 0
    }

    if (store.dead) return

    state.sinceBiteSound += delta
    state.sinceHurtSound += delta

    if (!store.stageCleared) {
      const ratio = Math.max(0, Math.min(1, store.enemyHealth / stageHealth(store.stageIndex)))
      const bite = enemyBite(store.clickPower, store.stageIndex)
      const boss = isBoss(store.stageIndex)

      for (let slot = 0; slot < packState.slotCount; slot++) {
        if (slotHealthRatio(ratio, slot, packState.slotCount) <= 0) {
          state.cooldowns[slot] = 0
          state.winding[slot] = 0
          continue
        }

        /*
         * Every shape fights its own way. A sailback breathes fire from twice
         * the reach of a runner's teeth, and a shielded one hits half as often
         * for half again as hard - so a pack is a set of problems rather than
         * five copies of one.
         */
        const style = enemyAttackStyle(store.stageIndex, slot, boss)
        const reach = ENEMY_ATTACK_RANGE * style.reach

        const enemy = enemySlots[slot]
        const dx = playerPosition.x - enemy.x
        const dz = playerPosition.z - enemy.z

        if (dx * dx + dz * dz > reach * reach) {
          // Out of reach: it has to wind up again next time it closes.
          state.cooldowns[slot] = 0
          state.winding[slot] = 0
          continue
        }

        state.cooldowns[slot] += delta
        const interval = ENEMY_ATTACK_INTERVAL * style.interval

        /*
         * The tell, a moment before the blow. This is the half of an attack
         * that lets you get out of the way, and it comes off the same cooldown
         * as the hit, so the animation can never land on a different frame
         * from the damage it is supposed to be delivering.
         */
        if (!state.winding[slot] && state.cooldowns[slot] >= interval - ATTACK_WINDUP_SECONDS) {
          state.winding[slot] = 1
          emit(EVENTS.ENEMY_WINDUP, { slot, tell: style.tell })
        }

        if (state.cooldowns[slot] >= interval) {
          state.cooldowns[slot] -= interval
          state.winding[slot] = 0
          state.pendingDamage += bite * style.power
          state.sinceHit = 0

          // The blow itself, for whatever wants to draw it.
          emit(EVENTS.ENEMY_ATTACK, {
            slot,
            tell: style.tell,
            color: style.color,
            from: [enemy.x, enemy.z],
            to: [playerPosition.x, playerPosition.z],
            boss,
          })

          // Health is committed in batches, but a blow is a moment - it has to
          // be heard when it lands, not when the store next catches up.
          if (state.sinceBiteSound >= BITE_SOUND_INTERVAL) {
            state.sinceBiteSound = 0
            playBite({ heavy: boss || style.sound === 'heavy', style: style.sound })
          }
          if (state.sinceHurtSound >= HURT_SOUND_INTERVAL) {
            state.sinceHurtSound = 0
            playHurt()
          }
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
