import { ARENA } from '../../data/arena.js'
import { queueAttack } from '../../systems/input.js'

/**
 * Left-click anywhere to swing.
 *
 * An invisible backdrop behind the whole arena turns a click into an attack
 * request, which ArenaCombat then resolves against the current target and its
 * range. `colorWrite={false}` keeps it off the screen while leaving it visible
 * to the raycaster, unlike `visible={false}` which three.js skips entirely.
 *
 * Right-clicks are ignored: those belong to the orbit camera.
 */
export default function ArenaFightCatcher() {
  return (
    <mesh
      position={[0, 8, ARENA.backZ - 24]}
      onPointerDown={(e) => {
        if (e.nativeEvent.button !== 0) return
        e.stopPropagation()
        queueAttack()
      }}
    >
      <planeGeometry args={[300, 180]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  )
}
