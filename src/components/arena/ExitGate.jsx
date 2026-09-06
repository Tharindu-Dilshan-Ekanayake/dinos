import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ARENA,
  EXIT_BARRIER_Z,
  EXIT_GATE,
  PASSAGE_HALF_WIDTH,
  chamberOrigin,
} from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { MAX_STAGES, isBoss, recommendedDamage, requiredDamage } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import HeadlineText from '../HeadlineText.jsx'

const WIDTH = ARENA.gapHalfWidth * 2
/** Tall and slim, so the gateway reads from the far end of the chamber. */
const HEIGHT = 7.4
const PILLAR = 1.5

/** Shut, and holding you here. */
const LOCKED = new THREE.Color('#ff3b5c')
/** Open, and letting you through. */
const UNLOCKED = new THREE.Color('#3fa9ff')

/*
 * A shut gate is a wall and reads like one. An open one has to thin right out,
 * or the level showing through the doorway - the whole reason the doorway is
 * there - is looked at through a sheet of blue.
 */
const SHUT_OPACITY = 0.6
const OPEN_OPACITY = 0.2

/** Half the barrier's thickness, so its lettering sits on the face. */
const FACE = 0.06

/**
 * The way to the next level.
 *
 * Two pillars set into the middle of the wall the doorway is cut through, with
 * the barrier strung between them - red while the level holds it shut, blue
 * once it will let you through, and never gone. The level ahead and what it
 * asks for are lettered onto the barrier itself, because that is the thing you
 * walk up to; what is through the gate is announced by GateHeadline above
 * it, so the two are never stacked on top of each other in the frame.
 *
 * One of these stands in *every* mounted chamber, not only the one you are in,
 * and each one seals on its own chamber. Looking down the corridor you see the
 * levels ahead still shut and the ones behind you standing open, which is the
 * run laid out in front of you. `active` marks the chamber you are actually
 * standing in - it changes nothing about the gate itself, only which one talks
 * to the HUD.
 *
 * The gate is a door, not a trigger: crossing into the next level is
 * ArenaTravel's business, because the same doorway is how you come back.
 */
export default function ExitGate({ stage, active = true, sealed }) {
  // A boolean, not the number: this is a 3D component and re-reconciling it on
  // every click would be paid for in the frame budget.
  const strongEnough = useGameStore((s) => s.clickPower >= requiredDamage(stage + 1))

  const barrierRef = useRef()
  const barrierMat = useRef()
  const glowRef = useRef()
  const anim = useRef({ open: sealed ? 0 : 1, pulse: 0 })

  const nextIndex = stage + 1
  const atEnd = nextIndex >= MAX_STAGES
  const required = atEnd ? 0 : requiredDamage(nextIndex)
  const recommended = atEnd ? 0 : recommendedDamage(nextIndex)
  const survivable = atEnd || strongEnough
  const nextIsBoss = !atEnd && isBoss(nextIndex)

  const materials = useMemo(
    () => ({
      // Dark standing stone, so the pillars read as a made gateway against the
      // biome's own rock whatever colour that rock happens to be.
      pillar: voxelMaterial('#3c4353', {
        pattern: 'bricks',
        cells: 5,
        variance: 0.08,
        fleckDepth: 0.22,
        seed: 197,
      }),
      cap: new THREE.MeshStandardMaterial({
        color: '#59627a',
        roughness: 0.8,
        flatShading: true,
      }),
      // A warm lamp down the inner face of each pillar, the same colour the
      // waymarkers burn - one light in this world, not two.
      lamp: new THREE.MeshBasicMaterial({ color: '#ffd76b', toneMapped: false }),
    }),
    []
  )

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current

    // Each gate answers for its own chamber: shut until that level is down.
    const target = sealed ? 0 : 1
    a.open += (target - a.open) * Math.min(1, delta * 3.5)
    a.pulse += delta * 3

    /*
     * The barrier never leaves. It used to slide into the floor when a chamber
     * cleared, which took the gate's whole plaque with it - and a doorway that
     * empties out says nothing about where it goes. It stays lit across the
     * gateway and changes state instead: red while the level holds it shut,
     * blue once it will let you through.
     */
    if (barrierMat.current) {
      barrierMat.current.color.copy(LOCKED).lerp(UNLOCKED, a.open)
      // Red is a wall and pulses like one; blue is a door standing open, so it
      // thins out of the way of the level showing through it.
      barrierMat.current.opacity =
        SHUT_OPACITY +
        (OPEN_OPACITY - SHUT_OPACITY) * a.open +
        Math.sin(a.pulse) * 0.08 * (1 - a.open)
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = a.open * (0.35 + Math.sin(a.pulse * 1.4) * 0.12)
    }
  })

  // Tell the HUD what this gate is offering - the one in front of you only.
  useEffect(() => {
    if (!active) return
    emit(EVENTS.GATE_PROMPT, {
      open: !sealed,
      atEnd,
      stage: nextIndex + 1,
      required,
      recommended,
      survivable,
      boss: nextIsBoss,
    })
  }, [active, sealed, atEnd, nextIndex, required, recommended, survivable, nextIsBoss])

  const origin = chamberOrigin(stage)

  return (
    <group position={[EXIT_GATE.position[0], EXIT_GATE.position[1], origin]}>
      {/* Set into the wall: two pillars flanking the cut, no lintel - an arch
          across the top would sit right where the level ahead shows through. */}
      <group position-z={EXIT_GATE.position[2]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (ARENA.gapHalfWidth + PILLAR / 2), 0, 0]}>
            <mesh material={materials.pillar} position={[0, HEIGHT / 2, 0]} castShadow>
              <boxGeometry args={[PILLAR, HEIGHT, 1.6]} />
            </mesh>
            <mesh material={materials.cap} position={[0, HEIGHT + 0.22, 0]} castShadow>
              <boxGeometry args={[PILLAR + 0.42, 0.44, 2]} />
            </mesh>
            {/* A lamp facing into the gap, so the gateway is lit from both sides. */}
            <mesh
              material={materials.lamp}
              position={[side * -(PILLAR / 2 + 0.06), HEIGHT * 0.62, 0]}
            >
              <boxGeometry args={[0.12, 1.8, 1.1]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* The seal itself, hung between the towers rather than floating in
          front of them - the pillars and the light are one gate. */}
      <group position-z={EXIT_BARRIER_Z}>
        <mesh ref={barrierRef} position={[0, HEIGHT / 2, 0]}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial
            ref={barrierMat}
            color={LOCKED}
            transparent
            opacity={SHUT_OPACITY}
            side={THREE.DoubleSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>

        {/*
          The gate's own plaque, lettered onto the barrier.

          Painted on both faces rather than billboarded: it belongs to the door
          it is written on. You read it walking up to the gate, and again over
          your shoulder from the level beyond.
        */}
        {!atEnd &&
          [1, -1].map((facing) => (
            <group
              key={facing}
              position-z={facing * FACE}
              rotation-y={facing > 0 ? 0 : Math.PI}
            >
              <HeadlineText size={0.98} y={HEIGHT * 0.58} color="#ffffff">
                {`Stage ${nextIndex + 1}`}
              </HeadlineText>
              <HeadlineText size={0.34} y={HEIGHT * 0.58 - 0.86} color="#e6ecff">
                Recommended Damage
              </HeadlineText>
              <HeadlineText
                size={0.74}
                y={HEIGHT * 0.58 - 1.66}
                color={survivable ? '#7ee06a' : '#ff9f9f'}
              >
                {formatNumber(recommended)}
              </HeadlineText>
            </group>
          ))}

        {/* Ground glow once it opens */}
        <mesh ref={glowRef} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
          <planeGeometry args={[PASSAGE_HALF_WIDTH * 2, 3]} />
          <meshBasicMaterial
            color="#8affa0"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}
