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
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'

const E = ARENA_ENTRANCE
const WALL_CENTRE_X = E.gapHalfWidth + E.wallWidth / 2
const WALL_LENGTH = E.wallFromZ - E.wallToZ
const WALL_MID_Z = (E.wallFromZ + E.wallToZ) / 2

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
    out.push({ position: [x, terrace[2], z], scale: 0.8 + rand() * 0.9 })
  }
  return out
})()

/**
 * The way out of the hub.
 *
 * A carpeted staircase climbing between two tall retaining walls, with the
 * arena past the top. Walking up it is the transition - no button - and the
 * sign overhead says whether the level ahead is ready for you.
 *
 * The stair geometry here mirrors `stairHeightAt` in data/lobby.js, which is
 * what the player controller walks on, so the visible steps and the surface
 * underfoot can never drift apart.
 */
export default function ArenaGate() {
  const enterArena = useGameStore((s) => s.enterArena)
  const bestStage = useGameStore((s) => s.bestStage)

  const carpetGlow = useRef()
  const anim = useRef({ near: 0, phase: 0, armed: false })

  const materials = useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.95, flatShading: true }),
      wallDark: new THREE.MeshStandardMaterial({ color: '#79828d', roughness: 0.95 }),
      wallCap: new THREE.MeshStandardMaterial({ color: '#68707a', roughness: 0.9 }),
      stone: new THREE.MeshStandardMaterial({ color: '#c9d1d9', roughness: 0.92 }),
      carpet: new THREE.MeshStandardMaterial({ color: '#f2799f', roughness: 0.75 }),
      grass: new THREE.MeshStandardMaterial({ color: LOBBY_PALETTE.grass, roughness: 0.95 }),
      trunk: new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.95 }),
      leaves: new THREE.MeshStandardMaterial({
        color: '#4faa39',
        roughness: 0.9,
        flatShading: true,
      }),
    }),
    []
  )

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  // Steps are laid out once; both the tread and its carpet come from here.
  const steps = useMemo(
    () =>
      Array.from({ length: E.stepCount }, (_, i) => ({
        z: E.stepFromZ - i * E.stepRun - E.stepRun / 2,
        height: (i + 1) * E.stepRise,
      })),
    []
  )

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
          {/* Darker band along the inner face reads as a shadowed edge. */}
          <mesh
            material={materials.wallDark}
            position={[-side * (E.wallWidth / 2 - 0.15), E.wallHeight / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.4, E.wallHeight, WALL_LENGTH * 0.995]} />
          </mesh>
          <mesh material={materials.wallCap} position={[0, E.wallHeight + 0.25, 0]} castShadow>
            <boxGeometry args={[E.wallWidth + 0.5, 0.5, WALL_LENGTH + 0.5]} />
          </mesh>
        </group>
      ))}

      {/* Grass shoulders running up to the walls */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={materials.grass}
          position={[side * (WALL_CENTRE_X + E.wallWidth / 2 + 6), E.shoulderHeight / 2, WALL_MID_Z]}
          receiveShadow
        >
          <boxGeometry args={[12, E.shoulderHeight, WALL_LENGTH + 6]} />
        </mesh>
      ))}

      {/* Staircase: a stone tread with a carpet runner down the middle */}
      {steps.map((step, i) => (
        <group key={i} position={[0, 0, step.z]}>
          <mesh material={materials.stone} position={[0, step.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[E.gapHalfWidth * 2, step.height, E.stepRun]} />
          </mesh>
          {/* Tread runner */}
          <mesh
            material={materials.carpet}
            position={[0, step.height + 0.03, 0]}
            rotation-x={-Math.PI / 2}
            receiveShadow
          >
            <planeGeometry args={[E.gapHalfWidth * 1.6, E.stepRun]} />
          </mesh>
          {/* Riser, so the carpet flows down the stairs as one runner. */}
          <mesh
            material={materials.carpet}
            position={[0, step.height - E.stepRise / 2, E.stepRun / 2 + 0.03]}
            receiveShadow
          >
            <planeGeometry args={[E.gapHalfWidth * 1.6, E.stepRise]} />
          </mesh>
        </group>
      ))}

      {/* Landing at the top, disappearing into the fog */}
      <mesh
        material={materials.carpet}
        position={[0, E.stepCount * E.stepRise + 0.03, ARENA_STAIR_TOP_Z - 5]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry args={[E.gapHalfWidth * 1.6, 10]} />
      </mesh>

      {/*
        Scenery past the top of the stairs. Without it the gap between the
        walls frames nothing but empty sky, and the climb reads as a dead end
        rather than somewhere you are going.
      */}
      <group position={[0, E.stepCount * E.stepRise, ARENA_STAIR_TOP_Z]}>
        {/* Flat landing, then two terraces climbing to fill the opening. */}
        <mesh material={materials.grass} position={[0, -0.6, -5]} receiveShadow>
          <boxGeometry args={[80, 1.2, 12]} />
        </mesh>
        <mesh material={materials.grass} position={[0, 1, -16]} receiveShadow castShadow>
          <boxGeometry args={[80, 3.4, 12]} />
        </mesh>
        <mesh material={materials.grass} position={[0, 3.6, -28]} receiveShadow castShadow>
          <boxGeometry args={[80, 8, 16]} />
        </mesh>
        {BEYOND_TREES.map((tree, i) => (
          <group key={i} position={tree.position} scale={tree.scale}>
            <mesh material={materials.trunk} position={[0, 1, 0]} castShadow>
              <boxGeometry args={[0.6, 2, 0.6]} />
            </mesh>
            <mesh material={materials.leaves} position={[0, 3.1, 0]} castShadow>
              <boxGeometry args={[3, 2.2, 3]} />
            </mesh>
            <mesh material={materials.leaves} position={[0, 4.8, 0]} castShadow>
              <boxGeometry args={[2, 1.6, 2]} />
            </mesh>
          </group>
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
