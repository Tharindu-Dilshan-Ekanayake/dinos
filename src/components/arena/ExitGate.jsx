import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { ARENA, EXIT_GATE, GATE_TRIGGER_RADIUS, chamberOrigin } from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { MAX_STAGES, isBoss, recommendedDamage, requiredDamage } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { playerPosition } from '../../systems/playerState.js'

const WIDTH = ARENA.gapHalfWidth * 2
const HEIGHT = 5

/**
 * The way to the next level.
 *
 * Sealed by a barrier until the chamber's pack is down, then open to walk
 * through. The sign states what the level ahead demands *before* you step in,
 * and turns red when your damage is under that bar - because walking through
 * underpowered kills your dino rather than bouncing you back.
 */
export default function ExitGate() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stageCleared = useGameStore((s) => s.stageCleared)
  const clickPower = useGameStore((s) => s.clickPower)
  const dead = useGameStore((s) => s.dead)

  const barrierRef = useRef()
  const barrierMat = useRef()
  const glowRef = useRef()
  const triggered = useRef(false)
  const anim = useRef({ open: 0, pulse: 0 })

  const nextIndex = stageIndex + 1
  const atEnd = nextIndex >= MAX_STAGES
  const required = atEnd ? 0 : requiredDamage(nextIndex)
  const recommended = atEnd ? 0 : recommendedDamage(nextIndex)
  const survivable = atEnd || clickPower >= required
  const nextIsBoss = !atEnd && isBoss(nextIndex)

  // Re-arm the trigger whenever the level changes.
  useEffect(() => {
    triggered.current = false
  }, [stageIndex])

  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a3f35', roughness: 0.9 }),
    []
  )
  useEffect(() => () => frameMaterial.dispose(), [frameMaterial])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current

    // Slide the barrier down when the chamber clears, back up when it doesn't.
    const target = stageCleared ? 1 : 0
    a.open += (target - a.open) * Math.min(1, delta * 3.5)
    a.pulse += delta * 3

    if (barrierRef.current) {
      barrierRef.current.position.y = HEIGHT / 2 - a.open * HEIGHT
      barrierRef.current.visible = a.open < 0.98
    }
    if (barrierMat.current) {
      barrierMat.current.opacity = 0.55 + Math.sin(a.pulse) * 0.12
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = a.open * (0.35 + Math.sin(a.pulse * 1.4) * 0.12)
    }

    if (!stageCleared || dead || atEnd) return

    // Walking into the open gateway is what takes you through.
    const gateZ = chamberOrigin(stageIndex) + EXIT_GATE.position[2]
    const distance = Math.hypot(playerPosition.x - EXIT_GATE.position[0], playerPosition.z - gateZ)

    if (distance <= GATE_TRIGGER_RADIUS) {
      if (!triggered.current) {
        triggered.current = true
        useGameStore.getState().enterNextStage()
      }
    } else if (distance > GATE_TRIGGER_RADIUS + 1.5) {
      // Hysteresis: stepping away re-arms it without retriggering on the edge.
      triggered.current = false
    }
  })

  // Tell the HUD what this gate is offering.
  useEffect(() => {
    emit(EVENTS.GATE_PROMPT, {
      open: stageCleared,
      atEnd,
      stage: nextIndex + 1,
      required,
      recommended,
      survivable,
      boss: nextIsBoss,
    })
  }, [stageCleared, atEnd, nextIndex, required, recommended, survivable, nextIsBoss])

  const origin = chamberOrigin(stageIndex)
  const signColor = atEnd ? '#7cf7ff' : survivable ? '#7ee06a' : '#ff6b6b'

  return (
    <group position={[EXIT_GATE.position[0], EXIT_GATE.position[1], origin + EXIT_GATE.position[2]]}>
      {/* Posts and lintel */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={frameMaterial}
          position={[side * (ARENA.gapHalfWidth + 0.5), HEIGHT / 2, 0]}
          castShadow
        >
          <boxGeometry args={[1, HEIGHT, 1.4]} />
        </mesh>
      ))}
      <mesh material={frameMaterial} position={[0, HEIGHT + 0.4, 0]} castShadow>
        <boxGeometry args={[WIDTH + 2, 0.9, 1.6]} />
      </mesh>

      {/* Sealed barrier */}
      <mesh ref={barrierRef} position={[0, HEIGHT / 2, 0]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial
          ref={barrierMat}
          color={survivable ? '#ff8a5c' : '#ff3b5c'}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Ground glow once it opens */}
      <mesh ref={glowRef} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <planeGeometry args={[WIDTH, 3]} />
        <meshBasicMaterial
          color="#8affa0"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Sign */}
      <Text
        position={[0, HEIGHT - 0.55, 0.9]}
        fontSize={0.62}
        color={signColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#12100e"
      >
        {atEnd ? 'FINAL LEVEL' : `${nextIsBoss ? 'BOSS - ' : ''}STAGE ${nextIndex + 1}`}
      </Text>
      {!atEnd && (
        <Text
          position={[0, HEIGHT - 1.25, 0.9]}
          fontSize={0.38}
          color={signColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#12100e"
        >
          {survivable
            ? `NEEDS ${formatNumber(required)} DMG`
            : `DANGER - NEEDS ${formatNumber(required)} DMG`}
        </Text>
      )}
    </group>
  )
}
