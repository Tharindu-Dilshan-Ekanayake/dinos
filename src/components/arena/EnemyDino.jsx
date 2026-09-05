import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import {
  ARENA_BOUNDS,
  ENEMY_SPEED,
  ENEMY_STOP_DISTANCE,
  chamberOrigin,
} from '../../data/arena.js'
import { stageHealth } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, on } from '../../systems/events.js'
import { createStepper } from '../../systems/footsteps.js'
import { getTimeScale } from '../../systems/timeScale.js'
import { playerPosition } from '../../systems/playerState.js'
import { enemySlots, packState, slotHealthRatio } from '../../systems/arenaEnemies.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from '../DinoModel.jsx'

const BAR_WIDTH = 1.9

/**
 * One enemy dino.
 *
 * Its health is a band of the stage's shared pool rather than its own number,
 * so the whole pack stays in step with the store without any extra state to
 * keep in sync. Everything below - alive/dead, the bar, the chase - is derived
 * each frame from that one ratio and written straight to the objects, so a
 * fast fight never re-renders React.
 */
export default function EnemyDino({ slot, appearance, home, boss }) {
  const materials = useDinoMaterials(appearance)
  const rig = useDinoRig()

  const root = useRef()
  const scaler = useRef()
  const barGroup = useRef()
  const barFill = useRef()

  const anim = useRef({
    x: home[0],
    z: home[2],
    y: 0,
    facing: -Math.PI / 2,
    stride: 0,
    speed: 0,
    flash: 0,
    hurt: 0,
    death: 0,
    // Null until the first frame in a chamber tells us what this slot's state
    // actually is. See the frame loop.
    wasAlive: null,
    bob: slot * 1.7,
  })

  // Footfalls scale with the body: a boss lands like a boss.
  const step = useMemo(
    () => createStepper({ scale: appearance.scale, gain: 0.8, shared: true }),
    [appearance.scale]
  )

  // A fresh pack marches back to its posts whenever the stage changes.
  const stageIndex = useGameStore((s) => s.stageIndex)
  useEffect(() => {
    const a = anim.current
    a.x = home[0]
    a.z = home[2]
    a.death = 0
    a.wasAlive = null
    a.facing = -Math.PI / 2
  }, [stageIndex, home])

  useEffect(
    () =>
      on(EVENTS.HIT, ({ source }) => {
        // Only the enemy actually being hit should react.
        if (packState.targetSlot !== slot) return
        anim.current.flash = 1
        anim.current.hurt = source === 'click' ? 1 : 0.3
      }),
    [slot]
  )

  useFrame((_, rawDelta) => {
    const a = anim.current
    const delta = Math.min(rawDelta, 0.05)
    const scaled = delta * getTimeScale()

    const { enemyHealth, stageIndex: currentStage } = useGameStore.getState()
    const ratio = Math.max(0, Math.min(1, enemyHealth / stageHealth(currentStage)))
    const own = slotHealthRatio(ratio, slot, packState.slotCount)
    const alive = own > 0

    /*
     * First frame in this chamber: adopt whatever state the level is actually
     * in, rather than assuming a standing dino. Walking back into a level you
     * already cleared would otherwise play the whole pack's death animation at
     * you again, every single time you passed through.
     */
    if (a.wasAlive === null) {
      a.wasAlive = alive
      a.death = 0
    }

    // Falling: run the death animation once, then stay down.
    if (!alive && a.wasAlive) {
      a.wasAlive = false
      a.death = 1
    }
    if (alive && !a.wasAlive) {
      // Revived by a stage reset.
      a.wasAlive = true
      a.death = 0
    }
    if (a.death > 0) a.death = Math.max(0, a.death - delta / 0.55)

    a.flash = Math.max(0, a.flash - delta * 4.5)
    a.hurt = Math.max(0, a.hurt - scaled * 5)
    a.bob += scaled * 1.6

    const dead = !alive && a.death <= 0
    if (root.current) root.current.visible = !dead
    if (barGroup.current) barGroup.current.visible = alive
    if (dead) return

    // --- movement ---
    const isTarget = packState.targetSlot === slot
    let moving = 0
    const wasX = a.x
    const wasZ = a.z

    if (alive) {
      /*
       * The whole pack comes for you, not just the one you happen to be
       * hitting. Each takes its own post on a ring around the player - spaced
       * by slot, at slightly different stand-off distances - so five of them
       * surround you rather than stacking into one dino-shaped column.
       *
       * The one you are actually fighting pushes in closest, which keeps the
       * target readable in the middle of a scrum.
       */
      const ring = (isTarget ? ENEMY_STOP_DISTANCE : ENEMY_STOP_DISTANCE + 0.9) +
        (slot % 3) * 0.45
      const spread = (slot / Math.max(1, packState.slotCount)) * Math.PI * 2
      const aimX = playerPosition.x + Math.cos(spread) * ring
      const aimZ = playerPosition.z + Math.sin(spread) * ring

      const dx = playerPosition.x - a.x
      const dz = playerPosition.z - a.z

      const ax = aimX - a.x
      const az = aimZ - a.z
      const toPost = Math.hypot(ax, az)

      if (toPost > 0.35) {
        const step = Math.min(toPost, ENEMY_SPEED * scaled)
        a.x += (ax / toPost) * step
        a.z += (az / toPost) * step
        moving = Math.min(1, toPost / 2)
      }

      // Always glare at the player. The rig faces +X, so this is atan2(-dz, dx).
      const desired = Math.atan2(-dz, dx)
      let diff = desired - a.facing
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      a.facing += diff * Math.min(1, delta * 6)
    }

    /*
     * A pack holds its own chamber and will not follow you out through the
     * gap. Letting them chase into the corridor put five dinos in a passage
     * barely wider than one of them - and, the moment you crossed the
     * boundary, inside the next level's terrace wall. Breaking off and walking
     * back is meant to work; this is what makes it an escape.
     */
    const origin = chamberOrigin(currentStage)
    const localZ = a.z - origin
    if (localZ < ARENA_BOUNDS.minZ) a.z = origin + ARENA_BOUNDS.minZ
    else if (localZ > ARENA_BOUNDS.maxZ) a.z = origin + ARENA_BOUNDS.maxZ
    if (a.x < ARENA_BOUNDS.minX) a.x = ARENA_BOUNDS.minX
    else if (a.x > ARENA_BOUNDS.maxX) a.x = ARENA_BOUNDS.maxX

    // Held against its own wall by that clamp, a dino still chasing you would
    // otherwise run on the spot - legs, footsteps and all.
    if (Math.abs(a.x - wasX) + Math.abs(a.z - wasZ) < 1e-4) moving = 0

    a.speed += (moving - a.speed) * Math.min(1, delta * 10)
    a.stride += delta * (2.2 + a.speed * 8)
    animateDinoRig(rig.current, a.speed, a.stride)
    if (alive) step(a.stride, a.speed, { x: a.x, z: a.z })

    // Publish position so the combat system can measure range against it.
    enemySlots[slot]?.set(a.x, 0, a.z)

    const hurt = a.hurt * a.hurt
    const dying = a.death > 0 ? a.death : 0

    if (root.current) {
      root.current.position.set(
        a.x + hurt * 0.3 * Math.cos(a.facing),
        Math.sin(a.bob) * 0.06,
        a.z + hurt * 0.3 * -Math.sin(a.facing)
      )
      root.current.rotation.y = a.facing
    }

    if (scaler.current) {
      // Squash on hit, and collapse into the floor on death.
      const collapse = dying > 0 ? dying : 1
      const s = appearance.scale * collapse
      scaler.current.scale.set(
        s * (1 + hurt * 0.12),
        s * (1 - hurt * 0.14) * collapse,
        s * (1 + hurt * 0.12)
      )
      scaler.current.rotation.z = (1 - collapse) * 1.4
    }

    if (barFill.current) {
      barFill.current.scale.x = Math.max(0.0001, own)
      barFill.current.position.x = -(BAR_WIDTH / 2) * (1 - own)
    }

    materials.body.emissive.setHex(0xffffff)
    materials.body.emissiveIntensity = a.flash * 0.9
  })

  return (
    <group ref={root} position={home}>
      <group ref={scaler} scale={appearance.scale}>
        <DinoModel evolution={appearance} materials={materials} rig={rig} />
      </group>

      <Billboard ref={barGroup} position={[0, boss ? 3.4 : 2.3, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[BAR_WIDTH + 0.1, 0.26]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.82} fog={false} />
        </mesh>
        <mesh ref={barFill}>
          <planeGeometry args={[BAR_WIDTH, 0.17]} />
          <meshBasicMaterial color={boss ? '#ffb703' : '#ef4444'} fog={false} />
        </mesh>
      </Billboard>
    </group>
  )
}
