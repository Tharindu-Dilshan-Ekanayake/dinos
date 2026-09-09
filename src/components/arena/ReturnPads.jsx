import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import Text from '../SceneText.jsx'
import * as THREE from 'three'
import { RETURN_PADS, RETURN_PAD_RADIUS, chamberOrigin } from '../../data/arena.js'
import { formatNumber } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { INTERACT_HOLD_SECONDS, consumeInteract, isInteractHeld } from '../../systems/input.js'
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
 *
 * The pads themselves never move or appear from nothing - they are a fixed
 * fixture of the room, same as the exit gate. What changes is only their
 * colour: red and quiet while the pack still stands, blue and offering a deal
 * once it doesn't - one state read the same way the gate's own barrier is.
 */
// Shut while the run isn't over yet, open once it pays out - the same red the
// exit gate's own barrier uses for "locked", so one colour means one thing
// everywhere; "unlocked" is the card's own bright teal fill.
const LOCKED = { color: new THREE.Color('#ff3b5c'), emissive: new THREE.Color('#ff3b5c'), intensity: 0.25 }
const UNLOCKED = { color: new THREE.Color('#9fd8f5'), emissive: new THREE.Color('#3fa9ff'), intensity: 0.45 }

export default function ReturnPads() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stageCleared = useGameStore((s) => s.stageCleared)
  const runWins = useGameStore((s) => s.runWins)
  const dead = useGameStore((s) => s.dead)

  const padRefs = useRef([])
  const labelRefs = useRef([])
  const lastPrompt = useRef(null)
  const anim = useRef({ show: 0, phase: 0 })
  // How far through a held press we are (0..1), and whether this particular
  // hold has already paid out - so a press kept down past the fill point
  // cannot bank the same run twice.
  const hold = useRef({ progress: 0, fired: false })

  const materials = useMemo(
    () => ({
      /*
       * The card's own frame - near-white, always, whatever the fill is doing.
       *
       * It was green, which is the colour this game already spends on grass:
       * against a grass chamber the pads lost their edges entirely and read as
       * two blue squares lying loose on the lawn. A pale rim borrows from no
       * biome, so the pad keeps its shape on dirt, on rock and on ice.
       */
      base: new THREE.MeshStandardMaterial({ color: '#eef6fd', roughness: 0.6 }),
      // Colour is driven live, in useFrame - red while there's still a run to
      // finish, the usual bright teal once it actually pays out. Starting
      // values here only matter for the very first frame.
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

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const a = anim.current
    a.phase += delta

    /*
     * Mounted permanently now (see ArenaScene.jsx), not just while you are in
     * the arena, so it has to drop its own prompt and stop eating "E" presses
     * the instant you are not - otherwise a press meant for a hub podium,
     * which polls the same key, could be stolen by a pad you already walked
     * away from. `setPrompt` only actually emits once, the first frame this
     * is true, so this is the unmount-time cleanup the old version fired,
     * just driven by the scene instead of by the component's lifetime.
     */
    if (useGameStore.getState().scene !== 'arena') {
      setPrompt(null)
      return
    }

    /*
     * Drained every arena frame regardless of range - a plain tap still
     * queues this the instant E goes down (see input.js), and left unread it
     * would otherwise sit there and fire the moment some other prompt (a
     * podium, back in the hub) next checks it. It plays no part in banking
     * the run any more - that is a held press now, tracked below - so its
     * value is discarded.
     */
    consumeInteract()

    // The pads themselves are a fixed part of the room, not something that
    // pops into being - only their colour (and what they have to say) changes
    // with whether the run is actually over.
    const unlocked = stageCleared && !dead
    const target = unlocked ? 1 : 0
    a.show += (target - a.show) * Math.min(1, delta * 5)

    const tint = unlocked ? UNLOCKED : LOCKED
    materials.top.color.copy(tint.color)
    materials.top.emissive.copy(tint.emissive)
    materials.top.emissiveIntensity = tint.intensity

    padRefs.current.forEach((pad, i) => {
      if (pad) pad.position.y = 0.075 + Math.sin(a.phase * 2.2 + i) * 0.015
    })

    if (!unlocked) {
      setPrompt(null)
      hold.current.progress = 0
      hold.current.fired = false
      // Locked: nothing to offer yet, so the trophy card stays quiet.
      RETURN_PADS.forEach((_, i) => {
        fadeText(labelRefs.current[i * 2], 0)
        fadeText(labelRefs.current[i * 2 + 1], 0)
      })
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
            // Ending the run is the single most consequential move you can
            // make here - it asks for a held press with a fill ring, not a tap,
            // so it never happens as a stray press on the way through.
            hold: true,
          }
        : null
    )

    /*
     * A held press, not a tap. Progress only climbs while both the pad is
     * underfoot and the control is actually down; letting go of either resets
     * it, so walking off mid-hold or releasing early never half-banks a run.
     * `fired` then keeps a press held past the fill point from paying out
     * more than once.
     */
    if (inside && isInteractHeld()) {
      hold.current.progress = Math.min(1, hold.current.progress + delta / INTERACT_HOLD_SECONDS)
    } else {
      hold.current.progress = 0
      hold.current.fired = false
    }

    if (hold.current.progress >= 1 && !hold.current.fired) {
      hold.current.fired = true
      useGameStore.getState().claimRunWins()
    }
  })

  return (
    <group position={[0, 0, chamberOrigin(stageIndex)]}>
      {RETURN_PADS.map((pad, i) => (
        /*
         * Square to the room, not turned to a diamond. On the diagonal the pad
         * pointed a corner at the gate and a corner at the fight, and read as a
         * loose tile dropped on the floor; square, it lines up with the doorway
         * it stands beside and looks laid there on purpose.
         */
        <group key={pad.id} position={pad.position}>
          {/* A card lying flat on the ground, not a box standing on it - a
              pale frame around a bright fill, same shape the reference art
              uses. */}
          <mesh material={materials.base} position={[0, 0.03, 0]} receiveShadow castShadow>
            <boxGeometry args={[RETURN_PAD_RADIUS * 2, 0.06, RETURN_PAD_RADIUS * 2]} />
          </mesh>
          <mesh
            ref={(el) => {
              padRefs.current[i] = el
            }}
            material={materials.top}
            position={[0, 0.075, 0]}
          >
            <boxGeometry args={[RETURN_PAD_RADIUS * 1.5, 0.03, RETURN_PAD_RADIUS * 1.5]} />
          </mesh>

          <Billboard position={[0, 1.95, 0]}>
            {/* Cup, handles, stem and base - the same boxes everything else in
                this world is built out of. The two handles are what make it
                read as a trophy at a glance instead of as a gold brick, and a
                glance is all it gets: you are looking at the gate. */}
            <group position={[-0.94, 0.26, 0]}>
              <mesh material={materials.trophy} position={[0, 0.16, 0]}>
                <boxGeometry args={[0.34, 0.3, 0.18]} />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  material={materials.trophy}
                  position={[side * 0.23, 0.17, 0]}
                >
                  <boxGeometry args={[0.12, 0.17, 0.12]} />
                </mesh>
              ))}
              <mesh material={materials.trophy} position={[0, -0.06, 0]}>
                <boxGeometry args={[0.11, 0.14, 0.11]} />
              </mesh>
              <mesh material={materials.trophy} position={[0, -0.17, 0]}>
                <boxGeometry args={[0.3, 0.09, 0.16]} />
              </mesh>
            </group>

            {/* Gold for what you win, white for what you do with it - the
                trophy, the number and the verb are one line and a line under
                it, so the offer reads top to bottom in one look. */}
            <Text
              ref={(el) => {
                labelRefs.current[i * 2] = el
              }}
              position={[0.3, 0.26, 0]}
              fontSize={0.38}
              color="#ffd23f"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.055}
              outlineColor="#12100e"
            >
              {`+${formatNumber(runWins)} Wins`}
            </Text>
            <Text
              ref={(el) => {
                labelRefs.current[i * 2 + 1] = el
              }}
              position={[0.3, -0.16, 0]}
              fontSize={0.3}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.045}
              outlineColor="#12100e"
            >
              Return
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}
