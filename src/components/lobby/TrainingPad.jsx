import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import Text from '../SceneText.jsx'
import * as THREE from 'three'
import { buildPadDecor, onBelt, padRate, padUnlocked } from '../../data/training.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelTexture } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import MergedBoxes, { mergeBoxes } from '../MergedBoxes.jsx'

/**
 * A training pad: stand on it and your dino trains, adding permanent Damage at
 * the pad's multiplier.
 *
 * The "am I standing on it" test and every bit of the pad's animation run from
 * useFrame against the shared player position, so a row of nine pads costs no
 * React renders while you walk the hub.
 */
/**
 * The machine, as boxes rather than as JSX.
 *
 * Identical on every pad - only the colours differ - so this is merged once at
 * module scope and the geometry is shared by all nine. See MergedBoxes.
 *
 * Laid out like the real thing. The pad used to be square: a 4.5m slab as wide
 * as it was long, with rails down two sides and a console behind the runner's
 * back. That is a dance floor with handrails, not a treadmill. A treadmill is
 * *long* - a narrow belt with a console at the head of it that you look at
 * while you run - so the deck now runs 6 metres along the belt and only 3
 * across, which also puts a clear metre of grass between one machine and the
 * next down the row.
 *
 * Local +Z is the way the dino faces while training (Player.jsx turns it to
 * world -X, which is this axis once the pad is given its quarter turn), so the
 * console is at +Z where a runner can read it, and the sign is behind at -Z.
 */
const FURNITURE = mergeBoxes([
  /* ---- deck ---- */
  // Rubber feet, so the chassis stands on something rather than on the lawn.
  ...[-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      material: 'base',
      position: [sx * 1.2, 0.05, 0.1 + sz * 3.2],
      size: [0.44, 0.1, 0.44],
    }))
  ),

  /*
   * Side rails: the fixed strips either side of the belt that you put your
   * feet on when you step off it mid-run. They are most of why a treadmill
   * reads as a treadmill from above - a belt with nothing beside it is a mat.
   */
  ...[-1, 1].map((side) => ({
    material: 'base',
    position: [side * 1.16, 0.47, 0.1],
    size: [0.46, 0.22, 6],
    shadow: true,
  })),

  // Rollers at both ends of the belt.
  ...[-3.05, 3.25].map((z) => ({
    material: 'base',
    position: [0, 0.44, z],
    size: [2.15, 0.32, 0.32],
    shadow: true,
  })),

  // The motor housing under the console, sloped off the front of the deck.
  { material: 'frame', position: [0, 0.44, 3.56], size: [2.5, 0.38, 0.62], shadow: true },
  { material: 'base', position: [0, 0.66, 3.62], size: [2.15, 0.14, 0.46], rotation: [0.5, 0, 0] },

  /* ---- console ---- */
  /*
   * Carried high, on uprights, and kept small.
   *
   * The first version hung a two-metre slab off the front at chest height,
   * which from anywhere in front of the machine was a billboard with a
   * treadmill hiding behind it. A console is a handful of dials you glance up
   * at - the belt is the thing you are meant to be looking at.
   */
  ...[-1, 1].map((side) => ({
    material: 'base',
    position: [side * 1.06, 1.16, 3.24],
    size: [0.2, 1.38, 0.24],
    shadow: true,
  })),
  { material: 'base', position: [0, 1.82, 3.22], size: [2.5, 0.18, 0.26], shadow: true },

  // The display, angled back toward whoever is running at it.
  { material: 'frame', position: [0, 2.04, 3.38], size: [1.54, 0.54, 0.12], rotation: [-0.5, 0, 0] },
  { material: 'lamp', position: [0, 2.06, 3.32], size: [1.24, 0.38, 0.05], rotation: [-0.5, 0, 0] },
  // A row of buttons under it - the small stuff that sells a machine as a
  // machine and costs nothing, because it is merged into the same three draws.
  ...[-0.62, -0.21, 0.21, 0.62].map((x) => ({
    material: 'lamp',
    position: [x, 1.64, 3.14],
    size: [0.24, 0.08, 0.12],
  })),

  /* ---- handrails ---- */
  // Running back from the console along both sides, on a rear post each.
  ...[-1, 1].flatMap((side) => [
    {
      material: 'frame',
      position: [side * 1.3, 1.24, 0.7],
      size: [0.18, 0.18, 5],
      shadow: true,
    },
    { material: 'base', position: [side * 1.3, 0.86, -1.6], size: [0.2, 0.86, 0.2] },
    // Grip caps at the trailing end, so a rail stops rather than being cut off.
    { material: 'lamp', position: [side * 1.3, 1.24, -1.98], size: [0.24, 0.24, 0.4] },
  ]),
])

/**
 * Lights chasing down the rails, in the pad's own colour.
 *
 * A machine that only changes brightness when you stand on it reads as a lamp.
 * What says *running* is something with a direction to it, so a string of
 * sparks travels the length of both rails - a slow drift when the row is idle,
 * a hard sprint under a dino - and each pad runs them in its own accent, so the
 * row lights up as a ladder of colours rather than nine of the same machine.
 *
 * One instanced mesh per pad: ten machines cost ten draws for the lot, and the
 * matrices are written in the frame loop the pad already runs.
 */
const CHASE_PER_RAIL = 9
const CHASE_COUNT = CHASE_PER_RAIL * 2
/** The stretch of rail they travel, and how far out the rails are. */
const CHASE_FROM = -2.9
const CHASE_TO = 3.1
const CHASE_X = 1.16

export default function TrainingPad({ pad, position }) {
  const rebirths = useGameStore((s) => s.rebirths)
  // What the sign promises is what the pad pays: your own damage per click,
  // times this machine's multiplier.
  const perClick = useGameStore((s) => s.perClick)
  const unlocked = padUnlocked(pad, rebirths)

  const padRef = useRef()
  const glowRef = useRef()
  const beamRef = useRef()
  const anim = useRef({ active: 0, phase: Math.random() * 6 })

  const materials = useMemo(() => {
    /*
     * The belt.
     *
     * The pad's studs are a *cloned* map so this one can scroll on its own -
     * the cache hands out shared textures, and offsetting a shared one would
     * set every pad in the row running at once. Cloning shares the image and
     * costs only its own offset.
     */
    /*
     * A locked pad wears its own colour too.
     *
     * The whole row used to grey out until you had the rebirths for it, so the
     * ladder you are meant to be climbing showed you eight identical slabs.
     * The rung is said by the sign and by whether the machine is *lit* - a
     * locked one is simply switched off.
     */
    const belt = voxelTexture(pad.color, {
      pattern: 'studs',
      cells: 4,
      variance: 0.05,
      fleckDepth: 0.24,
      repeat: [3, 3],
      seed: 77,
    }).clone()
    belt.needsUpdate = true

    const surface = new THREE.MeshStandardMaterial({
      map: belt,
      roughness: 0.55,
      flatShading: true,
      emissive: new THREE.Color(pad.accent),
      emissiveIntensity: unlocked ? 0.25 : 0,
    })
    const frame = new THREE.MeshStandardMaterial({
      color: pad.accent,
      roughness: 0.6,
      flatShading: true,
    })
    // Chunkier, darker blocks under the belt - the machine it runs on.
    const base = new THREE.MeshStandardMaterial({
      color: '#4a5468',
      roughness: 0.85,
      flatShading: true,
    })
    const lamp = new THREE.MeshStandardMaterial({
      color: pad.accent,
      emissive: new THREE.Color(pad.accent),
      // Switched off rather than repainted: an unlit lamp is what "locked"
      // looks like on a machine.
      emissiveIntensity: unlocked ? 0.9 : 0,
      roughness: 0.4,
      flatShading: true,
    })
    /*
     * The dressing standing around the machine. Two materials for the whole
     * thing however many pieces it has: the dark blocks it is built out of,
     * and the ones that glow.
     */
    const decorDull = new THREE.MeshStandardMaterial({
      color: '#3c4457',
      roughness: 0.9,
      flatShading: true,
    })
    const decorLit = new THREE.MeshStandardMaterial({
      color: pad.color,
      emissive: new THREE.Color(pad.accent),
      emissiveIntensity: unlocked ? 0.55 : 0,
      roughness: 0.5,
      flatShading: true,
    })

    return { surface, frame, base, lamp, belt, decorDull, decorLit }
  }, [pad, unlocked])

  /** Fixed for the life of the pad - the layout never changes, only its tint. */
  const chaseRef = useRef()
  const chase = useMemo(
    () => ({ phase: 0, matrix: new THREE.Matrix4(), position: new THREE.Vector3(), scale: new THREE.Vector3(), quaternion: new THREE.Quaternion() }),
    []
  )

  const decor = useMemo(() => buildPadDecor(pad.deco, pad.multiplier), [pad])
  const decorGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => decorGeometry.dispose(), [decorGeometry])

  // The belt owns its cloned map, so it has to hand that back too - which is
  // why this walks the whole bundle rather than naming the materials.
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const dx = playerPosition.x - position[0]
    const dz = playerPosition.z - position[2]
    const standing = unlocked && onBelt(dx, dz)

    a.active += ((standing ? 1 : 0) - a.active) * Math.min(1, delta * 8)

    if (padRef.current) {
      materials.surface.emissiveIntensity =
        (unlocked ? 0.25 : 0) + a.active * (0.7 + Math.sin(a.phase * 6) * 0.2)
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (unlocked ? 0.25 : 0.08) + a.active * 0.5
      glowRef.current.rotation.z += delta * (0.5 + a.active * 2.5)
    }
    if (beamRef.current) {
      beamRef.current.visible = a.active > 0.02
      beamRef.current.scale.set(1, 1 + Math.sin(a.phase * 4) * 0.12, 1)
      beamRef.current.material.opacity = a.active * 0.35
      beamRef.current.rotation.y += delta * 1.2
    }

    /*
     * The sparks. They run whether or not anybody is on the machine - a dead
     * row of treadmills is a row of furniture - but a dino on the belt takes
     * them from a drift to a sprint, and brightens them.
     */
    if (chaseRef.current) {
      chase.phase = (chase.phase + delta * (0.16 + a.active * 0.9)) % 1
      const span = CHASE_TO - CHASE_FROM
      chase.quaternion.identity()

      for (let i = 0; i < CHASE_PER_RAIL; i++) {
        // Evenly spaced round the loop, all sliding together.
        const t = (i / CHASE_PER_RAIL + chase.phase) % 1
        // Faded in and out at the ends, so a spark arrives rather than pops.
        const fade = Math.sin(t * Math.PI)
        const size = 0.1 + fade * 0.26

        for (let side = 0; side < 2; side++) {
          chase.position.set(side === 0 ? -CHASE_X : CHASE_X, 0.62, CHASE_FROM + t * span)
          chase.scale.set(size, size * 0.5, size * 2.4)
          chase.matrix.compose(chase.position, chase.quaternion, chase.scale)
          chaseRef.current.setMatrixAt(i * 2 + side, chase.matrix)
        }
      }

      chaseRef.current.instanceMatrix.needsUpdate = true
      chaseRef.current.material.opacity = unlocked ? 0.4 + a.active * 0.55 : 0.14
    }

    // The belt always creeps; standing on it winds it up to speed.
    if (unlocked) {
      materials.belt.offset.y -= delta * (0.06 + a.active * 0.55)
    }
  })

  const rate = padRate(pad, perClick)

  return (
    /*
     * Turned a quarter turn so the belt runs across the row toward the
     * walkway, which is the way you face while you are on it. Laid along the
     * row the machines read as nine planks end to end rather than as a rank of
     * treadmills - and the dino ran sideways down its own belt.
     */
    <group name="TrainingPad" position={position} rotation-y={-Math.PI / 2}>
      {/* Chassis, frame and the belt itself - long down the running axis and
          narrow across it, which is the shape that reads as a treadmill from
          any angle rather than only from the end with the console on it. */}
      <mesh material={materials.base} position={[0, 0.09, 0.1]} receiveShadow castShadow>
        <boxGeometry args={[3, 0.18, 7.6]} />
      </mesh>
      <mesh material={materials.frame} position={[0, 0.26, 0.1]} receiveShadow castShadow>
        <boxGeometry args={[2.62, 0.24, 7]} />
      </mesh>
      <mesh ref={padRef} material={materials.surface} position={[0, 0.42, 0.1]} receiveShadow>
        <boxGeometry args={[1.86, 0.14, 6]} />
      </mesh>

      {/*
        Side rails, rollers, the motor housing, the console with its display
        and buttons, and the handrails running back from it - forty-odd boxes
        apiece across nine machines, merged down to three draws. The same boxes
        in the same places, just not submitted one at a time.
      */}
      <MergedBoxes groups={FURNITURE} materials={materials} />

      {/*
        The pad's own dressing - bullion, crystals, a lava crust, ice spikes,
        whatever this rung of the ladder is. Two draws whatever it is made of,
        and all of it outside the belt so it never stands where the dino does.
      */}
      <InstancedBlocks
        items={decor.dull}
        geometry={decorGeometry}
        material={materials.decorDull}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={decor.lit}
        geometry={decorGeometry}
        material={materials.decorLit}
        castShadow
      />

      {/* Sparks running the rails - see CHASE_PER_RAIL. */}
      <instancedMesh
        ref={chaseRef}
        args={[undefined, undefined, CHASE_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </instancedMesh>

      <mesh ref={glowRef} position={[0, 0.51, 0.1]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.8, 1.24, 6]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Column of light while training */}
      <mesh ref={beamRef} position={[0, 2.6, 0.1]} visible={false}>
        <cylinderGeometry args={[1.5, 1.1, 5, 6, 1, true]} />
        <meshBasicMaterial
          color={pad.accent}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>

      {/* Back post carrying the sign, behind the runner rather than in front
          of them - the console is what you look at while you are on it. */}
      <mesh material={materials.frame} position={[0, 1.6, -4]} castShadow>
        <boxGeometry args={[0.28, 3.2, 0.28]} />
      </mesh>

      <Billboard position={[0, 3.9, -4]}>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[2.7, 1.1]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.84} fog={false} />
        </mesh>

        <Text
          position={[0, 0.31, 0]}
          fontSize={0.31}
          color={pad.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.026}
          outlineColor="#0b1220"
        >
          {`x${pad.multiplier} Damage`}
        </Text>

        <Text
          position={[0, -0.03, 0]}
          fontSize={0.18}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#0b1220"
        >
          {`+${formatNumber(rate)}/sec`}
        </Text>

        <Text
          position={[0, -0.33, 0]}
          fontSize={0.17}
          color={unlocked ? '#86efac' : '#fca5a5'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.017}
          outlineColor="#0b1220"
        >
          {unlocked
            ? 'STAND TO TRAIN'
            : `${pad.requiresRebirths} Rebirth${pad.requiresRebirths === 1 ? '' : 's'}`}
        </Text>
      </Billboard>
    </group>
  )
}
