import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import {
  ARENA_ENTRANCE,
  ARENA_GATE,
  ARENA_STAIR_TOP_Z,
  LOBBY_PALETTE,
} from '../../data/lobby.js'
import { MAX_STAGES } from '../../data/stages.js'
import { wallStones } from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'

const E = ARENA_ENTRANCE
const WALL_CENTRE_X = E.gapHalfWidth + E.wallWidth / 2
const WALL_LENGTH = E.wallFromZ - E.wallToZ
const WALL_MID_Z = (E.wallFromZ + E.wallToZ) / 2

/** Height of the carpet block sitting on each tread. */
const RUNNER_RISE = 0.06

/*
 * The corridor's own faces.
 *
 * Everything hung on the walls - pillars, banners, lanterns - is placed from
 * the inner face outward rather than from a wall's centre, because the wall is
 * ten metres thick and anything positioned relative to its middle ends up
 * buried inside it.
 */
const INNER_FACE_X = E.gapHalfWidth
const PILLAR_DEPTH = 1.4
/** How far a pillar stands proud of the wall it is built against. */
const PILLAR_PROUD = 0.4
const PILLAR_X = INNER_FACE_X - PILLAR_PROUD + PILLAR_DEPTH / 2
const PILLAR_FACE_X = INNER_FACE_X - PILLAR_PROUD
const LANTERN_X = PILLAR_FACE_X - 0.34

/**
 * Buttress pillars down the inner face of each wall, capped like little
 * towers. A fourteen-metre slab of stone is the one thing in the hub with no
 * blocks in it; these break it into bays.
 */
const PILLARS = (() => {
  const out = []
  for (let z = E.wallFromZ - 1.4; z >= E.wallToZ + 1.4; z -= 3.4) out.push(z)
  return out
})()

/** Battlements along the top of each wall - the castle read, in two blocks. */
const MERLONS = (() => {
  const out = []
  for (let z = E.wallFromZ - 1; z >= E.wallToZ + 1; z -= 2.4) out.push(z)
  return out
})()

/** Lanterns flanking the climb: at the foot, halfway up, and at the landing. */
const LANTERNS = [
  { z: E.stepFromZ + 1, height: 0 },
  // Sixth tread: `stairHeightAt` rounds *up* into the step you are standing on.
  { z: E.stepFromZ - E.stepRun * 5, height: E.stepRise * 6 },
  { z: E.stepFromZ - E.stepRun * E.stepCount - 1.2, height: E.stepRise * E.stepCount },
]

/** Banners hung on the pillars either side of the entrance. */
const BANNERS = [E.wallFromZ - 2.6, E.wallFromZ - 9.4]

/**
 * Trees on the rise past the stair top, laid out deterministically and kept
 * clear of the corridor's sight line so they frame the gap rather than block
 * it.
 */
const BEYOND_TREES = (() => {
  const out = []
  let seed = 5150
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  // Terraces the trees can stand on: [z centre, half depth, top height].
  const terraces = [
    [-5, 6, 0],
    [-16, 6, 2.7],
    [-28, 8, 7.6],
  ]
  for (let i = 0; i < 26; i++) {
    const terrace = terraces[i % terraces.length]
    const z = terrace[0] + (rand() - 0.5) * terrace[1] * 1.6
    // Bias away from dead centre so the trees frame the corridor's sight line
    // rather than plugging it.
    const side = i % 2 === 0 ? -1 : 1
    const x = side * (2.5 + rand() * 26)
    out.push({
      position: [x, terrace[2], z],
      scale: 0.8 + rand() * 0.9,
      rotation: rand() * Math.PI,
    })
  }
  return out
})()

/** Blocks of one tree, drawn as one instanced mesh each. */
const TREE_PARTS = [
  { key: 'trunk', size: [0.6, 2, 0.6], y: 1, material: 'trunk' },
  { key: 'lower', size: [3, 2.2, 3], y: 3.1, material: 'leaves' },
  { key: 'upper', size: [2, 1.6, 2], y: 4.8, rotation: 0.5, material: 'leavesLight' },
]

/**
 * The way out of the hub.
 *
 * A carpeted staircase climbing between two battlemented stone walls, with the
 * arena past the top. Walking up it is the transition - no button - and the
 * sign overhead says whether the level ahead is ready for you.
 *
 * Every surface is built the way the rest of the world is: coursed brick on the
 * walls and treads, grass lids on dirt, a runner laid as real blocks rather
 * than a painted plane. The steps mirror `stairHeightAt` in data/lobby.js,
 * which is what the player controller walks on, so the visible staircase and
 * the surface underfoot can never drift apart.
 */
export default function ArenaGate() {
  const enterArena = useGameStore((s) => s.enterArena)
  const bestStage = useGameStore((s) => s.bestStage)

  const carpetGlow = useRef()
  const anim = useRef({ near: 0, phase: 0, armed: false })

  const materials = useMemo(() => {
    const flat = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra })

    return {
      // Coursed stone, tiled along the wall's length rather than square, so the
      // bricks stay brick-shaped on a face four times longer than it is tall.
      wall: voxelMaterial('#9aa3ad', {
        pattern: 'studs',
        cells: 6,
        variance: 0.09,
        fleckDepth: 0.22,
        repeat: [3, 2],
        seed: 17,
      }),
      pillar: voxelMaterial('#aab3bd', {
        pattern: 'studs',
        cells: 8,
        variance: 0.08,
        fleckDepth: 0.2,
        repeat: [1, 3],
        seed: 19,
      }),
      cap: flat('#6d7681'),
      merlon: voxelMaterial('#7f8893', {
        pattern: 'studs',
        cells: 4,
        variance: 0.09,
        fleckDepth: 0.22,
        seed: 23,
      }),
      tread: voxelMaterial('#c9d1d9', {
        pattern: 'studs',
        cells: 4,
        variance: 0.07,
        fleckDepth: 0.18,
        repeat: [3, 1],
        seed: 29,
      }),
      carpet: flat('#f2799f', { roughness: 0.75 }),
      trim: flat('#ffd166', { roughness: 0.6 }),
      banner: flat('#e8496b', { roughness: 0.7 }),
      post: flat('#5c6672'),
      lantern: flat('#ffd76b', {
        emissive: new THREE.Color('#ffb703'),
        emissiveIntensity: 0.9,
        roughness: 0.4,
      }),
      grass: voxelMaterial(LOBBY_PALETTE.grass, {
        cells: 8,
        variance: 0.08,
        fleck: 0.3,
        fleckDepth: 0.17,
        repeat: [16, 2],
        seed: 37,
      }),
      soil: voxelMaterial(LOBBY_PALETTE.wall, {
        cells: 8,
        variance: 0.11,
        fleck: 0.34,
        fleckDepth: 0.24,
        repeat: [16, 1],
        seed: 41,
      }),
      trunk: flat('#8a5a3b', { roughness: 0.95 }),
      leaves: flat('#3f9a35'),
      leavesLight: flat('#54bb45'),
    }
  }, [])

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  const geometries = useMemo(
    () => ({
      block: new THREE.BoxGeometry(1, 1, 1),
      trunk: new THREE.BoxGeometry(...TREE_PARTS[0].size),
      lower: new THREE.BoxGeometry(...TREE_PARTS[1].size),
      upper: new THREE.BoxGeometry(...TREE_PARTS[2].size),
    }),
    []
  )
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries])

  /** Grass lid, dirt sides: [+x, -x, +y, -y, +z, -z]. */
  const groundMaterials = useMemo(
    () => [
      materials.soil,
      materials.soil,
      materials.grass,
      materials.soil,
      materials.soil,
      materials.soil,
    ],
    [materials]
  )

  // Steps are laid out once; tread, runner and trim all come from here.
  const steps = useMemo(
    () =>
      Array.from({ length: E.stepCount }, (_, i) => ({
        z: E.stepFromZ - i * E.stepRun - E.stepRun / 2,
        height: (i + 1) * E.stepRise,
      })),
    []
  )

  const stairBlocks = useMemo(() => {
    const treads = []
    const runners = []
    const trims = []

    for (const step of steps) {
      treads.push({
        position: [0, step.height / 2, step.z],
        scale: [E.gapHalfWidth * 2, step.height, E.stepRun],
      })
      runners.push({
        position: [0, step.height + RUNNER_RISE / 2, step.z],
        scale: [E.gapHalfWidth * 1.5, RUNNER_RISE, E.stepRun],
      })
      // Gold edging either side of the runner.
      for (const side of [-1, 1]) {
        trims.push({
          position: [side * E.gapHalfWidth * 0.86, step.height + RUNNER_RISE / 2, step.z],
          scale: [0.28, RUNNER_RISE * 1.2, E.stepRun],
        })
      }
    }

    // The landing at the top carries the runner on into the fog.
    runners.push({
      position: [0, E.stepCount * E.stepRise + RUNNER_RISE / 2, ARENA_STAIR_TOP_Z - 5],
      scale: [E.gapHalfWidth * 1.5, RUNNER_RISE, 10],
    })

    return { treads, runners, trims }
  }, [steps])

  const wallBlocks = useMemo(() => {
    const pillars = []
    const pillarCaps = []
    const merlons = []
    // Individual stones over the inner faces, so eleven metres of wall reads
    // as courses of masonry rather than one tall grey slab.
    const stones = []

    for (const side of [-1, 1]) {
      // Pillars stand proud of the inner face, so they catch the light.
      const innerX = side * PILLAR_X
      for (const z of PILLARS) {
        pillars.push({
          position: [innerX, E.wallHeight / 2, z],
          scale: [PILLAR_DEPTH, E.wallHeight, 1.5],
        })
        pillarCaps.push({ position: [innerX, E.wallHeight + 0.55, z], scale: [1.9, 0.7, 2] })
      }
      for (const z of MERLONS) {
        merlons.push({
          position: [side * WALL_CENTRE_X, E.wallHeight + 1.05, z],
          scale: [E.wallWidth * 0.82, 1.1, 1.3],
        })
      }

      stones.push(
        ...wallStones({
          axis: 'z',
          from: E.wallFromZ,
          to: E.wallToZ,
          faceAt: side * INNER_FACE_X,
          height: E.wallHeight,
          block: 2.4,
          seed: 41 + side,
        })
      )
    }

    return { pillars, pillarCaps, merlons, stones }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const dx = playerPosition.x - ARENA_GATE.position[0]
    const dz = playerPosition.z - ARENA_GATE.position[2]
    const inside = Math.hypot(dx, dz) < ARENA_GATE.radius

    a.near += ((inside ? 1 : 0) - a.near) * Math.min(1, delta * 8)

    // Arm only once the player has stepped back out, so arriving from the
    // arena next to the gate does not bounce them straight back in.
    if (!inside) a.armed = true
    if (inside && a.armed) {
      a.armed = false
      enterArena()
    }

    if (carpetGlow.current) {
      carpetGlow.current.material.opacity = 0.18 + a.near * 0.3 + Math.sin(a.phase * 2.6) * 0.05
    }
  })

  return (
    <group>
      {/* Retaining walls either side of the gap */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * WALL_CENTRE_X, 0, WALL_MID_Z]}>
          <mesh material={materials.wall} position={[0, E.wallHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[E.wallWidth, E.wallHeight, WALL_LENGTH]} />
          </mesh>
          <mesh material={materials.cap} position={[0, E.wallHeight + 0.25, 0]} castShadow>
            <boxGeometry args={[E.wallWidth + 0.6, 0.5, WALL_LENGTH + 0.6]} />
          </mesh>
        </group>
      ))}

      {/* Banners hung on the pillars, facing down the walkway */}
      {BANNERS.map((z) =>
        [-1, 1].map((side) => (
          <group key={`${z}-${side}`} position={[side * (PILLAR_FACE_X - 0.13), 0, z]}>
            <mesh material={materials.banner} position={[0, 6.6, 0]} castShadow={false}>
              <boxGeometry args={[0.26, 5, 2.2]} />
            </mesh>
            <mesh material={materials.trim} position={[-side * 0.02, 4.1, 0]} castShadow={false}>
              <boxGeometry args={[0.3, 0.5, 2.4]} />
            </mesh>
          </group>
        ))
      )}

      <InstancedBlocks
        items={wallBlocks.pillars}
        geometry={geometries.block}
        material={materials.pillar}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={wallBlocks.pillarCaps}
        geometry={geometries.block}
        material={materials.cap}
        castShadow
      />
      <InstancedBlocks
        items={wallBlocks.merlons}
        geometry={geometries.block}
        material={materials.merlon}
        castShadow
      />
      <InstancedBlocks
        items={wallBlocks.stones}
        geometry={geometries.block}
        material={materials.pillar}
        castShadow
        receiveShadow
      />

      {/* Grass shoulders running up to the walls */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={groundMaterials}
          position={[side * (WALL_CENTRE_X + E.wallWidth / 2 + 6), E.shoulderHeight / 2, WALL_MID_Z]}
          receiveShadow
        >
          <boxGeometry args={[12, E.shoulderHeight, WALL_LENGTH + 6]} />
        </mesh>
      ))}

      {/* Staircase: coursed treads under a runner laid in real blocks */}
      <InstancedBlocks
        items={stairBlocks.treads}
        geometry={geometries.block}
        material={materials.tread}
        castShadow
        receiveShadow
      />
      <InstancedBlocks
        items={stairBlocks.runners}
        geometry={geometries.block}
        material={materials.carpet}
        receiveShadow
      />
      <InstancedBlocks
        items={stairBlocks.trims}
        geometry={geometries.block}
        material={materials.trim}
        receiveShadow
      />

      {/* Lanterns lighting the climb */}
      {LANTERNS.map((lantern) =>
        [-1, 1].map((side) => (
          <group
            key={`${lantern.z}-${side}`}
            position={[side * LANTERN_X, lantern.height, lantern.z]}
          >
            <mesh material={materials.post} position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[0.3, 2.2, 0.3]} />
            </mesh>
            <mesh material={materials.lantern} position={[0, 2.45, 0]}>
              <boxGeometry args={[0.62, 0.62, 0.62]} />
            </mesh>
            <mesh material={materials.cap} position={[0, 2.9, 0]}>
              <boxGeometry args={[0.8, 0.28, 0.8]} />
            </mesh>
          </group>
        ))
      )}

      {/*
        Scenery past the top of the stairs. Without it the gap between the
        walls frames nothing but empty sky, and the climb reads as a dead end
        rather than somewhere you are going.
      */}
      <group position={[0, E.stepCount * E.stepRise, ARENA_STAIR_TOP_Z]}>
        {/* Flat landing, then two terraces climbing to fill the opening. */}
        <mesh material={groundMaterials} position={[0, -0.6, -5]} receiveShadow>
          <boxGeometry args={[80, 1.2, 12]} />
        </mesh>
        <mesh material={groundMaterials} position={[0, 1, -16]} receiveShadow castShadow>
          <boxGeometry args={[80, 3.4, 12]} />
        </mesh>
        <mesh material={groundMaterials} position={[0, 3.6, -28]} receiveShadow castShadow>
          <boxGeometry args={[80, 8, 16]} />
        </mesh>

        {TREE_PARTS.map((part) => (
          <InstancedBlocks
            key={part.key}
            items={BEYOND_TREES}
            geometry={geometries[part.key]}
            material={materials[part.material]}
            part={{ position: [0, part.y, 0], rotation: part.rotation ?? 0 }}
            castShadow
          />
        ))}
      </group>

      {/* Warm light spilling down the runner as you approach */}
      <mesh
        ref={carpetGlow}
        position={[0, 0.06, E.stepFromZ + 1.5]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[E.gapHalfWidth * 2, 4]} />
        <meshBasicMaterial
          color="#ffd9e4"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Sign hanging over the gap */}
      <Billboard position={[0, 7.4, E.stepFromZ - 2]}>
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.62}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.075}
          outlineColor="#2b3245"
          maxWidth={9}
          textAlign="center"
        >
          {'Defeat all enemies first!'}
        </Text>
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.34}
          color="#ffe9f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#2b3245"
        >
          {`Every run starts at Stage 1  -  best ${Math.min(MAX_STAGES, bestStage + 1)}`}
        </Text>
      </Billboard>
    </group>
  )
}
