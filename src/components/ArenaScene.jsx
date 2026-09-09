import { Suspense } from 'react'
import { Physics } from '@react-three/rapier'
import ArenaEnvironment from './arena/ArenaEnvironment.jsx'
import ArenaCombat from './arena/ArenaCombat.jsx'
import ArenaFightCatcher from './arena/ArenaFightCatcher.jsx'
import ArenaTravel from './arena/ArenaTravel.jsx'
import EnemyAttacks from './arena/EnemyAttacks.jsx'
import EnemyPack from './arena/EnemyPack.jsx'
import GateHeadline from './arena/GateHeadline.jsx'
import Gates from './arena/Gates.jsx'
import ReturnPads from './arena/ReturnPads.jsx'
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
export default function ArenaScene({ active = true }) {
  return (
    <>
      <ArenaEnvironment />
      <Gates />

      {/*
        The pack is mounted always but only shown once you are near the
        doorway - hidden with `visible`, not left unmounted. See
        `REVEAL_MARGIN` in EnemyPack.jsx for why that reveal is a few steps
        earlier than the scene actually flips to `active`, rather than tied
        to `active` directly.

        Mounting always means the enemy models are built at startup rather
        than at the doorway, so there is no stutter the frame you cross the
        threshold.
      */}
      <EnemyPack />
      <HitParticles />

      {/*
        Everything below used to wait for `active` at the React level, mounted
        and unmounted as one block the instant the scene flipped - eight
        components (materials, event subscriptions, memoized buffers) coming
        into or out of existence on the single frame you stepped through the
        gate, on top of whatever React itself has to do to reconcile a
        subtree that size. That is a second, independent source of the same
        "it teleported" hitch the pack and the physics world were already
        fixed for above.

        Each of these now guards itself instead - `if (store.scene !==
        'arena') return` at the top of its own frame, or nothing at all where
        it already read live state and never depended on being freshly
        mounted (ArenaTravel, EnemyAttacks). Mounted permanently, there is
        nothing left to construct or tear down at the doorway - the swap is
        just a flag flipping on components already running.

        GateHeadline is the one exception, left conditional: it is a plain
        `return null` component with no `useFrame` of its own to gate inside,
        and its only mount cost is one event subscription - not worth the
        same treatment.
      */}
      <IdleDamage />
      <ArenaFightCatcher />
      <ArenaTravel />
      <EnemyAttacks />
      <ReturnPads />
      <ArenaCombat />
      {active && <GateHeadline />}

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
