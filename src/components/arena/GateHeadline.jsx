import { useEffect, useState } from 'react'
import { Billboard } from '@react-three/drei'
import { EXIT_SIGN_Z, chamberOrigin } from '../../data/arena.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, on } from '../../systems/events.js'
import HeadlineText from '../HeadlineText.jsx'

/**
 * What the room is asking of you, said over the gate.
 *
 * One line, high and centred, and only while a level still has hold of you:
 * put the pack down, and how much of it is left. Where the gate *goes* - the
 * stage through it and the damage it wants - is lettered onto the barrier
 * itself, which is the thing you walk up to and which no longer disappears
 * when the chamber clears. Saying that here as well put the same two lines on
 * screen twice, stacked.
 *
 * It never fades while it is up. Everything else - the way back, the cash-out
 * pads - speaks only when you are close enough to act on it; this is the whole
 * job in front of you, and it has to read from anywhere in the chamber.
 */

/**
 * Where it hangs.
 *
 * Tuned against the camera rather than guessed: at 5.4 up, over the chamber's
 * own edge, it lands between a seventh and a quarter of the way down the
 * screen from anywhere in the chamber - clear of the fight, clear of the
 * waymarker in the foreground, and inside the gateway's own opening rather
 * than lost above the pillars.
 */
const HEIGHT = 5.4

export default function GateHeadline() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stageCleared = useGameStore((s) => s.stageCleared)
  const dead = useGameStore((s) => s.dead)

  /*
   * How many are still standing. It rides the event the range check already
   * emits, which fires when the head-count changes rather than every frame, so
   * this costs a render per enemy killed and nothing in between.
   */
  const [remaining, setRemaining] = useState(0)
  useEffect(() => on(EVENTS.ARENA_PROMPT, (p) => setRemaining(p.remaining ?? 0)), [])

  if (dead || stageCleared) return null

  return (
    <Billboard
      position={[0, HEIGHT, chamberOrigin(stageIndex) + EXIT_SIGN_Z]}
      /*
       * Free to tilt, not just to yaw. Locked upright it went edge-on the
       * moment the camera looked down from any height - overlapping text quads
       * seen side-on, which reads as a black sliver torn down the middle of the
       * screen rather than as a headline.
       */
      follow
    >
      <HeadlineText size={0.92} color="#ffffff" y={0}>
        Defeat all enemies first!
      </HeadlineText>
      {remaining > 0 && (
        <HeadlineText size={0.46} color="#e6ecff" y={-0.86}>
          {`${remaining} left`}
        </HeadlineText>
      )}
    </Billboard>
  )
}
