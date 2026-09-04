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
import { playerPosition } from '../../systems/playerState.js'

/**
 * Awards training damage while the player stands on an unlocked pad.
 *
 * Like the idle system, this accumulates against a delta timer and commits on
 * a fixed interval rather than writing the store every frame - and it reports
 * the active pad to the HUD only when it actually changes.
 */
export default function TrainingSystem() {
  const accumulator = useRef(0)
  const pending = useRef(0)
  const activeId = useRef(null)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.25)
    const rebirths = useGameStore.getState().rebirths

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

    if (current?.id !== activeId.current) {
      activeId.current = current?.id ?? null
      emit(EVENTS.TRAINING, current ? { pad: current, rate: padRate(current) } : null)
      // Never carry damage earned on one pad over to the next.
      pending.current = 0
      accumulator.current = 0
    }

    if (!current) return

    pending.current += padRate(current) * delta
    accumulator.current += delta
    if (accumulator.current < TRAIN_FLUSH_INTERVAL) return

    const amount = pending.current
    accumulator.current = 0
    pending.current = 0
    useGameStore.getState().trainTick(amount)
  })

  return null
}
