import { useFrame } from '@react-three/fiber'
import { stageTravelTarget } from '../../data/arena.js'
import { useGameStore } from '../../store/useGameStore.js'
import { playerPosition } from '../../systems/playerState.js'

/**
 * Which level the dino is standing in.
 *
 * The corridor is one continuous strip of ground, so the level you are in is a
 * fact about where you are - not something a one-way trigger decided for you
 * on the way past. Every frame this asks the corridor where the dino belongs
 * and hands the answer to the store, which is what makes the whole run
 * walkable in reverse as well as forward.
 *
 * The rule itself is `stageTravelTarget` in the layout data; all this owns is
 * how often it is asked and who is told.
 */
export default function ArenaTravel() {
  useFrame(() => {
    const store = useGameStore.getState()
    // A dead dino is already on its way to the hub; nothing it drifts over
    // on the way down counts as walking anywhere.
    if (store.scene !== 'arena' || store.dead) return

    const target = stageTravelTarget(
      store.stageIndex,
      playerPosition.x,
      playerPosition.z
    )
    if (target !== null) store.travelToStage(target)
  })

  return null
}
