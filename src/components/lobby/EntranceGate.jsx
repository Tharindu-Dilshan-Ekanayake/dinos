import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ARENA_ENTRANCE, ARENA_RAMP_TOP_Z } from '../../data/lobby.js'
import { formatNumber } from '../../data/progression.js'
import { recommendedDamage } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { DECAL } from '../../systems/decal.js'
import HeadlineText from '../HeadlineText.jsx'
import MergedBoxes, { mergeBoxes } from '../MergedBoxes.jsx'

/**
 * The gate at the hub's end of the gateway.
 *
 * Every doorway between levels in the arena is a pair of pillars with a lit
 * barrier strung between them, carrying the level's number and what it wants
 * from you. The one doorway that had none was the first: walking out of the hub
 * into Stage 1 was walking through a gap in a wall.
 *
 * So this is the arena's gate, built at the hub's mouth and reading the same
 * way - except that it is never shut. Stage 1 has no entry bar, and a barrier
 * that is always blue is not a lock: it is a *threshold*, which is the thing
 * worth marking. The number on it is the same recommendation every other gate
 * shows, so the first door in the game teaches you how to read the rest.
 */

const E = ARENA_ENTRANCE

/** How tall the gate stands, and how thick its pillars are. */
const HEIGHT = 8.4
const PILLAR = 1.5

/** Where it stands: at the top of the walkway, where the arena takes over. */
const GATE_Z = ARENA_RAMP_TOP_Z + 2.2

/** Half the barrier's thickness, so its lettering sits clear of the face. */
const FACE = 0.08

/** The barrier's own blue. Nothing here is ever locked, so there is no red. */
const OPEN = new THREE.Color('#4cc9f0')

const FRAME = mergeBoxes([
  ...[-1, 1].flatMap((side) => [
    {
      material: 'pillar',
      position: [side * (E.gapHalfWidth + PILLAR / 2), HEIGHT / 2, 0],
      size: [PILLAR, HEIGHT, 1.8],
      shadow: true,
    },
    {
      material: 'cap',
      position: [side * (E.gapHalfWidth + PILLAR / 2), HEIGHT + 0.24, 0],
      size: [PILLAR + 0.5, 0.48, 2.2],
      shadow: true,
    },
    // A lamp facing into the gap, so the gateway is lit from both sides.
    {
      material: 'lamp',
      position: [side * E.gapHalfWidth - side * 0.06, HEIGHT * 0.6, 0],
      size: [0.14, 2, 1.2],
    },
  ]),

  /*
   * A lintel across the top, which the arena's gates deliberately do without -
   * there, an arch would sit exactly where the next level shows through. Here
   * there is no level to frame, only the hub behind you, so the doorway can be
   * a doorway.
   */
  { material: 'cap', position: [0, HEIGHT + 0.24, 0], size: [E.gapHalfWidth * 2, 0.7, 2], shadow: true },
])

export default function EntranceGate() {
  const bestStage = useGameStore((s) => s.bestStage)
  const barrier = useRef()
  const barrierMat = useRef()

  const materials = useMemo(
    () => ({
      // Sandy stone, matching ArenaGate's retaining walls and HubApproach, so
      // the whole gateway reads as one structure from either side of the seam.
      pillar: new THREE.MeshStandardMaterial({ color: '#cfc7a6', roughness: 0.75, flatShading: true }),
      cap: new THREE.MeshStandardMaterial({ color: '#b5ad8c', roughness: 0.7, flatShading: true }),
      lamp: new THREE.MeshStandardMaterial({
        color: '#4cc9f0',
        roughness: 0.35,
        flatShading: true,
        emissive: OPEN,
        emissiveIntensity: 1.1,
        toneMapped: false,
      }),
    }),
    []
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useFrame((state) => {
    // A slow breath, so the threshold reads as powered rather than painted.
    const t = state.clock.elapsedTime
    if (barrierMat.current) barrierMat.current.opacity = 0.2 + Math.sin(t * 1.8) * 0.06
    materials.lamp.emissiveIntensity = 0.9 + Math.sin(t * 1.8) * 0.3
  })

  return (
    <group position={[0, 0, GATE_Z]}>
      <MergedBoxes groups={FRAME} materials={materials} />

      {/* The threshold itself, hung between the pillars. */}
      <mesh ref={barrier} position={[0, HEIGHT / 2, 0]}>
        <planeGeometry args={[E.gapHalfWidth * 2, HEIGHT]} />
        <meshBasicMaterial
          ref={barrierMat}
          color={OPEN}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
          {...DECAL}
          fog={false}
        />
      </mesh>

      {/*
        Lettered onto the barrier on both faces rather than billboarded: it
        belongs to the door it is written on. You read it walking up to the
        gate, and again over your shoulder on the way back out.
      */}
      {[1, -1].map((facing) => (
        <group key={facing} position-z={facing * FACE} rotation-y={facing > 0 ? 0 : Math.PI}>
          <HeadlineText size={0.92} y={HEIGHT * 0.6} color="#ffffff" shadow="#12100e">
            Stage 1
          </HeadlineText>
          <HeadlineText size={0.32} y={HEIGHT * 0.6 - 0.82} color="#e6ecff" shadow="#12100e">
            Recommended Damage
          </HeadlineText>
          <HeadlineText size={0.7} y={HEIGHT * 0.6 - 1.58} color="#7ee06a" shadow="#12100e">
            {formatNumber(recommendedDamage(0))}
          </HeadlineText>
          <HeadlineText size={0.3} y={HEIGHT * 0.6 - 2.36} color="#ffe9f0" shadow="#12100e">
            {`Best so far: Stage ${bestStage + 1}`}
          </HeadlineText>
        </group>
      ))}
    </group>
  )
}
