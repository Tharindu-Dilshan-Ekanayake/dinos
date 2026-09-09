import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ARENA_ENTRANCE, ARENA_THRESHOLD_Z } from '../../data/lobby.js'
import { LOBBY_Z_OFFSET } from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { recommendedDamage } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import { DECAL } from '../../systems/decal.js'
import { flatToonMaterial } from '../../systems/voxelTexture.js'
import GlowSprite from '../GlowSprite.jsx'
import HeadlineText from '../HeadlineText.jsx'
import PortalParticles from './PortalParticles.jsx'
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

/**
 * How tall the gate stands: the full height of the walls it hangs between.
 *
 * Tied to them rather than to a number of its own, so raising the gateway
 * raises the pane in it and the two can never come apart.
 */
const HEIGHT = E.wallHeight

/**
 * Where it stands: half way along the two big walls, not in front of them.
 *
 * It used to be a free-standing arch of its own two metres short of the
 * gateway - its own pillars, its own cap, its own lintel - which put *two*
 * doorways on the same path: a little stone one you walked through, and then
 * the real slot between the retaining walls with nothing in it. The eye read
 * the arch as the entrance and the walls as scenery, and the actual threshold
 * (the line that hands you to the arena) was neither of them.
 *
 * Set into the middle of the wall run there is one doorway. The walls are its
 * jambs, the pane between them is the threshold, and the lettering is on the
 * thing you actually walk through.
 *
 * The number lives in the layout because the handoff to the arena reads it too
 * - see ARENA_THRESHOLD_Z. A pane in one place and a scene change in another
 * is the one way this can go wrong.
 */
const GATE_Z = ARENA_THRESHOLD_Z

/** Half the barrier's thickness, so its lettering sits clear of the face. */
const FACE = 0.08

/**
 * The plaque lettered across the pane.
 *
 * Same block, same sizes, same gaps and same order as every gate in the arena -
 * name, what it asks for, the figure in gold - because this is the door that
 * teaches you to read those, and a first door lettered to its own scale teaches
 * the wrong thing. The numbers are the ones measured off the reference art; see
 * ExitGate, which sets them for the doorways this one is a rehearsal for.
 */
const PLAQUE_TOP = HEIGHT * 0.62
const NAME_SIZE = 1.7
const ASK_SIZE = NAME_SIZE * 0.36
const FIGURE_SIZE = NAME_SIZE * 0.62

/** The barrier's own blue. Nothing here is ever locked, so there is no red. */
const OPEN = new THREE.Color('#4cc9f0')

/*
 * All that is left of the frame: a lit strip down the inner face of each wall.
 *
 * The pillars and the lintel went with the arch - the walls are doing that job
 * now, and a stone post standing against a stone wall is just a lump on it.
 * The lamps stay because they are the one part that was never structural: they
 * are what tells you the slot is powered rather than empty, and they now light
 * the wall faces they are set into.
 */
const FRAME = mergeBoxes(
  [-1, 1].map((side) => ({
    material: 'lamp',
    position: [side * E.gapHalfWidth - side * 0.06, HEIGHT * 0.55, 0],
    size: [0.14, HEIGHT * 0.5, 1.2],
  }))
)

/**
 * Distance at which the plaque reaches its full, as-authored size.
 *
 * The name and its figures are sized to read from across the plaza, which is
 * exactly what makes them absurd close up: walk to the threshold to actually
 * cross it and the camera closes in with you, blowing a sign meant to fill a
 * doorway from a distance into a wall of oversized, overlapping letters.
 *
 * Rather than hide it - a sign that vanishes right where you need it most is
 * its own kind of broken - it shrinks in step with the distance closing, which
 * cancels out the perspective growth that caused the problem: from here out
 * to the plaza it reads at its normal size, and every step closer than that
 * scales it down by exactly as much as walking closer would otherwise have
 * blown it up. It never disappears; it just stops getting bigger.
 */
const NORMAL_SIZE_DISTANCE = 16

export default function EntranceGate() {
  const bestStage = useGameStore((s) => s.bestStage)
  const barrier = useRef()
  const barrierMat = useRef()
  const glow = useRef()
  const plaque = useRef()
  const faces = useRef([])

  const materials = useMemo(
    () => ({
      // `toneMapped: false` keeps this reading as a light source rather than
      // a lit surface - it skips the display's tone-mapping curve entirely,
      // which is the same trick a real bloom pass earns from a threshold
      // filter, done here for one glowing shape instead of the whole frame.
      lamp: flatToonMaterial('#4cc9f0', {
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
    // The same breath as the barrier and the lamps, so the whole threshold
    // reads as one powered thing rather than three independently animated
    // parts that happen to share a rhythm.
    if (glow.current) glow.current.scale.setScalar(6 + Math.sin(t * 1.8) * 0.4)

    // Distance from the *camera*, not the dino: it is the camera's closing in
    // that grows the sign, so that is what the shrink has to track. World
    // space, not `playerPosition` - that reads hub-local while you are in the
    // hub and arena-local once you cross into it (see playerWorld.js).
    const gateWorldZ = GATE_Z + LOBBY_Z_OFFSET

    if (plaque.current) {
      const camDistance = Math.abs(state.camera.position.z - gateWorldZ)
      const scale = Math.max(0.08, Math.min(1, camDistance / NORMAL_SIZE_DISTANCE))
      plaque.current.scale.setScalar(scale)
    }

    // Only the face pointed at the camera, not both at once: a translucent
    // barrier with type painted on each side shows the far face straight
    // through the near one, so standing on one side used to double-expose
    // its lettering over the reading you actually want.
    const towardCamera = Math.sign(state.camera.position.z - gateWorldZ) || 1
    for (const face of faces.current) {
      if (face) face.visible = face.userData.facing === towardCamera
    }
  })

  return (
    <group position={[0, 0, GATE_Z]}>
      <MergedBoxes groups={FRAME} materials={materials} />

      {/* A soft haze filling the doorway - the fake-bloom halo for the whole
          threshold, not just one lamp. See components/GlowSprite.jsx. */}
      <GlowSprite ref={glow} color="#8fe3ff" size={6} position={[0, HEIGHT * 0.42, 0]} />

      {/* Motes drifting up through the doorway - see PortalParticles.jsx. */}
      <PortalParticles color="#bdf0ff" />

      {/* The threshold itself, hung between the two walls. */}
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

        Scaled down inside `NORMAL_SIZE_DISTANCE`, not hidden: this plaque is
        sized to be read from across the plaza, so walking under it without
        some counter-shrink would blow it up into a wall of oversized letters
        a few centimetres from the camera. It stays up the whole time, just
        never bigger on screen than it already was at a normal reading
        distance.
      */}
      <group ref={plaque}>
        {[1, -1].map((facing, i) => (
          <group
            key={facing}
            ref={(el) => {
              faces.current[i] = el
              if (el) el.userData.facing = facing
            }}
            position-z={facing * FACE}
            rotation-y={facing > 0 ? 0 : Math.PI}
          >
            <HeadlineText size={NAME_SIZE} y={PLAQUE_TOP} color="#ffffff" shadow="#12100e">
              Stage 1
            </HeadlineText>
            <HeadlineText size={ASK_SIZE} y={PLAQUE_TOP - 1.51} color="#ffffff" shadow="#12100e">
              Recommended
            </HeadlineText>
            <HeadlineText size={ASK_SIZE} y={PLAQUE_TOP - 2.34} color="#ffffff" shadow="#12100e">
              Damage:
            </HeadlineText>
            <HeadlineText size={FIGURE_SIZE} y={PLAQUE_TOP - 3.38} color="#ffd23f" shadow="#12100e">
              {formatNumber(recommendedDamage(0))}
            </HeadlineText>
            <HeadlineText size={0.46} y={PLAQUE_TOP - 4.48} color="#ffe9f0" shadow="#12100e">
              {`Best so far: Stage ${bestStage + 1}`}
            </HeadlineText>
          </group>
        ))}
      </group>
    </group>
  )
}
