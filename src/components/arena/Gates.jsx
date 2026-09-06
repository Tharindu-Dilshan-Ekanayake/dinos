import { useMemo } from 'react'
import { chamberWindow } from '../../data/arena.js'
import { MAX_STAGES, stageHealth } from '../../data/stages.js'
import { useGameStore } from '../../store/useGameStore.js'
import EntryGate from './EntryGate.jsx'
import ExitGate from './ExitGate.jsx'

/**
 * A gateway at both ends of every chamber that is standing.
 *
 * The corridor mounts three levels either side of you, but only the one you
 * were in had any gates in it - so looking down the corridor showed rooms with
 * no way in or out of them, and looking back showed the ground you had walked
 * with nothing to say it had ever been a level. They are what makes a chamber
 * read as a stage rather than as a stretch of floor.
 *
 * The same window the environment builds, so a gate can never outlive or
 * outrun the chamber it belongs to.
 */
export default function Gates() {
  const stageIndex = useGameStore((s) => s.stageIndex)
  const stageCleared = useGameStore((s) => s.stageCleared)
  const chamberHealth = useGameStore((s) => s.chamberHealth)
  const window_ = useMemo(() => chamberWindow(stageIndex, MAX_STAGES), [stageIndex])

  /**
   * Whether a given level is still shut.
   *
   * The run already remembers what it did to every chamber, so a gate three
   * levels back knows it is open and one three levels ahead knows it is not -
   * without anything having to be told. The chamber underfoot is the exception:
   * its health is live, so `stageCleared` is the fresher answer.
   */
  const isSealed = (stage) =>
    stage === stageIndex
      ? !stageCleared
      : (chamberHealth[stage] ?? stageHealth(stage)) > 0

  return (
    <>
      {window_.map((stage) => (
        <group key={stage}>
          <EntryGate stage={stage} />
          <ExitGate stage={stage} active={stage === stageIndex} sealed={isSealed(stage)} />
        </group>
      ))}
    </>
  )
}
