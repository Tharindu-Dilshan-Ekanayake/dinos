import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  PAD_RADIUS,
  TRAIN_FLUSH_INTERVAL,
  padRate,
  padUnlocked,
} from '../../data/training.js'
import { TRAINING_POSITIONS, TRAINING_PADS_LAYOUT } from '../../data/lobby.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { playerActivity, playerPosition } from '../../systems/playerState.js'

/**
 * Awards training damage while the player stands on an unlocked pad.
 *
 * Like the idle system, this accumulates against a delta timer and commits on
 * a fixed interval rather than writing the store every frame - and it reports
 * the active pad to the HUD only when it actually changes.
 */
/**
 * How often the gain is *announced*, as opposed to committed.
 *
 * The store is written four times a second, but four numbers a second is a
 * blur - and each one is a quarter of what the pad is worth, so the figure you
 * read is not the figure on the sign. One a second, carrying the whole second,
 * is the number the pad advertises.
 */
const SHOUT_INTERVAL = 1

export default function TrainingSystem() {
  const accumulator = useRef(0)
  const pending = useRef(0)
  const shout = useRef({ since: 0, gained: 0 })
  const activeId = useRef(null)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.25)
    const { rebirths, perClick } = useGameStore.getState()

    // Find the pad under the player, if any.
    let current = null
    for (let i = 0; i < TRAINING_PADS_LAYOUT.length; i++) {
      const pad = TRAINING_PADS_LAYOUT[i]
      const position = TRAINING_POSITIONS[i]
      const dx = playerPosition.x - position[0]
      const dz = playerPosition.z - position[2]
      if (dx * dx + dz * dz < PAD_RADIUS * PAD_RADIUS) {
        current = padUnlocked(pad, rebirths) ? pad : null
        break
      }
    }

    // The controller reads this in the same frame to run the legs on the spot.
    playerActivity.training = Boolean(current)

    if (current?.id !== activeId.current) {
      activeId.current = current?.id ?? null
      emit(EVENTS.TRAINING, current ? { pad: current, rate: padRate(current, perClick) } : null)
      // Never carry damage earned on one pad over to the next.
      pending.current = 0
      accumulator.current = 0
      shout.current.since = 0
      shout.current.gained = 0
    }

    if (!current) return

    const earned = padRate(current, perClick) * delta
    pending.current += earned
    accumulator.current += delta

    // A second's worth at a time, so the figure thrown up is the one the pad's
    // own sign promises.
    shout.current.gained += earned
    shout.current.since += delta
    if (shout.current.since >= SHOUT_INTERVAL) {
      const gained = shout.current.gained
      shout.current.since = 0
      shout.current.gained = 0
      if (gained > 0) emit(EVENTS.TRAIN_GAIN, { gain: gained, multiplier: current.multiplier })
    }
    if (accumulator.current < TRAIN_FLUSH_INTERVAL) return

    const amount = pending.current
    accumulator.current = 0
    pending.current = 0
    useGameStore.getState().trainTick(amount)
  })

  return null
}
