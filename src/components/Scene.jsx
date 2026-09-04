import { Suspense, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import ArenaScene from './ArenaScene.jsx'
import LobbyScene from './lobby/LobbyScene.jsx'
import { useGameStore } from '../store/useGameStore.js'
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
 * Swaps between the two halves of the game: the walkable hub and the battle
 * arena. Only one mounts at a time, so exactly one camera controller and one
 * fog setup is ever live.
 */
export default function Scene() {
  const scene = useGameStore((s) => s.scene)

  return (
    <>
      <TimeStepper />
      <Suspense fallback={null}>
        {scene === 'lobby' ? <LobbyScene /> : <ArenaScene />}
      </Suspense>
    </>
  )
}
