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
export default function ArenaScene({ includePlayer = true, includeCamera = true, active = true }) {
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
      {includeCamera && <LobbyCamera clamp={clampCamera} />}
      <ArenaEnvironment />
      <Gates />

      {/*
        The pack stands in its chamber whether or not you are in it yet.
        
        It used to come into existence on the frame you crossed the threshold,
        along with everything else here - so looking down the corridor from the
        hub you saw an empty Stage 1, walked into it, and a pack of dinos
        appeared out of nothing in front of you. That is the last of the "it
        teleported" left: not the ground moving, but the room being furnished
        the moment you were inside it.
        
        Mounted always, the level you are walking toward is the level you
        arrive in. It costs the enemy models being built at startup instead of
        at the doorway, which is the trade this whole seam is about. What still
        waits for `active` is everything that *does* something - the attacks,
        the damage, the travel trigger, the pads' keypress - so a pack visible
        from the hub is scenery until you are actually in the room with it.
      */}
      <EnemyPack />
      <HitParticles />

      {active && (
        <>
          <IdleDamage />
          <ArenaFightCatcher />
          <ArenaTravel />
          {includePlayer && <ArenaPlayer />}
          <EnemyAttacks />
          <GateHeadline />
          <ReturnPads />
          <ArenaCombat />
        </>
      )}

      {/*
        The physics world is built once, not at the doorway.
        
        It used to be mounted inside the block above, which meant crossing into
        Stage 1 created a whole rapier world - and nine other components with it
        - on the single frame you stepped through the gate. That is the hitch:
        not the geometry, which is drawn continuously either side of the seam,
        but a dozen things coming into existence at once at the exact moment you
        are asked to believe nothing happened.
        
        An empty world costs a step over no bodies. What actually spawns debris
        is still gated on the fight being live, so the hub pays nothing for it.
      */}
      <Suspense fallback={null}>
        <Physics gravity={[0, -26, 0]} timeStep="vary">
          {active && <DebrisField />}
        </Physics>
      </Suspense>
    </>
  )
}
