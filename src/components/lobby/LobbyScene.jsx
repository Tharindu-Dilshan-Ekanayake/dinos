import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  INTERACT_RADIUS,
  PODIUMS,
  REBIRTH_PEDESTALS,
  REBIRTH_POSITIONS,
  TRAINING_PADS_LAYOUT,
  TRAINING_POSITIONS,
} from '../../data/lobby.js'
import { EVOLUTIONS } from '../../data/evolutions.js'
import { REBIRTH_WINS_REQUIRED } from '../../data/progression.js'
import { useGameStore } from '../../store/useGameStore.js'
import { EVENTS, emit } from '../../systems/events.js'
import { consumeInteract } from '../../systems/input.js'
import { playerPosition } from '../../systems/playerState.js'
import ArenaGate from './ArenaGate.jsx'
import FightCatcher from './FightCatcher.jsx'
import LobbyCamera from './LobbyCamera.jsx'
import LobbyEnvironment from './LobbyEnvironment.jsx'
import LobbyGround from './LobbyGround.jsx'
import Player from './Player.jsx'
import Podium from './Podium.jsx'
import RebirthPedestal from './RebirthPedestal.jsx'
import TrainingPad from './TrainingPad.jsx'
import TrainingSystem from './TrainingSystem.jsx'

/**
 * Finds whatever the player is standing next to, publishes it to the HUD, and
 * handles the interact key.
 *
 * The scan is a handful of squared-distance checks against fixed positions, so
 * it is cheaper per frame than any spatial index would be, and it only touches
 * React when the *identity* of the nearby thing changes - not every frame.
 */
function Interactions() {
  const lastPrompt = useRef(null)

  useFrame(() => {
    let best = null
    let bestDistance = INTERACT_RADIUS * INTERACT_RADIUS

    for (const podium of PODIUMS) {
      const dx = playerPosition.x - podium.position[0]
      const dz = playerPosition.z - podium.position[2]
      const d2 = dx * dx + dz * dz
      if (d2 < bestDistance) {
        bestDistance = d2
        best = { kind: 'podium', podium }
      }
    }

    for (let i = 0; i < REBIRTH_POSITIONS.length; i++) {
      const position = REBIRTH_POSITIONS[i]
      const dx = playerPosition.x - position[0]
      const dz = playerPosition.z - position[2]
      const d2 = dx * dx + dz * dz
      if (d2 < bestDistance) {
        bestDistance = d2
        best = { kind: 'rebirth', pedestal: REBIRTH_PEDESTALS[i] }
      }
    }

    const state = useGameStore.getState()

    // Describe the target for the HUD prompt.
    let prompt = null
    if (best?.kind === 'podium') {
      const evolution = EVOLUTIONS[best.podium.evolutionIndex]
      const unlocked = best.podium.evolutionIndex <= state.unlockedIndex
      const equipped = best.podium.evolutionIndex === state.equippedIndex
      prompt = {
        id: `podium:${evolution.id}`,
        title: evolution.name,
        action: equipped ? 'Equipped' : unlocked ? 'Equip' : 'Locked',
        enabled: unlocked && !equipped,
      }
    } else if (best?.kind === 'rebirth') {
      const ready = state.totalWins >= REBIRTH_WINS_REQUIRED
      prompt = {
        id: `rebirth:${best.pedestal.rebirths}`,
        title: `${best.pedestal.rebirths} Rebirth${best.pedestal.rebirths === 1 ? '' : 's'}`,
        action: ready ? 'Rebirth' : 'Not enough wins',
        enabled: ready,
      }
    }

    if (prompt?.id !== lastPrompt.current?.id || prompt?.action !== lastPrompt.current?.action) {
      lastPrompt.current = prompt
      emit(EVENTS.PROMPT, prompt)
    }

    if (!consumeInteract() || !best) return

    if (best.kind === 'podium') {
      state.equipEvolution(best.podium.evolutionIndex)
    } else {
      emit(EVENTS.OPEN_REBIRTH)
    }
  })

  return null
}

export default function LobbyScene() {
  return (
    <>
      <LobbyCamera />
      <LobbyEnvironment />
      <LobbyGround />
      <FightCatcher />

      {/* All thirteen stages on show, alternating down the plaza. */}
      {PODIUMS.map((podium) => (
        <Podium key={podium.id} podium={podium} />
      ))}

      {/* Training row: stand on a pad to grow your Damage. */}
      {TRAINING_PADS_LAYOUT.map((pad, i) => (
        <TrainingPad key={pad.id} pad={pad} position={TRAINING_POSITIONS[i]} />
      ))}

      {REBIRTH_PEDESTALS.map((pedestal, i) => (
        <RebirthPedestal
          key={pedestal.rebirths}
          pedestal={pedestal}
          position={REBIRTH_POSITIONS[i]}
          onOpen={() => emit(EVENTS.OPEN_REBIRTH)}
        />
      ))}

      <ArenaGate />
      <Player />
      <TrainingSystem />
      <Interactions />
    </>
  )
}
