import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import Text from '../SceneText.jsx'
import * as THREE from 'three'
import { PAD_RADIUS, buildPadDecor, padRate, padUnlocked } from '../../data/training.js'
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
 * The machine's fittings, as boxes rather than as JSX.
 *
 * Identical on every pad - only the colours differ - so this is merged once at
 * module scope and the geometry is shared by all nine. See MergedBoxes.
 */
const FURNITURE = mergeBoxes([
  ...[-1, 1].flatMap((side) => [
    ...[-1.3, 1.3].map((z) => ({
      material: 'base',
      position: [side * 1.95, 0.62, z],
      size: [0.2, 1.24, 0.2],
    })),
    {
      material: 'frame',
      position: [side * 1.95, 1.28, 0],
      size: [0.24, 0.24, 3],
      shadow: true,
    },
  ]),

  // The console you would hold on to, at the head of the belt.
  { material: 'base', position: [0, 0.85, -1.95], size: [3.5, 0.34, 0.3], shadow: true },
  {
    material: 'lamp',
    position: [0, 1.16, -1.99],
    size: [2.1, 0.62, 0.12],
    rotation: [-0.42, 0, 0],
  },

  // Corner bollards with lit caps - it looks powered now.
  ...[-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) => [
      { material: 'base', position: [sx * 2.05, 0.5, sz * 2.05], size: [0.42, 1, 0.42] },
      { material: 'lamp', position: [sx * 2.05, 1.12, sz * 2.05], size: [0.32, 0.26, 0.32] },
    ])
  ),
])

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
    const standing = unlocked && dx * dx + dz * dz < PAD_RADIUS * PAD_RADIUS

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
      {/* A stepped machine: dark plinth, bright frame, belt on top. */}
      <mesh material={materials.base} position={[0, 0.09, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.5, 0.18, 4.5]} />
      </mesh>
      <mesh material={materials.frame} position={[0, 0.26, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.24, 4]} />
      </mesh>
      <mesh ref={padRef} material={materials.surface} position={[0, 0.42, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.14, 3.4]} />
      </mesh>

      {/* Rollers at the belt's ends, the way a treadmill reads. */}
      {[-1.72, 1.72].map((z) => (
        <mesh key={z} material={materials.base} position={[0, 0.42, z]} castShadow>
          <boxGeometry args={[3.7, 0.3, 0.34]} />
        </mesh>
      ))}

      {/*
        Handrails down both sides, a console across the front and lit corner
        bollards - the things that make a machine read as a treadmill rather
        than as a lit slab. Sixteen boxes apiece across nine machines, merged
        down to a handful of draws: the same boxes in the same places, just not
        submitted one at a time. Posts and bollards do not cast, because a
        shadow from a 20cm rail is not worth a pass over the shadow map.
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

      <mesh ref={glowRef} position={[0, 0.51, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.2, 1.7, 6]} />
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
      <mesh ref={beamRef} position={[0, 2.6, 0]} visible={false}>
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

      {/* Back post carrying the sign */}
      <mesh material={materials.frame} position={[0, 1.6, -2.1]} castShadow>
        <boxGeometry args={[0.28, 3.2, 0.28]} />
      </mesh>

      <Billboard position={[0, 3.9, -2.1]}>
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
