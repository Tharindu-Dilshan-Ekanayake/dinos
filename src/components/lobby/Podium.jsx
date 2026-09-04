import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { EVOLUTIONS } from '../../data/evolutions.js'
import { formatNumber } from '../../data/progression.js'
import { INTERACT_RADIUS } from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'
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
   * A locked tier shows the same silhouette in stone grey rather than its real
   * colours - you can see what you are working toward without it being
   * mistaken for something you already own.
   */
  const display = useMemo(
    () =>
      unlocked
        ? evolution
        : {
            ...evolution,
            body: '#39414f',
            belly: '#4b5563',
            spike: '#5b6472',
          },
    [unlocked, evolution]
  )
  const materials = useDinoMaterials(display)

  const spinner = useRef()
  const rig = useDinoRig()
  const padRef = useRef()
  const glowRef = useRef()
  const anim = useRef({ near: 0, phase: Math.random() * 6 })

  const padMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: unlocked ? evolution.aura : '#4b5563',
        roughness: 0.55,
        flatShading: true,
      }),
    [unlocked, evolution.aura]
  )

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: unlocked ? '#e7ecf3' : '#5b6472',
        roughness: 0.85,
        flatShading: true,
      }),
    [unlocked]
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
      spinner.current.rotation.y += delta * (0.55 + a.near * 1.4)
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

      {/* The tier's dino, turning on the spot */}
      <group ref={spinner} position={[0, 1.1, 0]} scale={evolution.scale * 0.62}>
        <DinoModel evolution={display} materials={materials} rig={rig} />
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
          {`x${formatNumber(evolution.power)} Damage`}
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
