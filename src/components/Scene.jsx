import { Suspense, useCallback, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import ArenaScene from './ArenaScene.jsx'
import LobbyScene from './lobby/LobbyScene.jsx'
import ArenaPlayer from './arena/ArenaPlayer.jsx'
import OtherPlayers from './OtherPlayers.jsx'
import Player from './lobby/Player.jsx'
import LobbyCamera from './lobby/LobbyCamera.jsx'
import { useGameStore } from '../store/useGameStore.js'
import { ARENA, LOBBY_Z_OFFSET, chamberOrigin, clampToCorridor } from '../data/arena.js'
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
 * The world half swaps at the gate, but the camera does not. Keeping one orbit
 * rig mounted means its position and smoothing survive the coordinate handoff,
 * so walking into Stage 1 reads as continuing forward instead of a new view
 * appearing around the player.
 */
export default function Scene() {
  const scene = useGameStore((s) => s.scene)
  const inLobby = scene === 'lobby'
  const clampCamera = useCallback((point) => {
    const state = useGameStore.getState()
    if (state.scene === 'lobby') {
      point.z -= LOBBY_Z_OFFSET
      clampToPlaza(point)
      point.z += LOBBY_Z_OFFSET
      return point
    }

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
          worldOffset={inLobby ? [0, 0, LOBBY_Z_OFFSET] : [0, 0, 0]}
          /*
           * The lobby gets a steeper top-down ceiling than the arena does.
           *
           * `LobbyCamera`'s default is tuned for the corridor's worst case - a
           * side-on camera squeezed to a few metres of reach by the walls -
           * and that squeeze can happen in the hub too, right at the arena
           * gateway. Everywhere else the plaza is wide open, and the extra
           * range is what lets a player actually look down at the cliffs and
           * the road rather than staying locked to a driving-height view of
           * a world that is now built to be seen from above as much as from
           * the side. Left at the default outside the lobby, so the arena's
           * corridor frames exactly as it did before.
           */
          maxLookDown={inLobby ? 0.8 : undefined}
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
