import { Suspense, useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import ArenaScene from './ArenaScene.jsx'
import LobbyScene from './lobby/LobbyScene.jsx'
import OtherPlayers from './OtherPlayers.jsx'
import Player from './Player.jsx'
import LobbyCamera from './lobby/LobbyCamera.jsx'
import { useGameStore } from '../store/useGameStore.js'
import {
  ARENA,
  LOBBY_Z_OFFSET,
  MOUTH_EXIT_Z,
  chamberOrigin,
  clampToCorridor,
} from '../data/arena.js'
import { clampToPlaza } from '../data/lobby.js'
import { playerPosition } from '../systems/playerState.js'
import { updateTimeScale } from '../systems/timeScale.js'
import { EVENTS, emit } from '../systems/events.js'

/**
 * Advances the global hit-stop clock before anything else reads it.
 *
 * A negative render priority only reorders callbacks - it does not hand
 * rendering over to us the way a positive priority would - so this stays a
 * plain member of the default render loop.
 */
function TimeStepper() {
  // Dev-only handle so a smoke test can walk the graph.
  const three = useThree()
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.__dinoDebug) {
    window.__dinoDebug.scene = three.scene
  }

  const announced = useRef(false)

  useFrame((_, delta) => {
    updateTimeScale(delta)
    // The first frame is the honest signal that the scene is actually visible,
    // which is what dismisses the loading veil.
    if (!announced.current) {
      announced.current = true
      emit(EVENTS.READY)
    }
  }, -100)

  return null
}

/**
 * The whole world: the hub, the corridor of chambers, and one dino walking
 * between them.
 *
 * Nothing here swaps. Both halves are mounted the entire time, laid out end to
 * end in one coordinate space - the hub is simply the arena's world slid
 * `LOBBY_Z_OFFSET` down the corridor, drawn inside a group at that offset so
 * its own layout can go on being written in its own numbers. One camera, one
 * player, one set of coordinates. What the gateway changes is which walls are
 * being clamped against and whether a fight is running, not what exists.
 */
export default function Scene() {
  const scene = useGameStore((s) => s.scene)
  const inLobby = scene === 'lobby'
  /*
   * Which half's walls the camera is being kept out of is a fact about where
   * the *camera* is, not about which half the dino has just stepped into.
   *
   * The two clamps describe different geometry - a corridor of chambers, an
   * open plaza - so switching between them moves the shot. Hung off the scene
   * flag, that switch landed on the frame the dino crossed the line, with the
   * camera still nineteen units back inside the arena's mouth: the plaza's
   * rules were applied to a point standing in the gateway, and a camera swung
   * even slightly wide was squeezed to the width of a doorway on the spot.
   * Asking where the point itself is defers that to the moment the camera
   * reaches the same doorway, by which time the two are describing much the
   * same gap.
   */
  const clampCamera = useCallback((point) => {
    if (point.z > MOUTH_EXIT_Z) {
      // The plaza's rules are written in the hub's own numbers, so drop into
      // them for the length of the call and come back out.
      point.z -= LOBBY_Z_OFFSET
      const hubPlayerZ = playerPosition.z - LOBBY_Z_OFFSET
      clampToPlaza(point, undefined, { x: playerPosition.x, y: playerPosition.y, z: hubPlayerZ })
      point.z += LOBBY_Z_OFFSET
      return point
    }

    const state = useGameStore.getState()
    const sealedZ = state.stageCleared
      ? null
      : chamberOrigin(state.stageIndex) + ARENA.backZ + 1.5
    return clampToCorridor(point, playerPosition, sealedZ)
  }, [])

  return (
    <>
      <TimeStepper />
      <Suspense fallback={null}>
        <LobbyCamera
          clamp={clampCamera}
          /*
           * One ceiling for the whole world, not one per half.
           *
           * `LobbyCamera`'s own default (0.62) is tuned for the corridor's
           * worst case - a side-on camera squeezed to a few metres of reach by
           * the walls - and that squeeze can happen in the hub too, right at
           * the arena gateway. Everywhere else, in either scene, a chamber or
           * the plaza is wide open floor, and the extra range is what lets a
           * player look straight down at the whole layout - gate to gate -
           * rather than staying locked to a driving-height view.
           *
           * The hub used to get 1.2 and the corridor 1.1, which sounds like
           * nothing and is not: the ceiling it sets is `reach * tan(angle)`, so
           * across nineteen units of reach those two are eleven units apart in
           * height. Looking steeply down - which is how this game is actually
           * played - the shot therefore lifted or dropped the moment the line
           * was crossed. A walk between two halves of one place cannot change
           * the lens it is being watched through.
           */
          maxLookDown={1.2}
        />
        <ArenaScene active={!inLobby} />
        <LobbyScene
          includeEnvironment={false}
          includeGameplay={inLobby}
          includeArenaPreview={false}
          worldPosition={[0, 0, LOBBY_Z_OFFSET]}
        />
        <Player />
        <OtherPlayers />
      </Suspense>
    </>
  )
}
