import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  ARENA_ENTRANCE,
  LEFT_STAIRS,
  LEFT_TIER,
  LOBBY_PALETTE,
  PLAZA,
  TERRACES,
  lobbyBlocks,
  lobbyTufts,
  treeLayout,
} from '../../data/lobby.js'
import { treeBoxes } from '../../data/foliage.js'
import { mergeBoxesByMaterial } from '../../systems/mergeBoxes.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import MergedBoxes, { useMergedBoxes } from '../MergedBoxes.jsx'
import { DECAL, DECAL_ABOVE } from '../../systems/decal.js'
import { ARENA_RAMP_TOP_Z } from '../../data/lobby.js'

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
        pattern: 'studs',
        cells: 8,
        variance: 0.08,
        fleck: 0.3,
        fleckDepth: 0.17,
        repeat,
        seed,
      })

    /**
     * Paving: a checker of moulded slabs. Studs on the plaza too, not just on
     * the grass - in this world every surface is a moulded brick, and a smooth
     * plaza in the middle of it was the one place that gave the game away.
     */
    const paving = (color, accent, repeat, seed, decal) =>
      voxelMaterial(color, {
        decal,
        pattern: 'studs',
        cells: 4,
        variance: 0.05,
        fleckDepth: 0.16,
        accent,
        repeat,
        roughness: 0.9,
        seed,
      })

    /** Moulded blocks for anything built out of them: trees, trunks, crates. */
    const studded = (color, seed) =>
      voxelMaterial(color, {
        pattern: 'studs',
        cells: 4,
        variance: 0.07,
        fleckDepth: 0.22,
        roughness: 0.85,
        seed,
      })

    /** Coursed stone for the tier and its steps. */
    const masonry = (repeat, seed) =>
      voxelMaterial('#c9d6e8', {
        pattern: 'studs',
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
      field: grass('#8ee04a', [48, 52], 11),
      terraceTops: [
        grass(LOBBY_PALETTE.grass, [2, 20], 23),
        grass('#76cc39', [2, 20], 29),
        grass(LOBBY_PALETTE.grassDark, [2, 20], 31),
      ],
      backTop: grass('#76cc39', [20, 2], 43),
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
      /*
       * Painted onto the kerb slab, one centimetre above it, and the lanes are
       * painted on top of that again. Two stacked overlays need two different
       * biases or they fight each other instead of the thing underneath.
       */
      /*
       * Big pale slabs, close in tone.
       *
       * The plaza checkered in two greys a shade apart at four squares to the
       * repeat, which at walking height is a bathroom floor: a fine grid that
       * shimmers as you move and gives the eye nothing to hold. The reference
       * lays a *slab* - each tile is about a dino wide, near-white against pale
       * blue-grey, with the seam doing the work rather than the contrast. Same
       * two-tone checker, a third as many tiles, twice as bright - and every
       * slab moulded with the same round studs the buttons wear, because in
       * this world there is one material and the plaza is made of it too.
       */
      /*
       * `repeat` is how many times the texture tiles across the mesh, so it
       * runs *backwards* from the thing you are trying to set: a bigger divisor
       * is fewer repeats is bigger slabs. Each repeat carries a four-by-four
       * checker, so the slab you actually see is one sixteenth of one tiling -
       * about two and a half units here, which is a dino across.
       */
      concourse: paving('#eef4fb', '#d2dfee', [PLAZA.halfWidth / 5, plazaLength / 10], 83, DECAL),
      tierSurface: paving(
        '#eef4fb',
        '#d2dfee',
        [(LEFT_TIER.maxX - LEFT_TIER.minX) / 10, (LEFT_TIER.maxZ - LEFT_TIER.minZ) / 10],
        89,
        DECAL
      ),
      /*
       * The grass lanes tile at the concourse's scale, not their own.
       *
       * They were laid at two and a half times the density, so a floor that is
       * one surface came out as big pale slabs with a strip of fine green
       * gingham running down either side of it. Two tile sizes on one floor is
       * the seam you notice.
       */
      lane: paving('#8ce85f', '#6ad04a', [0.64, plazaLength / 10], 97, DECAL_ABOVE),
      kerb: make(LOBBY_PALETTE.pathEdge),
      post: make('#a9713f'),
      rail: make('#c98a4b'),
      // Warm orange bark, the way a toy tree is moulded - the old cocoa brown
      // was the same value as the shadow under the canopy, so trunk and shade
      // ran together into one dark shape.
      trunk: studded('#c07a3e', 91),
      // Three greens up a shade each, and closer together: the old set ran
      // from mid-green to near-black, so a canopy read as a hole in the sky.
      leaf: studded('#7bd63f', 93),
      leafMid: studded('#68c435', 95),
      leafDark: studded('#57ad2c', 97),
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

/**
 * How far each half of the back terrace reaches in from its outer end.
 *
 * The one number to move if you want more clear ground beside the way into
 * Stage 1. Lower it and the wall's inner edge slides *away* from the doorway;
 * the outer corner does not move. Clamped at the corridor's own half-width, so
 * however small it gets it can never grow back across the gateway it is split
 * around.
 *
 * 48.8 is the length the two halves have always had - outer edge at
 * `PLAZA.halfWidth + 20`, inner edge hard against the gateway - so this is the
 * old shape written as a length rather than as two edges.
 */
const BACK_TERRACE_LENGTH = 44.8

/** Half-width of the ground the arena entrance occupies: gap plus both walls. */
const ENTRANCE_HALF_SPAN = ARENA_ENTRANCE.gapHalfWidth + ARENA_ENTRANCE.wallWidth

/**
 * Timber fence: posts with two rails, matching the hub's blocky look.
 *
 * A run of ten posts was ten draw calls for a thing that never moves. The posts
 * and the rails are welded into one mesh per timber colour - the same fence,
 * submitted twice instead of a dozen times.
 */
function Fence({ materials, from, to, x, axis = 'z' }) {
  const groups = useMergedBoxes(() => {
    const step = 6
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    const length = Math.abs(to - from)
    const centre = (from + to) / 2
    const boxes = []

    for (let v = start; v <= end; v += step) {
      boxes.push({
        material: 'post',
        position: axis === 'z' ? [x, 2.2, v] : [v, 2.2, x],
        size: [0.7, 4.4, 0.7],
        shadow: true,
      })
    }
    for (const y of [1.5, 3.1]) {
      boxes.push({
        material: 'rail',
        position: axis === 'z' ? [x, y, centre] : [centre, y, x],
        size: axis === 'z' ? [0.4, 0.55, length] : [length, 0.55, 0.4],
        shadow: true,
      })
    }
    return boxes
  }, [from, to, x, axis])

  return (
    <group name="Fence">
      <MergedBoxes groups={groups} materials={materials} />
    </group>
  )
}

/**
 * Blocky pines: a stacked trunk under a cluster of canopy cubes.
 *
 * The shape comes from data/foliage.js, so the hub and the arena grow the same
 * tree. Its blocks are welded into one geometry per tint before instancing, so
 * a fourteen-cube tree draws in three calls across the whole terrace - fewer
 * than the four the old three-slab tree needed.
 */
function Trees({ materials }) {
  const trees = useMemo(
    () =>
      treeLayout(26).map((tree) => ({
        position: [tree.position[0], tree.terraceHeight ?? 0, tree.position[2]],
        rotation: tree.rotation,
        scale: tree.scale,
      })),
    []
  )

  const groups = useMemo(() => mergeBoxesByMaterial(treeBoxes({ seed: 3 })), [])

  useEffect(
    () => () => groups.forEach((group) => group.geometry.dispose()),
    [groups]
  )

  /** foliage.js names the tints; the hub already has materials for them. */
  const tint = {
    trunk: materials.trunk,
    leaf: materials.leafDark,
    leafLight: materials.leaf,
  }

  return (
    <>
      {groups.map((group) => (
        <InstancedBlocks
          key={group.key}
          items={trees}
          geometry={group.geometry}
          material={tint[group.key] ?? materials.leaf}
          castShadow
        />
      ))}
    </>
  )
}

/** The high garden wall directly behind the rebirth pedestals. */
function RearGardenWall({ materials, wallMaterials, terrainMaterials }) {
  const terraces = useMemo(
    () => [
      // Each ledge steps upward away from the plaza, like the reference hub.
      { position: [0, 1.1, 29.5], size: [78, 2.2, 4], material: terrainMaterials },
      { position: [0, 3, 33], size: [80, 6, 4], material: terrainMaterials },
      { position: [0, 5.3, 36.5], size: [84, 10.6, 4], material: wallMaterials },
    ],
    []
  )

  const trees = useMemo(
    () =>
      [
        [-36, 10.6, 36.5, 1.05, 0.2],
        [-29, 10.6, 36.5, 1.48, 1.1],
        [-21, 10.6, 36.5, 1.1, 2.3],
        [-12, 10.6, 36.5, 1.55, 0.7],
        [-3, 10.6, 36.5, 1.02, 1.8],
        [6, 10.6, 36.5, 1.35, 2.8],
        [15, 10.6, 36.5, 1.1, 0.5],
        [24, 10.6, 36.5, 1.56, 1.6],
        [33, 10.6, 36.5, 1.08, 2.5],
      ].map(([x, y, z, scale, rotation]) => ({ position: [x, y, z], scale, rotation })),
    []
  )

  const groups = useMemo(() => mergeBoxesByMaterial(treeBoxes({ seed: 41 })), [])
  useEffect(() => () => groups.forEach((group) => group.geometry.dispose()), [groups])

  const tint = {
    trunk: materials.trunk,
    leaf: materials.leafDark,
    leafLight: materials.leaf,
  }

  return (
    <group name="RearGardenWall">
      {terraces.map((terrace, i) => (
        <mesh key={i} material={terrace.material} position={terrace.position} castShadow receiveShadow>
          <boxGeometry args={terrace.size} />
        </mesh>
      ))}
      {groups.map((group) => (
        <InstancedBlocks
          key={`back-${group.key}`}
          items={trees}
          geometry={group.geometry}
          material={tint[group.key] ?? materials.leaf}
          castShadow
        />
      ))}
    </group>
  )
}

/**
 * The outer perimeter joins the rear garden wall into a complete forested
 * enclosure. The only break is the arena approach, so the lobby still has a
 * natural way out while every normal camera angle lands on stone and trees.
 */
function PerimeterGardenWall({ materials, wallMaterials }) {
  const walls = useMemo(
    () => [
      // Straight flanks stop early, then kick inward into garden-like corners.
      { position: [-73, 4.4, -30], size: [4, 8.8, 82] },
      { position: [73, 4.4, -30], size: [4, 8.8, 82] },
      { position: [-65.5, 4.4, 23.25], size: [4, 8.8, 30.5], rotation: 0.515 },
      { position: [65.5, 4.4, 23.25], size: [4, 8.8, 30.5], rotation: -0.515 },
      // Arena-side wall, split around the gateway.
      { position: [-52, 4.4, -73], size: [62, 8.8, 4] },
      { position: [52, 4.4, -73], size: [62, 8.8, 4] },
      // Wings connecting the tall rear garden to the outer sides.
      { position: [-57.5, 4.4, 136.5], size: [31, 8.8, 4] },
      { position: [57.5, 4.4, 36.5], size: [31, 8.8, 4] },
    ],
    []
  )

  const trees = useMemo(
    () =>
      [
        [-73, 8.8, -63, 1.2, 0.3],
        [-73, 8.8, -49, 1.5, 1.7],
        [-73, 8.8, -34, 1.08, 2.5],
        [-73, 8.8, -19, 1.38, 0.8],
        [-73, 8.8, -4, 1.12, 2.1],
        [-69, 8.8, 10, 1.55, 1.2],
        [-62, 8.8, 22, 1.18, 2.7],
        [73, 8.8, -62, 1.45, 2.8],
        [73, 8.8, -47, 1.1, 0.9],
        [73, 8.8, -32, 1.52, 2.2],
        [73, 8.8, -17, 1.2, 0.4],
        [73, 8.8, -2, 1.4, 1.6],
        [69, 8.8, 10, 1.06, 2.6],
        [62, 8.8, 22, 1.5, 0.7],
        [-66, 8.8, -73, 1.1, 0.5],
        [-53, 8.8, -73, 1.48, 1.9],
        [-39, 8.8, -73, 1.2, 2.7],
        [-25, 8.8, -73, 1.55, 1.1],
       
        
        [27, 8.8, -73, 1.16, 1.5],
        [41, 8.8, -73, 1.52, 2.8],
        [54, 8.8, -73, 1.1, 0.9],
        [66, 8.8, -73, 1.45, 2.1],
        [-64, 8.8, 36.5, 1.16, 0.7],
        [-51, 8.8, 36.5, 1.5, 2.3],
        [51, 8.8, 36.5, 1.22, 1.4],
        [64, 8.8, 36.5, 1.46, 2.6],
      ].map(([x, y, z, scale, rotation]) => ({ position: [x, y, z], scale, rotation })),
    []
  )

  const treeGroups = useMemo(() => mergeBoxesByMaterial(treeBoxes({ seed: 67 })), [])
  useEffect(() => () => treeGroups.forEach((group) => group.geometry.dispose()), [treeGroups])

  const tint = {
    trunk: materials.trunk,
    leaf: materials.leafDark,
    leafLight: materials.leaf,
  }

  return (
    <group name="PerimeterGardenWall">
      {walls.map((wall, i) => (
        <mesh
          key={i}
          material={wallMaterials}
          position={wall.position}
          rotation-y={wall.rotation ?? 0}
          castShadow
          receiveShadow
        >
          <boxGeometry args={wall.size} />
        </mesh>
      ))}
      {treeGroups.map((group) => (
        <InstancedBlocks
          key={group.key}
          items={trees}
          geometry={group.geometry}
          material={tint[group.key] ?? materials.leaf}
          castShadow
        />
      ))}
    </group>
  )
}

/** Primary colours, in the order lobbyBlocks' `tone` indexes them. */
const BLOCK_TONES = ['#ff5d5d', '#ffd23f', '#4fc3ff', '#a06bff', '#3fd68a']

/**
 * Stacks of bright toy blocks around the hub's edges.
 *
 * One instanced mesh per colour, each wearing the same studs as the ground, so
 * a heap of them costs five draw calls and still reads as moulded bricks.
 */
function ToyBlocks() {
  const stacks = useMemo(() => lobbyBlocks(), [])
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  const materials = useMemo(
    () =>
      BLOCK_TONES.map((color, i) =>
        voxelMaterial(color, {
          pattern: 'studs',
          cells: 4,
          variance: 0.06,
          fleckDepth: 0.2,
          roughness: 0.75,
          seed: 200 + i,
        })
      ),
    []
  )

  const byTone = useMemo(
    () => BLOCK_TONES.map((_, tone) => stacks.filter((item) => item.tone === tone)),
    [stacks]
  )

  useEffect(
    () => () => {
      geometry.dispose()
      materials.forEach((m) => m.dispose())
    },
    [geometry, materials]
  )

  return (
    <>
      {byTone.map((items, tone) => (
        <InstancedBlocks
          key={tone}
          items={items}
          geometry={geometry}
          material={materials[tone]}
          castShadow
          receiveShadow
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

/**
 * Where the grass runs between the paving, measured out from the centre line.
 *
 * The walkway itself stays stone - it is the way to the arena and wants to read
 * as a road - and the lanes either side of it alternate from there outward.
 */
const LANES = [
  { x: PLAZA.walkwayHalfWidth + 3.4, width: 6.4 },
  { x: PLAZA.walkwayHalfWidth + 14, width: 5.4 },
  { x: PLAZA.walkwayHalfWidth + 22, width: 4.4 },
]

export default function LobbyGround() {
  const materials = useLobbyMaterials()

  /*
   * The paving runs from the plaza's far end all the way through the gateway
   * to where the arena takes over.
   *
   * It used to stop at `PLAZA.to`, seven metres short of the handover, and the
   * ground beyond it was the grass field a paving-lip lower. So the last stretch
   * of the walk into Stage 1 was over a raised strip with a step down either
   * side of it - the small mound you could see between the entrance walls. Now
   * the whole approach is one flat surface at the height the player walks at.
   */
  const paveTo = Math.min(PLAZA.to, ARENA_RAMP_TOP_Z - 1)
  const length = PLAZA.from - paveTo
  const centreZ = (PLAZA.from + paveTo) / 2
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
      materials.stoneLong,
      materials.stoneLong,
      materials.backTop,
      materials.stoneLong,
      materials.stoneLong,
      materials.stoneLong,
    ],
    [materials]
  )

  return (
    <group>
      {/*
        The paved plaza's top face lands on y = 0, and the grass is dropped a
        lip below it.
        
        It used to be the other way round - grass at zero and paving a quarter
        of a metre above it - while `groundHeightAt` reported zero for the whole
        plaza. So the walking surface and the drawn surface were 25cm apart: the
        dino waded through the floor to the ankle, and every pad and pedestal
        placed at ground level was sunk by exactly the same amount, which is
        most of why the training row read as painted lines rather than slabs.
        The path is still raised over the grass; it is the grass that moved.
      */}
      <mesh material={materials.field} position={[0, -0.4 - y, centreZ]} receiveShadow>
        <boxGeometry args={[260, 0.8, 280]} />
      </mesh>

      {/* Concourse slab + kerb */}
      <mesh material={materials.kerb} position={[0, -y / 2, centreZ]} receiveShadow>
        <boxGeometry args={[half * 2 + 1.4, y, length + 1.4]} />
      </mesh>

      {/* Checkered stone either side of the lanes */}
      <mesh
        material={materials.concourse}
        position={[0, 0.01, centreZ]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry args={[half * 2, length]} />
      </mesh>

      {/*
        Grass lanes running the length of the plaza.
        
        Two of them, flanking the walkway, left the rest of the floor a single
        sheet of stone thirty metres across. The reference stripes the whole
        plaza - tile, grass, tile, grass - which is what breaks that sheet into
        lanes you can see yourself walking down, and what tells you how far
        along you are without a single sign.
      */}
      {LANES.map(({ x, width }) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${x}-${side}`}
            material={materials.lane}
            position={[side * x, 0.02, centreZ]}
            rotation-x={-Math.PI / 2}
            receiveShadow
          >
            <planeGeometry args={[width, length]} />
          </mesh>
        ))
      )}

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
            <boxGeometry args={[terrace.width, terrace.height, length]} />
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
      {/*
        The terrace closing the back of the plaza, in two halves.
        
        It was one 126-metre block straight across the far end - which was fine
        while the hub sat six metres *below* the arena and you climbed a ramp
        through it. Flat, it is a wall standing in the walkway: the small mound
        between the entrance walls was this, and nothing else.
      */}
      {[-1, 1].map((side) => {
        /*
         * Pinned at the outer end, trimmed from the doorway.
         *
         * It used to be spanned the other way round - a fixed inner edge at the
         * gateway and an outer edge you set - so shortening it pulled the far
         * corner in toward the middle of the plaza and left the doorway exactly
         * as walled-in as before, which is the one end there is ever a reason
         * to open up. Written this way the number does what it looks like it
         * does: make it smaller and the ground either side of the entrance
         * clears, while the far corner stays where it was put.
         */
        const outer = half + 35
        const inner = Math.max(ARENA_ENTRANCE.gapHalfWidth, outer - BACK_TERRACE_LENGTH)
        return (
          <mesh
            key={side}
            material={backMaterials}
            position={[side * ((inner + outer) / 2), 3.4, PLAZA.to - 9]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[outer - inner, 6.8, 14]} />
          </mesh>
        )
      })}

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
      <ToyBlocks />
      <Trees materials={materials} />
      <PerimeterGardenWall materials={materials} wallMaterials={backMaterials} />
      <RearGardenWall
        materials={materials}
        wallMaterials={backMaterials}
        terrainMaterials={terraceMaterials[1]}
      />
    </group>
  )
}
