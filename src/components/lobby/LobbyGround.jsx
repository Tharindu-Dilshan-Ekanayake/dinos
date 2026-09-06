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
  wallStones,
} from '../../data/lobby.js'
import { treeBoxes } from '../../data/foliage.js'
import { mergeBoxesByMaterial } from '../../systems/mergeBoxes.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import InstancedBlocks from '../InstancedBlocks.jsx'
import MergedBoxes, { useMergedBoxes } from '../MergedBoxes.jsx'

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
    const paving = (color, accent, repeat, seed) =>
      voxelMaterial(color, {
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
      concourse: paving('#fdf6e3', '#ffd9a0', [PLAZA.halfWidth / 2, plazaLength / 4], 83),
      tierSurface: paving(
        '#fdf6e3',
        '#ffd9a0',
        [(LEFT_TIER.maxX - LEFT_TIER.minX) / 4, (LEFT_TIER.maxZ - LEFT_TIER.minZ) / 4],
        89
      ),
      lane: paving('#8ce85f', '#6ad04a', [1.6, plazaLength / 4], 97),
      kerb: make(LOBBY_PALETTE.pathEdge),
      post: make('#a9713f'),
      rail: make('#c98a4b'),
      trunk: studded('#7a5230', 91),
      leaf: studded('#4fc25e', 93),
      leafMid: studded('#3a9c48', 95),
      leafDark: studded('#2f8a41', 97),
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
      treeLayout(46).map((tree) => ({
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

/**
 * Real stones standing proud of the raised tier's faces.
 *
 * The tier is a nine-by-thirty-nine metre slab, and no amount of brick texture
 * stops something that size reading as one poured lump. These are separate
 * blocks with gaps between them, so the light catches every course.
 */
function TierStones({ material }) {
  const items = useMemo(() => {
    const height = LEFT_TIER.height
    const out = []
    // The long flank that faces the plaza, and the near end you walk past.
    out.push(
      ...wallStones({
        axis: 'z',
        from: LEFT_TIER.minZ,
        to: LEFT_TIER.maxZ,
        faceAt: LEFT_TIER.maxX,
        height,
        seed: 21,
      })
    )
    out.push(
      ...wallStones({
        axis: 'x',
        from: LEFT_TIER.minX,
        to: LEFT_TIER.maxX,
        faceAt: LEFT_TIER.maxZ,
        height,
        seed: 33,
      })
    )
    return out
  }, [])

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <InstancedBlocks items={items} geometry={geometry} material={material} castShadow receiveShadow />
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

      <TierStones material={materials.stoneNarrow} />
      <Tufts materials={materials} />
      <ToyBlocks />
      <Trees materials={materials} />
    </group>
  )
}
