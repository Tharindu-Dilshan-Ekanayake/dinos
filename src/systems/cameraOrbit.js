/**
 * Mouse-driven orbit camera state.
 *
 * Right-drag swings the camera around the player and the wheel zooms; left
 * click is reserved for fighting and walking stays on WASD. On touch there is
 * no second button, so a one-finger drag on the canvas orbits instead.
 *
 * Held outside React because it updates on every pointermove and must never
 * re-render the scene.
 *
 * `yaw` places the camera on the circle around the player:
 *   offset = (sin(yaw), 0, cos(yaw)) * distance
 * so yaw 0 sits behind the player looking down -Z, matching the hub's layout.
 */
export const orbit = {
  yaw: 0,
  pitch: 0.42,
  distance: 21,
}

const YAW_SENSITIVITY = 0.006
const PITCH_SENSITIVITY = 0.004
/** Keep the camera above the ground and below straight-down. */
const MIN_PITCH = 0.14
const MAX_PITCH = 1.05
const MIN_DISTANCE = 10
const MAX_DISTANCE = 38
const ZOOM_SENSITIVITY = 0.02

/** Pixels of movement before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4

/**
 * Attaches orbit controls to the canvas.
 *
 * Only presses that start on the canvas rotate, so HUD buttons and the
 * joystick are unaffected. A press that never passes the drag threshold is
 * left alone, which keeps R3F's click handlers on podiums working.
 */
export function installCameraOrbit(canvas) {
  if (!canvas) return () => {}

  let pointerId = null
  let lastX = 0
  let lastY = 0
  let travelled = 0

  const onPointerDown = (e) => {
    // Mouse: right button only - left is the attack button.
    // Touch/pen: there is no second button, so a drag orbits.
    if (e.pointerType === 'mouse' && e.button !== 2) return
    if (pointerId !== null) return
    pointerId = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
    travelled = 0
  }

  const onPointerMove = (e) => {
    if (e.pointerId !== pointerId) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY

    travelled += Math.abs(dx) + Math.abs(dy)
    if (travelled < DRAG_THRESHOLD) return

    orbit.yaw -= dx * YAW_SENSITIVITY
    orbit.pitch = Math.min(
      MAX_PITCH,
      Math.max(MIN_PITCH, orbit.pitch + dy * PITCH_SENSITIVITY)
    )
  }

  const onPointerUp = (e) => {
    if (e.pointerId !== pointerId) return
    pointerId = null
  }

  const onWheel = (e) => {
    e.preventDefault()
    orbit.distance = Math.min(
      MAX_DISTANCE,
      Math.max(MIN_DISTANCE, orbit.distance + e.deltaY * ZOOM_SENSITIVITY)
    )
  }

  // Right-drag would otherwise open the context menu mid-swing.
  const onContextMenu = (e) => e.preventDefault()

  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)
  }
}

/**
 * Movement basis for the current camera angle.
 *
 * W should walk away from the camera whatever way it is facing, so input is
 * resolved against these rather than world axes.
 */
export function getCameraBasis(out = { forwardX: 0, forwardZ: 0, rightX: 0, rightZ: 0 }) {
  const sin = Math.sin(orbit.yaw)
  const cos = Math.cos(orbit.yaw)
  // Camera sits at +(sin, cos) from the player, so "away" is the negative.
  out.forwardX = -sin
  out.forwardZ = -cos
  out.rightX = cos
  out.rightZ = -sin
  return out
}
