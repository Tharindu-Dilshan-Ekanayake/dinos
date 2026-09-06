import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import Text from '../SceneText.jsx'
import * as THREE from 'three'
import { EVOLUTIONS } from '../../data/evolutions.js'
import { formatNumber } from '../../data/progression.js'
import {
  INTERACT_RADIUS,
  DINO_CENTRE_OFFSET,
  PODIUM_DINO_SCALE,
} from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import DinoModel, { animateDinoRig, useDinoMaterials, useDinoRig } from '../DinoModel.jsx'

/**
 * One evolution podium: a pad, the tier's dino turning on top, and a sign
 * showing its damage and unlock cost.
 *
 * Locked tiers render desaturated and dark; the pad lights up and lifts when
 * the player walks into range. Both of those are driven from useFrame against
 * the shared player position, so walking past a row of eight podiums costs no
 * React renders at all.
 */
export default function Podium({ podium }) {
  const evolution = EVOLUTIONS[podium.evolutionIndex]

  // Only re-renders when the player's progress actually changes state here.
  const unlocked = useGameStore((s) => podium.evolutionIndex <= s.unlockedIndex)
  const equipped = useGameStore((s) => podium.evolutionIndex === s.equippedIndex)
  const totalWins = useGameStore((s) => s.totalWins)
  const equip = useGameStore((s) => s.equipEvolution)

  /*
   * A locked tier is shown in its own colours.
   *
   * It used to be repainted stone grey, which made the far half of the gallery
   * a row of identical silhouettes - exactly the thing you are meant to be
   * working toward, rendered as the one thing that tells you nothing. What is
   * locked is said by the sign under it and by the dark, unlit pad it stands
   * on; the animal itself is the advertisement.
   */
  const materials = useDinoMaterials(evolution)

  const spinner = useRef()
  const rig = useDinoRig()
  const padRef = useRef()
  const glowRef = useRef()
  const anim = useRef({ near: 0, phase: Math.random() * 6 })

  /*
   * The pad is what carries the lock instead: lit in the tier's own aura when
   * it is yours, and a dark unlit slab when it is not.
   */
  const padMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: unlocked ? evolution.aura : '#3a4152',
        roughness: 0.55,
        flatShading: true,
      }),
    [unlocked, evolution.aura]
  )

  // Coursed stone, so a podium is built out of the same blocks as the hub it
  // stands in rather than being a smooth pedestal dropped into it.
  const baseMaterial = useMemo(
    () =>
      voxelMaterial(unlocked ? '#e7ecf3' : '#5b6472', {
        pattern: 'bricks',
        cells: 4,
        variance: 0.07,
        fleckDepth: 0.16,
        repeat: [2, 1],
        roughness: 0.85,
        seed: 61,
      }),
    [unlocked]
  )

  // The pad's own material is disposed with the podium; the base's map lives
  // in the shared texture cache and outlives it.
  useEffect(
    () => () => {
      padMaterial.dispose()
      baseMaterial.dispose()
    },
    [padMaterial, baseMaterial]
  )

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    const dx = playerPosition.x - podium.position[0]
    const dz = playerPosition.z - podium.position[2]
    const inRange = dx * dx + dz * dz < INTERACT_RADIUS * INTERACT_RADIUS

    // Ease the highlight so walking past a podium pulses rather than snaps.
    a.near += ((inRange ? 1 : 0) - a.near) * Math.min(1, delta * 9)

    if (spinner.current) {
      /*
       * It no longer turns. A gallery is a row of animals facing the path you
       * walk down - turning them meant every one was showing you its flank or
       * its tail half the time, and the circle a spinning dino needs is what
       * kept them small enough to fit between their neighbours.
       */
      spinner.current.position.y = 1.1 + Math.sin(a.phase * 1.5) * 0.09 + a.near * 0.18
    }

    // Showcase dinos walk on the spot, faster once you step up to them.
    animateDinoRig(rig.current, 0.32 + a.near * 0.5, a.phase * (3.4 + a.near * 3))
    if (padRef.current) {
      padRef.current.scale.setScalar(1 + a.near * 0.06)
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = (unlocked ? 0.22 : 0.08) + a.near * 0.4
      glowRef.current.rotation.z += delta * 0.4
    }
  })

  const status = equipped ? 'EQUIPPED' : unlocked ? 'TAP TO EQUIP' : 'LOCKED'
  const statusColor = equipped ? '#86efac' : unlocked ? '#fde68a' : '#94a3b8'
  const remaining = Math.max(0, evolution.unlockAtWins - totalWins)

  return (
    <group
      name="Podium"
      position={podium.position}
      // onClick, not onPointerDown: a mouse drag that starts here is the
      // camera orbit, and must not also trigger the prop.
      onClick={(e) => {
        e.stopPropagation()
        equip(podium.evolutionIndex)
      }}
    >
      {/* Base block */}
      <mesh material={baseMaterial} position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.7, 3.2]} />
      </mesh>
      {/* Coloured top pad */}
      <mesh ref={padRef} material={padMaterial} position={[0, 0.78, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.2, 2.8]} />
      </mesh>

      {/* Ground glow ring that brightens as you approach */}
      <mesh ref={glowRef} position={[0, 0.9, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.5, 1.95, 24]} />
        <meshBasicMaterial
          color={unlocked ? evolution.aura : '#94a3b8'}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* The tier's dino, facing the walkway. Always drawn: the gallery is the
          reason to walk down this row, and a podium whose dino fades out as you
          approach the far end of it is a worse game, not a faster one. */}
      <group ref={spinner} position={[0, 1.1, 0]} scale={evolution.scale * PODIUM_DINO_SCALE}>
        {/*
          Offset so the axis runs through the animal's middle rather than its
          hip. The tail is nearly three times as long as the snout, so turned
          about the hip the dino orbited its pedestal instead of standing on
          it - and needed a third more room to do it.
        */}
        <group position={[DINO_CENTRE_OFFSET, 0, 0]}>
          <DinoModel evolution={evolution} materials={materials} rig={rig} />
        </group>
      </group>

      {/* Sign */}
      <Billboard position={[0, 4.1, 0]}>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[2.5, 1.08]} />
          <meshBasicMaterial color="#0b1220" transparent opacity={0.8} fog={false} />
        </mesh>

        <Text
          position={[0, 0.33, 0]}
          fontSize={0.23}
          color={unlocked ? evolution.aura : '#cbd5e1'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#0b1220"
          maxWidth={2.35}
        >
          {evolution.name}
        </Text>

        <Text
          position={[0, 0.02, 0]}
          fontSize={0.19}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#0b1220"
        >
          {`+${formatNumber(evolution.power)} Damage / click`}
        </Text>

        <Text
          position={[0, -0.3, 0]}
          fontSize={0.155}
          color={statusColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.016}
          outlineColor="#0b1220"
        >
          {unlocked ? status : `${formatNumber(remaining)} more wins`}
        </Text>
      </Billboard>
    </group>
  )
}
