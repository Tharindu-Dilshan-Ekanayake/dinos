import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AREAS } from '../../data/areas.js'
import { ATTACK_RANGE, chamberOrigin, enemyFormation } from '../../data/arena.js'
import { enemyAppearance } from '../../data/enemies.js'
import { isBoss, stageHealth } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import {
  aliveCountFor,
  enemySlots,
  packState,
  resetPack,
} from '../../systems/arenaEnemies.js'
import { playerPosition } from '../../systems/playerState.js'
import EnemyDino from './EnemyDino.jsx'

/**
 * The enemy pack for the current stage.
 *
 * Targeting lives here rather than in each enemy so there is exactly one
 * answer to "who am I hitting" per frame. The target is the highest live slot,
 * and the formation is ordered far-to-near, so the pack is cut down from the
 * front and the fight walks you deeper into the arena.
 */
export default function EnemyPack() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const areaIndex = useGameStore((s) => s.areaIndex)

  const area = AREAS[areaIndex] ?? AREAS[0]
  const boss = isBoss(stageIndex)
  // Formation slots are chamber-local; the pack stands in whichever chamber
  // this level occupies, so everything downstream can stay in world space.
  const formation = useMemo(() => {
    const origin = chamberOrigin(stageIndex)
    return enemyFormation(stageIndex, boss).map(([x, y, z]) => [x, y, origin + z])
  }, [stageIndex, boss])

  const pack = useMemo(
    () =>
      formation.map((home, slot) => ({
        slot,
        home,
        appearance: enemyAppearance(area, stageIndex, slot, boss),
      })),
    [formation, area, stageIndex, boss]
  )

  useEffect(() => resetPack(formation.length), [formation.length, stageIndex])

  useFrame(() => {
    const { enemyHealth, stageIndex: currentStage } = useGameStore.getState()
    const ratio = Math.max(0, Math.min(1, enemyHealth / stageHealth(currentStage)))

    const slotCount = packState.slotCount
    const aliveCount = aliveCountFor(ratio, slotCount)
    // The last living slot is the one currently taking damage.
    const targetSlot = aliveCount > 0 ? aliveCount - 1 : -1

    packState.aliveCount = aliveCount
    packState.targetSlot = targetSlot

    if (targetSlot < 0) {
      packState.inRange = false
      packState.targetDistance = Infinity
      return
    }

    const target = enemySlots[targetSlot]
    const distance = Math.hypot(
      playerPosition.x - target.x,
      playerPosition.z - target.z
    )
    packState.targetDistance = distance
    packState.inRange = distance <= ATTACK_RANGE
  })

  return (
    <>
      {pack.map((enemy) => (
        <EnemyDino
          key={enemy.slot}
          slot={enemy.slot}
          home={enemy.home}
          appearance={enemy.appearance}
          boss={boss}
        />
      ))}
    </>
  )
}
