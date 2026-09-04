import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  ARENA_ENTRANCE,
  LEFT_STAIRS,
  LEFT_TIER,
  LOBBY_PALETTE,
  PLAZA,
  TERRACES,
  treeLayout,
} from '../../data/lobby.js'

/**
 * The hub's terrain: a checkered stone concourse, bright grass lanes either
 * side, the raised left tier and its stairs, grass terraces stepping up to a
 * timber fence, and blocky pines behind it.
 *
 * Everything is flat-shaded boxes on a handful of shared materials, and the
 * concourse tiling is one texture rather than thousands of tile meshes - so
 * the whole environment stays around thirty draw calls and runs on a phone.
 */

/** Procedural checker, drawn once into a canvas. Cheaper than tile meshes. */
function makeCheckerTexture(light, dark, size = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = light
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = dark
  ctx.fillRect(0, 0, size / 2, size / 2)
  ctx.fillRect(size / 2, size / 2, size / 2, size / 2)

  // A soft grout line keeps the tiling readable from a distance.
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, size / 2, size / 2)
  ctx.strokeRect(size / 2, size / 2, size / 2, size / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function useLobbyMaterials() {
  const bundle = useMemo(() => {
    const make = (color, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra })

    const checker = makeCheckerTexture('#e6ebf2', '#c3ccd8')
    checker.repeat.set(PLAZA.halfWidth, (PLAZA.from - PLAZA.to) / 2)

    const laneChecker = makeCheckerTexture('#79d45f', '#5fbb46')
    laneChecker.repeat.set(4, (PLAZA.from - PLAZA.to) / 2)

    return {
      grass: make(LOBBY_PALETTE.grass),
      grassMid: make('#54ad3e'),
      grassDark: make(LOBBY_PALETTE.grassDark),
      grassTop: make('#6fca52'),
      tier: make('#aeb8c6'),
      tierTop: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      concourse: new THREE.MeshStandardMaterial({ map: checker, roughness: 0.9 }),
      tierSurface: new THREE.MeshStandardMaterial({ map: checker, roughness: 0.9 }),
      lane: new THREE.MeshStandardMaterial({ map: laneChecker, roughness: 0.95 }),
      kerb: make(LOBBY_PALETTE.pathEdge),
      post: make('#a9713f'),
      rail: make('#c98a4b'),
      trunk: make('#7a5230'),
      leaf: make('#48b356'),
      leafMid: make('#3a9c48'),
      leafDark: make('#2f7d3b'),
      textures: [checker, laneChecker],
    }
  }, [])

  useEffect(
    () => () => {
      bundle.textures.forEach((t) => t.dispose())
      Object.values(bundle).forEach((m) => {
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

/** Blocky pine: a trunk with three shrinking canopy blocks. */
function Trees({ materials }) {
  const trees = useMemo(() => treeLayout(46), [])
  const trunk = useMemo(() => new THREE.BoxGeometry(0.55, 1.8, 0.55), [])
  const tier = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useEffect(
    () => () => {
      trunk.dispose()
      tier.dispose()
    },
    [trunk, tier]
  )

  return (
    <group>
      {trees.map((tree, i) => (
        <group
          key={i}
          position={[tree.position[0], tree.terraceHeight ?? 0, tree.position[2]]}
          rotation-y={tree.rotation}
          scale={tree.scale}
        >
          <mesh geometry={trunk} material={materials.trunk} position={[0, 0.9, 0]} castShadow />
          <mesh
            geometry={tier}
            material={materials.leafDark}
            position={[0, 2.3, 0]}
            scale={[2.6, 1.3, 2.6]}
            castShadow
          />
          <mesh
            geometry={tier}
            material={materials.leafMid}
            position={[0, 3.4, 0]}
            scale={[2, 1.1, 2]}
            castShadow
          />
          <mesh
            geometry={tier}
            material={materials.leaf}
            position={[0, 4.35, 0]}
            scale={[1.25, 0.95, 1.25]}
            castShadow
          />
        </group>
      ))}
    </group>
  )
}

export default function LobbyGround() {
  const materials = useLobbyMaterials()

  const length = PLAZA.from - PLAZA.to
  const centreZ = (PLAZA.from + PLAZA.to) / 2
  const half = PLAZA.halfWidth
  const walk = PLAZA.walkwayHalfWidth
  const y = PLAZA.pathHeight

  // Terrace geometry comes from the layout data so the tree scatter and the
  // steps they stand on can never drift apart.
  const terraceMaterials = ['grass', 'grassMid', 'grassDark']

  return (
    <group>
      {/* Base grass field under everything */}
      <mesh material={materials.grassTop} position={[0, -0.4, centreZ]} receiveShadow>
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
            material={materials[terraceMaterials[i % terraceMaterials.length]]}
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
        material={materials.tier}
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
        const height = ((i + 1) / LEFT_STAIRS.steps) * LEFT_TIER.height
        // Step 0 is the top one, nearest the tier edge.
        const z = LEFT_STAIRS.fromZ + depth * (i + 0.5)
        return (
          <mesh
            key={i}
            material={materials.tier}
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
        material={materials.grassMid}
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

      <Trees materials={materials} />
    </group>
  )
}
