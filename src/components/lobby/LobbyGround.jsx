import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  ARENA_ENTRANCE,
  LEFT_STAIRS,
  LEFT_TIER,
  LOBBY_PALETTE,
  PLAZA,
  TERRACES,
  lobbyTufts,
  treeLayout,
} from '../../data/lobby.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'

/**
 * The hub's terrain: a checkered stone concourse, bright grass lanes either
 * side, the raised left tier and its stairs, grass-topped dirt terraces
 * stepping up to a timber fence, and blocky pines behind it.
 *
 * Everything is flat-shaded boxes wearing procedural voxel textures - grass on
 * the lids, dirt down the faces, the way terrain is cut in a block game - and
 * the paving is one tiling texture rather than thousands of tile meshes. The
 * trees and the grass tufts are instanced, so the whole environment stays
 * around thirty draw calls and runs on a phone.
 */

/**
 * Voxel textures are UV-mapped per box face, so a repeat that gives square
 * cells on a terrace lid smears them across its riser. Anything the player can
 * see two faces of gets a material per orientation, tuned to that face.
 */
function useLobbyMaterials() {
  const bundle = useMemo(() => {
    const make = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra })

    const grass = (color, repeat, seed) =>
      voxelMaterial(color, {
        cells: 8,
        variance: 0.08,
        fleck: 0.3,
        fleckDepth: 0.17,
        repeat,
        seed,
      })

    /** Paving: a jittered checker with grout, sized to one-metre slabs. */
    const paving = (color, accent, repeat, seed) =>
      voxelMaterial(color, {
        pattern: 'tiles',
        cells: 4,
        variance: 0.05,
        fleckDepth: 0.14,
        accent,
        repeat,
        roughness: 0.9,
        seed,
      })

    /** Coursed stone for the tier and its steps. */
    const masonry = (repeat, seed) =>
      voxelMaterial('#aeb8c6', {
        pattern: 'bricks',
        cells: 6,
        variance: 0.08,
        fleckDepth: 0.2,
        repeat,
        seed,
      })

    const plazaLength = PLAZA.from - PLAZA.to

    return {
      // Lids: the terraces run along Z, the back one along X, so their repeats
      // are transposed.
      field: grass('#6fca52', [48, 52], 11),
      terraceTops: [
        grass(LOBBY_PALETTE.grass, [2, 20], 23),
        grass('#54ad3e', [2, 20], 29),
        grass(LOBBY_PALETTE.grassDark, [2, 20], 31),
      ],
      backTop: grass('#54ad3e', [20, 2], 43),
      // Faces: dirt, cut away under the grass.
      soil: voxelMaterial(LOBBY_PALETTE.wall, {
        cells: 8,
        variance: 0.11,
        fleck: 0.36,
        fleckDepth: 0.24,
        repeat: [20, 1],
        seed: 53,
      }),
      /*
       * Three masonry materials, not one. A box UV-maps every face to 0-1, so
       * the repeat that makes square bricks on the tier's long flank turns the
       * same bricks into vertical streaks on its narrow end - which is exactly
       * what the stair sides were doing.
       */
      stoneLong: masonry([10, 1], 67),
      stoneWide: masonry([2, 1], 71),
      stoneNarrow: masonry([1, 1], 73),
      stoneStep: masonry([7, 1], 79),
      concourse: paving('#e6ebf2', '#c3ccd8', [PLAZA.halfWidth / 2, plazaLength / 4], 83),
      tierSurface: paving(
        '#e6ebf2',
        '#c3ccd8',
        [(LEFT_TIER.maxX - LEFT_TIER.minX) / 4, (LEFT_TIER.maxZ - LEFT_TIER.minZ) / 4],
        89
      ),
      lane: paving('#79d45f', '#5fbb46', [1.6, plazaLength / 4], 97),
      kerb: make(LOBBY_PALETTE.pathEdge),
      post: make('#a9713f'),
      rail: make('#c98a4b'),
      trunk: make('#7a5230'),
      leaf: make('#48b356'),
      leafMid: make('#3a9c48'),
      leafDark: make('#2f7d3b'),
      tuft: make('#a6e75c', { roughness: 0.85 }),
    }
  }, [])

  // Materials are ours; their maps belong to the shared texture cache.
  useEffect(
    () => () => {
      Object.values(bundle)
        .flat()
        .forEach((m) => {
          if (m instanceof THREE.Material) m.dispose()
        })
    },
    [bundle]
  )

  return bundle
}

/** Half-width of the ground the arena entrance occupies: gap plus both walls. */
const ENTRANCE_HALF_SPAN = ARENA_ENTRANCE.gapHalfWidth + ARENA_ENTRANCE.wallWidth

/** Timber fence: posts with two rails, matching the hub's blocky look. */
function Fence({ materials, from, to, x, axis = 'z' }) {
  const posts = useMemo(() => {
    const out = []
    const step = 6
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    for (let v = start; v <= end; v += step) out.push(v)
    return out
  }, [from, to])

  const length = Math.abs(to - from)
  const centre = (from + to) / 2

  const postPos = (v) => (axis === 'z' ? [x, 2.2, v] : [v, 2.2, x])
  const railSize = axis === 'z' ? [0.4, 0.55, length] : [length, 0.55, 0.4]
  const railPos = (y) => (axis === 'z' ? [x, y, centre] : [centre, y, x])

  return (
    <group>
      {posts.map((v) => (
        <mesh key={v} material={materials.post} position={postPos(v)} castShadow receiveShadow>
          <boxGeometry args={[0.7, 4.4, 0.7]} />
        </mesh>
      ))}
      {[1.5, 3.1].map((y) => (
        <mesh key={y} material={materials.rail} position={railPos(y)} castShadow receiveShadow>
          <boxGeometry args={railSize} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Blocky pines: a trunk under three shrinking canopy blocks, the middle one
 * turned off-square so a stack of boxes does not read as a smooth cone.
 *
 * Four dozen trees are four instanced draw calls - one per block of the tree -
 * rather than nearly two hundred meshes.
 */
const TREE_PARTS = [
  { key: 'trunk', size: [0.55, 1.8, 0.55], y: 0.9, material: 'trunk' },
  { key: 'lower', size: [2.6, 1.3, 2.6], y: 2.3, material: 'leafDark' },
  { key: 'mid', size: [2, 1.1, 2], y: 3.4, rotation: 0.5, material: 'leafMid' },
  { key: 'top', size: [1.25, 0.95, 1.25], y: 4.35, material: 'leaf' },
]

function Trees({ materials }) {
  const trees = useMemo(
    () =>
      treeLayout(46).map((tree) => ({
        position: [tree.position[0], tree.terraceHeight ?? 0, tree.position[2]],
        rotation: tree.rotation,
        scale: tree.scale,
      })),
    []
  )

  const geometries = useMemo(
    () =>
      TREE_PARTS.map(
        (part) => new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2])
      ),
    []
  )

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  return (
    <>
      {TREE_PARTS.map((part, i) => (
        <InstancedBlocks
          key={part.key}
          items={trees}
          geometry={geometries[i]}
          material={materials[part.material]}
          part={{ position: [0, part.y, 0], rotation: part.rotation ?? 0 }}
          castShadow
        />
      ))}
    </>
  )
}

/** Grass blades tufting the terraces. One taper, scaled and leaned per blade. */
function Tufts({ materials }) {
  const items = useMemo(() => lobbyTufts(), [])
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.045, 0.11, 1, 4), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return <InstancedBlocks items={items} geometry={geometry} material={materials.tuft} />
}

export default function LobbyGround() {
  const materials = useLobbyMaterials()

  const length = PLAZA.from - PLAZA.to
  const centreZ = (PLAZA.from + PLAZA.to) / 2
  const half = PLAZA.halfWidth
  const walk = PLAZA.walkwayHalfWidth
  const y = PLAZA.pathHeight

  /** Grass lid, dirt sides: [+x, -x, +y, -y, +z, -z]. */
  const terraceMaterials = useMemo(
    () =>
      materials.terraceTops.map((top) => [
        materials.soil,
        materials.soil,
        top,
        materials.soil,
        materials.soil,
        materials.soil,
      ]),
    [materials]
  )

  /*
   * Face order is [+x, -x, +y, -y, +z, -z]. The tier is a long flank seen from
   * the plaza; a step is a wide tread with two narrow ends - so each gets the
   * masonry cut for the face it shows.
   */
  const tierMaterials = useMemo(
    () => [
      materials.stoneLong,
      materials.stoneLong,
      materials.stoneWide,
      materials.stoneWide,
      materials.stoneWide,
      materials.stoneWide,
    ],
    [materials]
  )

  const stepMaterials = useMemo(
    () => [
      materials.stoneNarrow,
      materials.stoneNarrow,
      materials.stoneStep,
      materials.stoneStep,
      materials.stoneStep,
      materials.stoneStep,
    ],
    [materials]
  )

  const backMaterials = useMemo(
    () => [
      materials.soil,
      materials.soil,
      materials.backTop,
      materials.soil,
      materials.soil,
      materials.soil,
    ],
    [materials]
  )

  return (
    <group>
      {/* Base grass field under everything */}
      <mesh material={materials.field} position={[0, -0.4, centreZ]} receiveShadow>
        <boxGeometry args={[260, 0.8, 280]} />
      </mesh>

      {/* Concourse slab + kerb */}
      <mesh material={materials.kerb} position={[0, y / 2, centreZ]} receiveShadow>
        <boxGeometry args={[half * 2 + 1.4, y, length + 1.4]} />
      </mesh>

      {/* Checkered stone either side of the lanes */}
      <mesh
        material={materials.concourse}
        position={[0, y + 0.01, centreZ]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry args={[half * 2, length]} />
      </mesh>

      {/* Bright grass lanes flanking the central walkway */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={materials.lane}
          position={[side * (walk + 3.4), y + 0.02, centreZ]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          <planeGeometry args={[6.4, length]} />
        </mesh>
      ))}

      {/* Terraces */}
      {TERRACES.map((terrace, i) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${i}-${side}`}
            material={terraceMaterials[i % terraceMaterials.length]}
            position={[side * terrace.offset, terrace.height / 2, centreZ]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[terrace.width, terrace.height, length + 60]} />
          </mesh>
        ))
      )}

      {/* Raised left tier carrying the back row of stage podiums */}
      <mesh
        material={tierMaterials}
        position={[
          (LEFT_TIER.minX + LEFT_TIER.maxX) / 2,
          LEFT_TIER.height / 2,
          (LEFT_TIER.minZ + LEFT_TIER.maxZ) / 2,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            LEFT_TIER.maxX - LEFT_TIER.minX,
            LEFT_TIER.height,
            LEFT_TIER.maxZ - LEFT_TIER.minZ,
          ]}
        />
      </mesh>
      <mesh
        material={materials.tierSurface}
        position={[
          (LEFT_TIER.minX + LEFT_TIER.maxX) / 2,
          LEFT_TIER.height + 0.01,
          (LEFT_TIER.minZ + LEFT_TIER.maxZ) / 2,
        ]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry
          args={[LEFT_TIER.maxX - LEFT_TIER.minX, LEFT_TIER.maxZ - LEFT_TIER.minZ]}
        />
      </mesh>

      {/* Stairs up to the tier, matching groundHeightAt's step function */}
      {Array.from({ length: LEFT_STAIRS.steps }, (_, i) => {
        const depth = (LEFT_STAIRS.toZ - LEFT_STAIRS.fromZ) / LEFT_STAIRS.steps
        /*
         * Step 0 is the TOP one, nearest the tier edge, and they get shorter
         * walking away from it - the staircase climbs onto the tier. The
         * height has to count down with `i` for that: counting up drew the
         * flight back to front, so it descended toward the tier it is meant to
         * climb, and the dino walked through mid-air over the low end.
         */
        const height = ((LEFT_STAIRS.steps - i) / LEFT_STAIRS.steps) * LEFT_TIER.height
        const z = LEFT_STAIRS.fromZ + depth * (i + 0.5)
        return (
          <mesh
            key={i}
            material={stepMaterials}
            position={[
              (LEFT_STAIRS.minX + LEFT_STAIRS.maxX) / 2,
              height / 2,
              z,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[LEFT_STAIRS.maxX - LEFT_STAIRS.minX, height, depth]} />
          </mesh>
        )
      })}

      {/* Back terrace closing the far end */}
      <mesh
        material={backMaterials}
        position={[0, 1.7, PLAZA.to - 9]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[half * 2 + 70, 3.4, 14]} />
      </mesh>

      {/* Fences along the plaza edges and across the back */}
      {[-1, 1].map((side) => (
        <Fence
          key={side}
          materials={materials}
          x={side * (half + 0.9)}
          from={PLAZA.from}
          to={PLAZA.to}
          axis="z"
        />
      ))}
      {/*
        The back fence stops either side of the arena entrance - the walls and
        staircase fill that gap, and a rail running through them looked like a
        bug.
      */}
      {[-1, 1].map((side) => (
        <Fence
          key={side}
          materials={materials}
          x={PLAZA.to - 1.5}
          from={side < 0 ? -half : ENTRANCE_HALF_SPAN}
          to={side < 0 ? -ENTRANCE_HALF_SPAN : half}
          axis="x"
        />
      ))}

      <Tufts materials={materials} />
      <Trees materials={materials} />
    </group>
  )
}
