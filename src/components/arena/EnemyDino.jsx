import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import {
  ARENA_BOUNDS,
  ENEMY_SPEED,
  ENEMY_STOP_DISTANCE,
  chamberOrigin,
} from '../../data/arena.js'
import { ENEMY_ATTACK_RANGE } from '../../data/combat.js'
import {
  ATTACK_ANIM_SECONDS,
  ATTACK_WINDUP_SECONDS,
  enemyAttackStyle,
} from '../../data/enemies.js'
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
 * How far inside its own reach an enemy takes its post.
 *
 * The pack used to line up on a ring measured from the *player* - a fixed
 * 4.1 to 5.0 units for anything that was not the one you were hitting - while
 * a biter's teeth only carry 3.06 and a slam only 2.89. So most of the pack
 * stood politely just outside the range at which it was allowed to do
 * anything, and the fight came at you one dino at a time: whoever you happened
 * to be hitting, plus the odd fire-breather that outranged the formation.
 *
 * Every post is now measured against that enemy's own reach, so a shape that
 * has to be on top of you comes and stands on top of you. A sailback still
 * hangs back and breathes across the gap, because it can.
 */
const POST_WITHIN_REACH = 0.82

/** And never so close that it is standing inside you. */
const MIN_POST = 1.9

/**
 * What each kind of blow looks like on the animal throwing it.
 *
 * The pack used to attack by *emitting particles*: a cloud of fire appeared in
 * front of a sailback that had not moved a muscle, so a flurry from five of
 * them read as weather rather than as five animals hitting you. Everything
 * here is applied on top of the walk cycle, so an enemy can lunge mid-stride.
 *
 * Fields are in the model's own frame - it faces +X, so `pitch` is nose-down,
 * `roll` tips it onto a shoulder and `yaw` turns it on the spot.
 */
const POSES = {
  // Teeth first: the whole animal is thrown at you behind its head.
  lunge: { push: 0.95, pitch: 0.34, lift: 0.1, head: 0.5, tail: -0.35 },
  // A claw comes round, so the body rolls and the head follows it across.
  slash: { push: 0.5, pitch: 0.12, roll: 0.42, yaw: 0.55, lift: 0.12, head: 0.3, tail: 0.55 },
  // The tail is the weapon. The body turns away from you to bring it through.
  sweep: { push: 0.12, pitch: -0.05, roll: 0.18, yaw: -0.8, lift: 0.05, head: -0.25, tail: 1.6 },
  // Up, then down: all of a slam is in the vertical.
  stomp: { push: 0.25, pitch: -0.45, lift: 0.8, head: -0.3, tail: -0.7 },
  // Rears back and holds its ground - the fire does the travelling.
  breath: { push: -0.3, pitch: -0.42, lift: 0.2, head: -0.6, tail: -0.45 },
  // A short, sharp head-snap. The body barely moves.
  spit: { push: -0.08, pitch: -0.18, lift: 0.05, head: -0.5, tail: -0.15 },
}

/** Where the strike lands within the animation. */
const STRIKE_AT = ATTACK_WINDUP_SECONDS / ATTACK_ANIM_SECONDS

/**
 * A blow, as a number from -0.4 to 1 over the life of the animation.
 *
 * Negative through the wind-up - the animal gathers *backwards* - and then one
 * hump forward that peaks just after the strike and eases out. Anticipation and
 * follow-through are the whole difference between a hit and a lurch.
 */
function strikeCurve(p) {
  if (p <= 0 || p >= 1) return 0
  return p < STRIKE_AT
    ? -Math.sin((p / STRIKE_AT) * Math.PI) * 0.4
    : Math.sin(((p - STRIKE_AT) / (1 - STRIKE_AT)) * Math.PI)
}

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
  const lean = useRef()
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
    // Seconds left of the current attack animation, and which one it is.
    attack: 0,
    pose: POSES.lunge,
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

  // The tell. Fired a beat before the blow lands, so the animal is already
  // moving when the damage arrives - see ATTACK_WINDUP_SECONDS.
  useEffect(
    () =>
      on(EVENTS.ENEMY_WINDUP, ({ slot: which, tell }) => {
        if (which !== slot) return
        anim.current.attack = ATTACK_ANIM_SECONDS
        anim.current.pose = POSES[tell] ?? POSES.lunge
      }),
    [slot]
  )

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
      a.attack = 0
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
       * target readable in the middle of a scrum - but that spacing is only a
       * preference. A post is pulled in until it is inside that enemy's own
       * reach, because a dino standing where it cannot attack is just scenery.
       */
      const spacing = (isTarget ? ENEMY_STOP_DISTANCE : ENEMY_STOP_DISTANCE + 0.9) +
        (slot % 3) * 0.45
      const reach = ENEMY_ATTACK_RANGE * enemyAttackStyle(currentStage, slot, boss).reach
      const ring = Math.max(MIN_POST, Math.min(spacing, reach * POST_WITHIN_REACH))
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

    /*
     * The attack, laid on top of the walk cycle rather than replacing it, so a
     * dino that is still closing on you can throw a blow without stopping to
     * play an animation first.
     */
    if (a.attack > 0) a.attack = Math.max(0, a.attack - scaled)
    const pose = a.pose
    const strike = a.attack > 0 ? strikeCurve(1 - a.attack / ATTACK_ANIM_SECONDS) : 0
    const reachOut = strike * (pose.push ?? 0)

    if (lean.current) {
      lean.current.rotation.z = -(pose.pitch ?? 0) * strike
      lean.current.rotation.x = (pose.roll ?? 0) * strike
      lean.current.rotation.y = (pose.yaw ?? 0) * strike
      // Only the wind-up lifts it, so a slam rears up and then comes back
      // down through the strike instead of hopping on the way out.
      lean.current.position.y = (pose.lift ?? 0) * Math.max(0, -strike) * 2.5
    }
    if (rig.current) {
      if (rig.current.head) rig.current.head.rotation.z -= (pose.head ?? 0) * strike
      if (rig.current.tail) rig.current.tail.rotation.y += (pose.tail ?? 0) * strike
    }

    // Publish position so the combat system can measure range against it.
    enemySlots[slot]?.set(a.x, 0, a.z)

    const hurt = a.hurt * a.hurt
    const dying = a.death > 0 ? a.death : 0

    if (root.current) {
      const forward = hurt * 0.3 + reachOut
      root.current.position.set(
        a.x + forward * Math.cos(a.facing),
        Math.sin(a.bob) * 0.06,
        a.z + forward * -Math.sin(a.facing)
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
      {/* The attack pose lives here so the health bar above does not tilt with it. */}
      <group ref={lean}>
        <group ref={scaler} scale={appearance.scale}>
          <DinoModel evolution={appearance} materials={materials} rig={rig} />
        </group>
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
