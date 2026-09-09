import { ARENA, chamberOrigin } from '../../data/arena.js'
import { useGameStore } from '../../store/useGameStore.js'
import { queueAttack } from '../../systems/input.js'

/**
 * Left-click anywhere to swing.
 *
 * An invisible backdrop behind the whole arena turns a click into an attack
 * request, which ArenaCombat then resolves against the current target and its
 * range. `colorWrite={false}` keeps it off the screen while leaving it visible
 * to the raycaster, unlike `visible={false}` which three.js skips entirely.
 *
 * Pinned to the current chamber's own origin, not a fixed world position -
 * every other chamber-relative object does the same (Gates, ReturnPads,
 * EnemyPack). A fixed Z only ever sat behind Stage 1: past that, the camera
 * has moved on with the corridor and a click no longer reaches a backdrop
 * still standing at the doorway, which read as clicking doing nothing at all
 * from Stage 2 on.
 *
 * Right-clicks are ignored: those belong to the orbit camera.
 */
export default function ArenaFightCatcher() {
  const stageIndex = useGameStore((s) => s.stageIndex)

  return (
    <mesh
      position={[0, 8, chamberOrigin(stageIndex) + ARENA.backZ - 24]}
      onPointerDown={(e) => {
        if (e.nativeEvent.button !== 0) return
        // Mounted permanently now (see ArenaScene.jsx), so a click that lands
        // here while you are still in the hub - the backdrop is enormous and
        // sits behind everything - must not queue a swing at a chamber you
        // have not walked into yet.
        if (useGameStore.getState().scene !== 'arena') return
        e.stopPropagation()
        queueAttack()
      }}
    >
      <planeGeometry args={[300, 180]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  )
}
