import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { RETURN_PADS, RETURN_PAD_RADIUS, chamberOrigin } from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { consumeInteract } from '../../systems/input.js'
import { playerPosition } from '../../systems/playerState.js'
import { fadeText, signOpacity } from '../../systems/signage.js'

/**
 * Cash-out pads at the end of a cleared level.
 *
 * Standing on one and pressing E banks every Win carried this run and walks you
 * back to the hub. They are the safe half of the decision the end of a chamber
 * poses: take what you have, or push through the gate and risk losing it all to
 * a level that is too strong.
 *
 * Stepping on a pad used to be enough on its own, which meant the single most
 * consequential move in a run - ending it - was something you could do by
 * walking across the wrong square on the way to the gate. It is a decision, so
 * it asks for a decision: the same "Press E" panel the hub uses for its
 * podiums, with the same key and the same tappable cap on a phone.
 */
export default function ReturnPads() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stageCleared = useGameStore((s) => s.stageCleared)
  const runWins = useGameStore((s) => s.runWins)
  const dead = useGameStore((s) => s.dead)

  const group = useRef()
  const padRefs = useRef([])
  const labelRefs = useRef([])
  const lastPrompt = useRef(null)
  const anim = useRef({ show: 0, phase: 0 })

  const materials = useMemo(
    () => ({
      base: new THREE.MeshStandardMaterial({ color: '#2f5fb8', roughness: 0.7 }),
      top: new THREE.MeshStandardMaterial({
        color: '#cfe9ff',
        emissive: '#7fc4ff',
        emissiveIntensity: 0.35,
        roughness: 0.5,
      }),
      // A little gold cup over the pad, so the offer reads at a glance before
      // any of the writing under it does.
      trophy: new THREE.MeshStandardMaterial({
        color: '#ffc93c',
        emissive: '#ff9e00',
        emissiveIntensity: 0.5,
        roughness: 0.45,
        flatShading: true,
      }),
    }),
    []
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  /** Raise or drop the call to action, but only when it actually changes. */
  const setPrompt = (prompt) => {
    if (prompt?.id === lastPrompt.current) return
    lastPrompt.current = prompt?.id ?? null
    emit(EVENTS.PROMPT, prompt)
  }

  // Nothing to offer once the pads are gone - and a prompt left up would
  // otherwise follow you through the gate into the next level.
  useEffect(() => () => emit(EVENTS.PROMPT, null), [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    /*
     * Drained every frame whether or not it is wanted. A press held in the
     * queue from somewhere else in the level would otherwise bank the run the
     * instant you first set foot on a pad, which is the surprise this whole
     * change exists to remove.
     */
    const interacted = consumeInteract()

    const target = stageCleared && !dead ? 1 : 0
    a.show += (target - a.show) * Math.min(1, delta * 5)

    if (group.current) {
      group.current.visible = a.show > 0.02
      group.current.scale.setScalar(Math.max(0.001, a.show))
    }
    padRefs.current.forEach((pad, i) => {
      if (pad) pad.position.y = 0.26 + Math.sin(a.phase * 2.2 + i) * 0.05
    })

    if (!stageCleared || dead) {
      setPrompt(null)
      return
    }

    // Nearest pad wins; both do the same thing.
    const origin = chamberOrigin(stageIndex)
    let inside = false

    const distances = RETURN_PADS.map((pad) =>
      Math.hypot(
        playerPosition.x - pad.position[0],
        playerPosition.z - (origin + pad.position[2])
      )
    )
    inside = distances.some((distance) => distance <= RETURN_PAD_RADIUS)

    /*
     * Only the nearer pad speaks. The two offer the identical deal and stand
     * either side of the exit, so labelling both wrote "+7 Wins / Return"
     * twice across the middle of the screen - and from anywhere between them
     * they are the same distance away, so both were always at full volume.
     */
    const nearest = distances.indexOf(Math.min(...distances))
    RETURN_PADS.forEach((_, i) => {
      const shown = i === nearest ? signOpacity(distances[i]) * a.show : 0
      fadeText(labelRefs.current[i * 2], shown)
      fadeText(labelRefs.current[i * 2 + 1], shown)
    })

    setPrompt(
      inside
        ? {
            id: `return:${stageIndex}:${runWins}`,
            title: `Bank +${formatNumber(runWins)} Wins`,
            action: 'return to the hub',
            enabled: true,
          }
        : null
    )

    if (inside && interacted) useGameStore.getState().claimRunWins()
  })

  return (
    <group ref={group} visible={false} position={[0, 0, chamberOrigin(stageIndex)]}>
      {RETURN_PADS.map((pad, i) => (
        <group key={pad.id} position={pad.position}>
          <mesh material={materials.base} position={[0, 0.12, 0]} receiveShadow castShadow>
            <boxGeometry args={[RETURN_PAD_RADIUS * 2, 0.24, RETURN_PAD_RADIUS * 2]} />
          </mesh>
          <mesh
            ref={(el) => {
              padRefs.current[i] = el
            }}
            material={materials.top}
            position={[0, 0.26, 0]}
          >
            <boxGeometry args={[RETURN_PAD_RADIUS * 1.5, 0.12, RETURN_PAD_RADIUS * 1.5]} />
          </mesh>

          <Billboard position={[0, 2.2, 0]}>
            {/* Cup, stem and base - the same three boxes everything else in
                this world is built out of. */}
            <group position={[-1.02, 0.3, 0]}>
              <mesh material={materials.trophy} position={[0, 0.16, 0]}>
                <boxGeometry args={[0.34, 0.3, 0.18]} />
              </mesh>
              <mesh material={materials.trophy} position={[0, -0.06, 0]}>
                <boxGeometry args={[0.11, 0.14, 0.11]} />
              </mesh>
              <mesh material={materials.trophy} position={[0, -0.17, 0]}>
                <boxGeometry args={[0.3, 0.09, 0.16]} />
              </mesh>
            </group>

            <Text
              ref={(el) => {
                labelRefs.current[i * 2] = el
              }}
              position={[0.22, 0.3, 0]}
              fontSize={0.34}
              color="#ffd166"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.048}
              outlineColor="#12100e"
            >
              {`+${formatNumber(runWins)} Wins`}
            </Text>
            <Text
              ref={(el) => {
                labelRefs.current[i * 2 + 1] = el
              }}
              position={[0.22, -0.1, 0]}
              fontSize={0.26}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="#12100e"
            >
              Press E
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}
