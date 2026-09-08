import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  ARENA,
  EXIT_BARRIER_Z,
  EXIT_GATE,
  chamberOrigin,
} from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { MAX_STAGES, isBoss, recommendedDamage, requiredDamage } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { voxelMaterial } from '../../systems/voxelTexture.js'
import HeadlineText from '../HeadlineText.jsx'
import { DECAL } from '../../systems/decal.js'

const WIDTH = ARENA.gapHalfWidth * 2
/** Tall and slim, so the gateway reads from the far end of the chamber. */
const HEIGHT = 7.4
const PILLAR = 1.5

/** Shut, and holding you here. */
const LOCKED = new THREE.Color('#ff3b5c')
/**
 * Open, and letting you through.
 *
 * Barely a colour at all: glass with the daylight caught in it, not a blue
 * filter over the level ahead. A pane you can see the next chamber through is
 * an invitation; a blue one is a second wall behind the first.
 */
const UNLOCKED = new THREE.Color('#e4f4ff')

/*
 * A shut gate is a wall and reads like one. An open one has to thin right out,
 * or the level showing through the doorway - the whole reason the doorway is
 * there - is looked at through a sheet of blue.
 */
const SHUT_OPACITY = 0.44
const OPEN_OPACITY = 0.12

/** Half the barrier's thickness, so its lettering sits on the face. */
const FACE = 0.06

/**
 * The top of the plaque lettered across the barrier.
 *
 * High enough to clear a dino standing at the gate - about two thirds of the
 * way up the pane - and low enough that the whole block, name to number, is
 * still inside the opening rather than running off the top of it.
 */
const PLAQUE_TOP = HEIGHT * 0.62

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

  const nextIndex = stage + 1
  const atEnd = nextIndex >= MAX_STAGES
  const required = atEnd ? 0 : requiredDamage(nextIndex)
  const recommended = atEnd ? 0 : recommendedDamage(nextIndex)
  const survivable = atEnd || strongEnough
  const nextIsBoss = !atEnd && isBoss(nextIndex)

  const materials = useMemo(
    () => ({
      /*
       * Pale cast concrete, studded like a moulded brick.
       *
       * Dark standing stone read as one more outcrop in a world already made
       * of rock - the gateway disappeared into whichever cliff it happened to
       * be cut through. Poured grey belongs to nothing that grows: it is the
       * one built thing in the chamber, and it says so against sandstone,
       * basalt and ice alike.
       *
       * Repeated four times up its own height, so a stud on a seven-metre
       * pillar stays square instead of being stretched into a stripe.
       */
      pillar: voxelMaterial('#d9dcd4', {
        pattern: 'studs',
        cells: 4,
        variance: 0.05,
        fleckDepth: 0.14,
        repeat: [1, 4],
        seed: 197,
      }),
      cap: new THREE.MeshStandardMaterial({
        color: '#c3c7bd',
        roughness: 0.85,
        flatShading: true,
      }),
      // A warm lamp down the inner face of each pillar, the same colour the
      // waymarkers burn - one light in this world, not two.
      lamp: new THREE.MeshBasicMaterial({ color: '#ffd76b', toneMapped: false }),
    }),
    []
  )

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

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
        <mesh position={[0, HEIGHT / 2, 0]}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial
            color={sealed ? LOCKED : UNLOCKED}
            transparent
            opacity={sealed ? SHUT_OPACITY : OPEN_OPACITY}
            side={THREE.DoubleSide}
            depthWrite={false}
          {...DECAL}
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
              {/*
                Three sizes, not three colours: the level's name huge, what it
                asks of you small and grey-white under it, the number itself
                back up in gold. Read at a walk it is a headline with a price
                under it, which is the decision the gate is actually posing.

                "Recommended" and "Damage:" are two lines on purpose. Set on
                one they made a band of small type nearly as wide as the
                gateway, which fought the stage name above it for the eye;
                broken, the whole plaque sits inside the width of the number.
              */}
              <HeadlineText size={1.24} y={PLAQUE_TOP} color="#ffffff">
                {`Stage ${nextIndex + 1}`}
              </HeadlineText>
              <HeadlineText size={0.44} y={PLAQUE_TOP - 1.06} color="#f2f6ff">
                Recommended
              </HeadlineText>
              <HeadlineText size={0.44} y={PLAQUE_TOP - 1.58} color="#f2f6ff">
                Damage:
              </HeadlineText>
              {/*
                Gold, because it is the number you are being asked to have -
                and rose rather than gold when you do not have it yet. One
                glance at the colour is the whole survivability check.
              */}
              <HeadlineText
                size={0.92}
                y={PLAQUE_TOP - 2.44}
                color={survivable ? '#ffd23f' : '#ff9f9f'}
              >
                {formatNumber(recommended)}
              </HeadlineText>
            </group>
          ))}
      </group>
    </group>
  )
}
