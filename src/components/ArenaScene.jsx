import { Suspense, useCallback } from 'react'
import { Physics } from '@react-three/rapier'
import { ARENA, chamberOrigin, clampToCorridor } from '../data/arena.js'
import { useGameStore } from '../store/useGameStore.js'
import { playerPosition } from '../systems/playerState.js'
import ArenaEnvironment from './arena/ArenaEnvironment.jsx'
import ArenaPlayer from './arena/ArenaPlayer.jsx'
import ArenaCombat from './arena/ArenaCombat.jsx'
import ArenaFightCatcher from './arena/ArenaFightCatcher.jsx'
import ArenaTravel from './arena/ArenaTravel.jsx'
import EnemyAttackEffects from './arena/EnemyAttackEffects.jsx'
import EnemyAttacks from './arena/EnemyAttacks.jsx'
import EnemyPack from './arena/EnemyPack.jsx'
import GateHeadline from './arena/GateHeadline.jsx'
import Gates from './arena/Gates.jsx'
import ReturnPads from './arena/ReturnPads.jsx'
import LobbyCamera from './lobby/LobbyCamera.jsx'
import DebrisField from './DebrisField.jsx'
import HitParticles from './HitParticles.jsx'
import IdleDamage from './IdleDamage.jsx'

/**
 * The battle half of the game.
 *
 * You walk your dino into a hollow full of enemy dinos, close the distance and
 * fight. The camera, controller and input are the same ones the hub uses, so
 * moving between the two never changes how the dino handles.
 */
export default function ArenaScene() {
  // Where the open space is depends on where the dino is standing, so the
  // camera's clamp is handed the live player position rather than importing it
  // into the layout data.
  const clampCamera = useCallback((point) => {
    // Only a *sealed* gate holds the camera back; once the chamber is clear
    // the corridor is one continuous space and the camera may follow you
    // through it.
    const { stageIndex, stageCleared } = useGameStore.getState()
    const sealedZ = stageCleared
      ? null
      : chamberOrigin(stageIndex) + ARENA.backZ + 1.5
    return clampToCorridor(point, playerPosition, sealedZ)
  }, [])

  return (
    <>
      <IdleDamage />
      <LobbyCamera clamp={clampCamera} />
      <ArenaEnvironment />

      <ArenaFightCatcher />
      <ArenaTravel />
      <ArenaPlayer />
      <EnemyPack />
      <EnemyAttacks />
      <EnemyAttackEffects />
      <Gates />
      <GateHeadline />
      <ReturnPads />
      <ArenaCombat />

      <HitParticles />

      {/*
        Rapier drives only the celebratory debris. Attacks land many times a
        second and go through the cheap instanced particle system instead;
        rigid bodies are reserved for stage clears, where the count is bounded.
      */}
      <Suspense fallback={null}>
        <Physics gravity={[0, -26, 0]} timeStep="vary">
          <DebrisField />
        </Physics>
      </Suspense>
    </>
  )
}
