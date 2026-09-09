import { Suspense, useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import ArenaScene from './ArenaScene.jsx'
import LobbyScene from './lobby/LobbyScene.jsx'
import ArenaPlayer from './arena/ArenaPlayer.jsx'
import OtherPlayers from './OtherPlayers.jsx'
import Player from './lobby/Player.jsx'
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
import { playerWorld } from '../systems/playerWorld.js'
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
 * The world half swaps at the gate, but the camera does not. Keeping one orbit
 * rig mounted means its position and smoothing survive the coordinate handoff,
 * so walking into Stage 1 reads as continuing forward instead of a new view
 * appearing around the player.
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
    // World space, because the point is: `playerPosition` is whichever half's
    // coordinates the dino is currently written in, and these are not that.
    const player = playerWorld()

    if (point.z > MOUTH_EXIT_Z) {
      point.z -= LOBBY_Z_OFFSET
      player.z -= LOBBY_Z_OFFSET
      clampToPlaza(point, undefined, player)
      point.z += LOBBY_Z_OFFSET
      return point
    }

    const state = useGameStore.getState()
    const sealedZ = state.stageCleared
      ? null
      : chamberOrigin(state.stageIndex) + ARENA.backZ + 1.5
    return clampToCorridor(point, player, sealedZ)
  }, [])

  return (
    <>
      <TimeStepper />
      <Suspense fallback={null}>
        <LobbyCamera
          clamp={clampCamera}
          worldOffset={inLobby ? [0, 0, LOBBY_Z_OFFSET] : [0, 0, 0]}
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
        <ArenaScene includePlayer={false} includeCamera={false} active={!inLobby} />
        <LobbyScene
          includePlayer={false}
          includeCamera={false}
          includeEnvironment={false}
          includeGameplay={inLobby}
          includeArenaPreview={false}
          worldPosition={[0, 0, LOBBY_Z_OFFSET]}
        />
        <Player active={inLobby} worldOffset={[0, 0, LOBBY_Z_OFFSET]} />
        <OtherPlayers worldOffset={[0, 0, LOBBY_Z_OFFSET]} />
        <ArenaPlayer active={!inLobby} />
      </Suspense>
    </>
  )
}
