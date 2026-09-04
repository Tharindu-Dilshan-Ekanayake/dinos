import { Suspense } from 'react'
import { Physics } from '@react-three/rapier'
import ArenaEnvironment from './arena/ArenaEnvironment.jsx'
import ArenaPlayer from './arena/ArenaPlayer.jsx'
import ArenaCombat from './arena/ArenaCombat.jsx'
import ArenaFightCatcher from './arena/ArenaFightCatcher.jsx'
import EnemyPack from './arena/EnemyPack.jsx'
import EntryGate from './arena/EntryGate.jsx'
import ExitGate from './arena/ExitGate.jsx'
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
  return (
    <>
      <IdleDamage />
      <LobbyCamera />
      <ArenaEnvironment />

      <ArenaFightCatcher />
      <ArenaPlayer />
      <EnemyPack />
      <EntryGate />
      <ExitGate />
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
