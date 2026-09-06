import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import {
  ARENA_ENTRANCE,
  ARENA_GATE,
  ARENA_STAIR_TOP_Z,
  LOBBY_PALETTE,
} from '../../data/lobby.js'
import {
  APPROACH_DROP,
  APPROACH_EDGE_Z,
  LOBBY_Z_OFFSET,
  chamberOrigin,
} from '../../data/arena.js'
import { paletteForStage } from '../../data/areas.js'
import { formatNumber } from '../../data/progression.js'
import { MAX_STAGES, damageRating, recommendedDamage } from '../../data/stages.js'
import { wallStones } from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import Chamber from '../arena/Chamber.jsx'
import EntryGate from '../arena/EntryGate.jsx'
import ExitGate from '../arena/ExitGate.jsx'
import HeadlineText from '../HeadlineText.jsx'

const E = ARENA_ENTRANCE

/**
 * How much of the corridor the hub can see up its own staircase.
 *
 * Three levels, each with its own palette and its own gateway, which is as far
 * as the hub's fog carries: the third is mostly haze and exists so the run does
 * not visibly stop at the second. Showing only Stage 1 made the climb look like
 * it led to a single room.
 */
const STAGES_IN_VIEW = [0, 1, 2]

/** Matches the arena's own gate headline, so one colour means one thing. */
const RATING_COLOR = {
  easy: '#7ee06a',
  fair: '#ffd166',
  risky: '#ff9f43',
  blocked: '#ff6b6b',
}

/*
 * The flat bit between the top step and the chamber's floor slab.
 *
 * Its far edge is the mouth wall's outer face, which in hub coordinates is
 * `APPROACH_EDGE_Z - LOBBY_Z_OFFSET` - the same seam the arena's own view of
 * the hub is built against, read from the other side.
 */
const CHAMBER_EDGE_Z = APPROACH_EDGE_Z - LOBBY_Z_OFFSET
const LANDING_DEPTH = ARENA_STAIR_TOP_Z - CHAMBER_EDGE_Z
const LANDING_Z = (ARENA_STAIR_TOP_Z + CHAMBER_EDGE_Z) / 2
const LANDING_THICKNESS = 1.6
/** Matches the chamber's own slab, so the two meet without a step. */
const CHAMBER_FLOOR_WIDTH = 110
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
  // A rating key rather than the number itself: this is a 3D component, and it
  // must not re-reconcile every time a click lands.
  const ratingKey = useGameStore((s) => damageRating(s.clickPower, 0))

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
    }
  }, [])

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  const geometries = useMemo(
    () => ({
      block: new THREE.BoxGeometry(1, 1, 1),
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
        Stage 1, standing where Stage 1 actually is.
        
        The gap between the walls used to frame three stand-in terraces with
        scattered trees on them, so the climb led to a piece of scenery that
        looked nothing like the level at the top of it. This is the real
        chamber - the same component the arena mounts - shifted into hub space
        by the same two numbers the arena uses to put the hub at the bottom of
        these stairs. Walk up and you arrive in the place you were looking at.
      */}
      <group position={[0, APPROACH_DROP, -LOBBY_Z_OFFSET]}>
        {STAGES_IN_VIEW.map((stage) => (
          <group key={stage}>
            <Chamber
              stage={stage}
              palette={paletteForStage(stage)}
              origin={chamberOrigin(stage)}
            />
            {/*
              The gateways too, so the levels read as levels from down here
              rather than as three empty rooms. `active` false: none of these
              is the chamber you are standing in, and a gate in the hub has
              nothing to tell the arena's HUD.
            */}
            <EntryGate stage={stage} />
            <ExitGate stage={stage} active={false} sealed />
          </group>
        ))}
      </group>

      {/* The landing bridging the top step to the chamber's own floor. */}
      <mesh
        material={groundMaterials}
        position={[0, APPROACH_DROP - LANDING_THICKNESS / 2, LANDING_Z]}
        receiveShadow
      >
        <boxGeometry args={[CHAMBER_FLOOR_WIDTH, LANDING_THICKNESS, LANDING_DEPTH]} />
      </mesh>

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

      {/*
        The sign over the gap, in the same words every gate in the arena uses:
        the level through it, and what it wants from you.
        
        Every line has to fit the gap it hangs in. This sign sits *between* the
        two walls, which are eleven high and seven apart, and the old headline
        was almost eight wide - so both walls ate an end of it and it read
        "efeat all enemies firs". Nothing here is wider than the opening.
      */}
      <Billboard position={[0, 7.6, E.stepFromZ - 2]}>
        <HeadlineText size={1.05} y={1.1} shadow="#2b3245">
          Stage 1
        </HeadlineText>
        <HeadlineText size={0.34} y={0.15} color="#e6ecff" shadow="#2b3245">
          Recommended Damage:
        </HeadlineText>
        <HeadlineText
          size={0.72}
          y={-0.62}
          color={RATING_COLOR[ratingKey] ?? RATING_COLOR.fair}
          shadow="#2b3245"
        >
          {formatNumber(recommendedDamage(0))}
        </HeadlineText>
        <HeadlineText size={0.3} y={-1.42} color="#ffe9f0" shadow="#2b3245">
          {`Best so far: Stage ${Math.min(MAX_STAGES, bestStage + 1)}`}
        </HeadlineText>
      </Billboard>
    </group>
  )
}
