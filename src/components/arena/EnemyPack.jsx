import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { areaForStage } from '../../data/areas.js'
import {
  ARENA,
  ATTACK_RANGE,
  chamberOrigin,
  enemyFormation,
  packWindow,
} from '../../data/arena.js'
import { enemyAppearance } from '../../data/enemies.js'
import { MAX_STAGES, isBoss } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import {
  aliveCountFor,
  chamberRatio,
  enemySlots,
  packState,
} from '../../systems/arenaEnemies.js'
import { playerWorld } from '../../systems/playerWorld.js'
import EnemyDino from './EnemyDino.jsx'

/**
 * How close the hub side of the gate the pack starts showing itself.
 *
 * The pack is mounted always so its models are warmed up before the doorway,
 * but hidden while you are still out in the plaza - see the reveal check in
 * the frame loop below. Tying that reveal to the exact frame the scene flips
 * to "arena" put it in the same instant as the HUD swapping to its combat
 * layout and every `active`-gated system switching on - a whole room's worth
 * of things changing on one frame reads as a jump cut, not a walk. Revealing
 * a few steps earlier, while you are already committed to the gate's own
 * narrow passage rather than still out on the open plaza, spends those steps
 * closing the gap instead of teleporting across it.
 */
const REVEAL_MARGIN = 6

/**
 * One level's pack, standing in that level's own chamber.
 *
 * Targeting lives here rather than in each enemy so there is exactly one
 * answer to "who am I hitting" per frame. The target is the highest live slot,
 * and the formation is ordered far-to-near, so the pack is cut down from the
 * front and the fight walks you deeper into the arena.
 *
 * Only the chamber you are standing in owns that answer. The others are simply
 * there - which is the whole point of them: see EnemyPacks below.
 */
function ChamberPack({ stage }) {
  const root = useRef()

  const boss = isBoss(stage)
  // Formation slots are chamber-local; the pack stands in the chamber this
  // level occupies, so everything downstream can stay in world space.
  const formation = useMemo(() => {
    const origin = chamberOrigin(stage)
    return enemyFormation(stage, boss).map(([x, y, z]) => [x, y, origin + z])
  }, [stage, boss])

  const pack = useMemo(() => {
    const area = areaForStage(stage)
    return formation.map((home, slot) => ({
      slot,
      home,
      appearance: enemyAppearance(area, stage, slot, boss),
    }))
  }, [formation, stage, boss])

  useFrame(() => {
    const store = useGameStore.getState()

    if (root.current) {
      const mouth = chamberOrigin(stage) + ARENA.frontZ
      root.current.visible =
        store.scene === 'arena' || playerWorld().z <= mouth + REVEAL_MARGIN
    }

    /*
     * The shared targeting state is about the fight in progress, so only the
     * level being fought in writes it. Read from the store rather than from a
     * prop on purpose: the stage changes mid-frame, when ArenaTravel notices
     * you crossed a boundary, and a pack that learned about it a render later
     * would spend the frames in between answering for the wrong chamber.
     */
    if (store.stageIndex !== stage) return

    const slotCount = formation.length
    const ratio = chamberRatio(store, stage)
    const aliveCount = aliveCountFor(ratio, slotCount)
    // The last living slot is the one currently taking damage.
    const targetSlot = aliveCount > 0 ? aliveCount - 1 : -1

    packState.slotCount = slotCount
    packState.aliveCount = aliveCount
    packState.targetSlot = targetSlot

    if (targetSlot < 0) {
      packState.inRange = false
      packState.targetDistance = Infinity
      return
    }

    /*
     * World space, because this now runs in the hub too: measured against the
     * scene-local position it would read as sixty-three units closer than it
     * is, and a pack you are still walking toward would count itself in range.
     */
    const player = playerWorld()
    const target = enemySlots[targetSlot]
    const distance = Math.hypot(player.x - target.x, player.z - target.z)
    packState.targetDistance = distance
    packState.inRange = distance <= ATTACK_RANGE
  })

  return (
    <group ref={root}>
      {pack.map((enemy) => (
        <EnemyDino
          key={enemy.slot}
          slot={enemy.slot}
          stage={stage}
          slotCount={formation.length}
          home={enemy.home}
          appearance={enemy.appearance}
          boss={boss}
        />
      ))}
    </group>
  )
}

/**
 * The packs standing in the corridor.
 *
 * There used to be one pack, belonging to whichever level you were in, and
 * crossing a gate moved it: the same dinos were picked up out of the chamber
 * behind you and put down in the one ahead. Everything about that was visible
 * from the passage, because the passage is exactly where you are looking down
 * the corridor at both chambers at once - the pack you had just killed stood
 * back up for the frames before its positions caught up with the store, blinked
 * out, and reappeared twenty units ahead as the level you were walking into.
 *
 * A pack per chamber has nowhere to travel to. The level ahead is already
 * standing in itself, waiting, visible through its gate as you walk up to it;
 * the one behind stays as you left it. Crossing the boundary hands over which
 * of them is being fought and nothing moves at all.
 */
export default function EnemyPacks() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stages = useMemo(() => packWindow(stageIndex, MAX_STAGES), [stageIndex])

  return (
    <>
      {stages.map((stage) => (
        <ChamberPack key={stage} stage={stage} />
      ))}
    </>
  )
}
