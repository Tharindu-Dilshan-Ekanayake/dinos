import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ARENA_ENTRANCE,
  ARENA_GATE,
  ARENA_RAMP_ANGLE,
  ARENA_RAMP_TOP_Z,
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
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import Chamber from '../arena/Chamber.jsx'
import EntryGate from '../arena/EntryGate.jsx'
import ExitGate from '../arena/ExitGate.jsx'
import { DECAL } from '../../systems/decal.js'

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
const LANDING_DEPTH = ARENA_RAMP_TOP_Z - CHAMBER_EDGE_Z
const LANDING_Z = (ARENA_RAMP_TOP_Z + CHAMBER_EDGE_Z) / 2
const LANDING_THICKNESS = 1.6
/** Matches the chamber's own slab, so the two meet without a step. */
const CHAMBER_FLOOR_WIDTH = 110
/**
 * The wall, as three courses that set back as they rise.
 *
 * `inset` slides each course *away* from the walkway so the face steps out
 * toward you at the bottom, which is how a retaining wall is built and what
 * gives the silhouette its shoulders. `top` is where that course stops.
 */
const WALL_COURSES = [
  { top: 4.6, width: E.wallWidth, inset: 0 },
  { top: 7.8, width: E.wallWidth - 1.6, inset: 0.8 },
  { top: 10.4, width: E.wallWidth - 3.4, inset: 1.7 },
]
// Total wall height for unified slab rendering
const WALL_TOTAL_HEIGHT = WALL_COURSES[WALL_COURSES.length - 1].top

const WALL_CENTRE_X = E.gapHalfWidth + E.wallWidth / 2
const WALL_LENGTH = E.wallFromZ - E.wallToZ
const WALL_MID_Z = (E.wallFromZ + E.wallToZ) / 2

/** Height of the carpet block sitting on each tread. */
const RUNNER_RISE = 0.06

/*
 * The corridor's own faces.
 *
 * Everything about the walls is placed from
 * the inner face outward rather than from a wall's centre, because the wall is
 * ten metres thick and anything positioned relative to its middle ends up
 * buried inside it.
 */
const INNER_FACE_X = E.gapHalfWidth

/**
 * The way out of the hub.
 *
 * A carpeted staircase climbing between two battlemented stone walls, with the
 * arena past the top. Walking up it is the transition - no button - and the
 * sign overhead says whether the level ahead is ready for you.
 *
 * Every surface is built the way the rest of the world is: coursed brick on the
 * walls and ramp, grass lids on dirt, a runner laid as real blocks rather
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

  const anim = useRef({ near: 0, phase: 0, armed: false })

  const materials = useMemo(() => {
    const flat = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra })

    return {
      // Coursed stone, tiled along the wall's length rather than square, so the
      // bricks stay brick-shaped on a face four times longer than it is tall.
      //
      // Coloured to match LOBBY_PALETTE.wall — the same sandy stone HubApproach
      // uses from the arena side — so crossing the scene boundary never changes
      // the colour of the walls you are standing between.
      wall: voxelMaterial(LOBBY_PALETTE.wall, {
        pattern: 'studs',
        cells: 6,
        variance: 0.09,
        fleckDepth: 0.22,
        repeat: [3, 2],
        seed: 17,
      }),
      pillar: voxelMaterial(LOBBY_PALETTE.wall, {
        pattern: 'studs',
        cells: 8,
        variance: 0.08,
        fleckDepth: 0.2,
        repeat: [1, 3],
        seed: 19,
      }),
      cap: flat(LOBBY_PALETTE.wallTop),
      tread: voxelMaterial('#c9d1d9', {
        pattern: 'studs',
        cells: 4,
        variance: 0.07,
        fleckDepth: 0.18,
        repeat: [3, 1],
        seed: 29,
      }),
      trim: flat('#ffd166', { roughness: 0.6 }),
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

  /*
   * The climb, as one tilted slab with its carpet lying on it.
   *
   * It was ten stacked boxes with ten strips of runner across them, which is a
   * *seam*: it says out loud that one place has ended and another is starting,
   * and you watch the dino hop up the risers one at a time. A slope says
   * nothing, which is the point.
   */
  const rampBlocks = useMemo(() => {
    const length = Math.hypot(E.rampRun, E.rampRise)
    const midZ = E.rampFromZ - E.rampRun / 2
    const midY = E.rampRise / 2
    // Thick enough that the wedge of ground it stands on is never see-through
    // from below at the foot, where the slab is shallowest.
    const thickness = 1.4

    /*
     * Offsets are along the slope's *normal*, not straight up.
     *
     * The first version lifted the carpet in Y alone, which on a slope this
     * steep slides it a quarter of a metre back down the ramp - far enough
     * that the tilted slab underneath swallowed it and the climb came out
     * plain grey. On a tilted surface "just above" is a direction, not an axis.
     */
    const nY = Math.cos(ARENA_RAMP_ANGLE)
    const nZ = Math.sin(ARENA_RAMP_ANGLE)
    const along = (offset) => [0, midY + offset * nY, midZ + offset * nZ]

    const treads = [
      {
        position: along(-thickness / 2),
        scale: [E.gapHalfWidth * 2, thickness, length],
        tilt: ARENA_RAMP_ANGLE,
      },
    ]

    /*
     * No carpet.
     *
     * A red runner down the middle said "this way in" back when the way in was
     * a staircase between two towers. Flat, level and paved like the plaza it
     * continues, the gateway is not an entrance to anything - it is the next
     * stretch of the same floor, exactly as the gap in a chamber's back wall
     * is. Nothing between two stages is carpeted either.
     */
    return { treads }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    /*
     * The handover is a *line* at the top of the ramp, not a circle part-way
     * up it.
     *
     * A circle at z=-45 sat half-way up the climb, which is nowhere the arena
     * can put you - its ground does not reach back that far - so crossing there
     * was always a jump. The top of the ramp is the one plane both scenes can
     * stand you on, and stepping over it hands you to the arena at the same
     * spot in its own numbers.
     */
    const climbing = playerPosition.z <= ARENA_RAMP_TOP_Z
    const inGap = Math.abs(playerPosition.x) <= E.gapHalfWidth

    // The glow at the foot still reacts to you approaching it.
    const toFoot = Math.hypot(
      playerPosition.x - ARENA_GATE.position[0],
      playerPosition.z - ARENA_GATE.position[2]
    )
    a.near += ((toFoot < 6 ? 1 : 0) - a.near) * Math.min(1, delta * 8)

    // Armed once you have stepped back off the line, so arriving from the
    // arena beside it does not bounce you straight back in.
    if (!climbing) a.armed = true
    if (climbing && inGap && a.armed) {
      a.armed = false
      enterArena()
    }

  })

  return (
    <group name="ArenaGate">
      {/*
        Retaining walls either side of the gap.
        
        Stepped rather than slab-sided: each wall is three courses that set back
        as they rise, with a lip capping every one. A single ten-metre box is a
        wall in the sense that a garage door is a wall - it has one plane and
        nothing to catch the light. Three courses give it a silhouette from the
        walkway, a shadow line down its face, and a reason for the eye to travel
        up it toward the level at the far end.
        
        They stand square now that the climb is flat. A tilted top was following
        a ramp that no longer exists.
      */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * WALL_CENTRE_X, 0, WALL_MID_Z]}>
          {/* Unified slab wall */}
          <mesh
            material={materials.wall}
            position={[side * 0, WALL_TOTAL_HEIGHT / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[E.wallWidth, WALL_TOTAL_HEIGHT, WALL_LENGTH]} />
          </mesh>
          {/* Cap on top of wall */}
          <mesh
            material={materials.cap}
            position={[side * 0, WALL_TOTAL_HEIGHT + 0.22, 0]}
            castShadow
          >
            <boxGeometry args={[E.wallWidth + 0.5, 0.44, WALL_LENGTH + 0.5]} />
          </mesh>
        </group>
      ))}

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

      {/* The ramp: one tilted slab under a carpet laid along it */}
      <InstancedBlocks
        items={rampBlocks.treads}
        geometry={geometries.block}
        material={materials.tread}
        castShadow
        receiveShadow
      />

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


      {/*
        The sign over the gap, in the same words every gate in the arena uses:
        the level through it, and what it wants from you.
        
        Every line has to fit the gap it hangs in. This sign sits *between* the
        two walls, which are eleven high and seven apart, and the old headline
        was almost eight wide - so both walls ate an end of it and it read
        "efeat all enemies firs". Nothing here is wider than the opening.
      */}
    </group>
  )
}
