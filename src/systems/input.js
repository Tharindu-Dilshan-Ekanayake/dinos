/**
 * Movement input, kept out of React entirely.
 *
 * The player controller reads this every frame from useFrame; routing key
 * presses or joystick drags through component state would re-render the tree
 * sixty times a second while walking.
 */
const pressed = new Set()

/** Analog stick vector, -1..1 on each axis. */
const stick = { x: 0, y: 0 }

/** Set by the interact button / E key, consumed once by the lobby. */
let interactQueued = false

/**
 * Whether the interact control (E key or its on-screen button) is currently
 * held down - separate from `interactQueued` above, which is a one-shot pulse
 * for instant actions (equip a dino, open the rebirth menu). A "hold to
 * confirm" prompt (see ReturnPads.jsx / InteractPrompt.jsx) reads this
 * continuously instead, so the consequential action only fires once a full
 * hold has actually happened rather than on first touch.
 */
let interactHeld = false

/**
 * How long a "hold to confirm" prompt (see ReturnPads.jsx) must be held before
 * it actually fires. Shared with InteractPrompt.jsx so the ring it draws and
 * the moment the action actually happens can never drift apart.
 */
export const INTERACT_HOLD_SECONDS = 0.65

/** Set by Space or the jump button, consumed once by the player controller. */
let jumpQueued = false

/** Set by the attack button / left click, consumed once by the arena. */
let attackQueued = false

const MOVE_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

export function installInput() {
  const onKeyDown = (e) => {
    // Never swallow typing in the settings name field.
    if (e.target instanceof HTMLInputElement) return
    if (MOVE_KEYS[e.code]) {
      pressed.add(MOVE_KEYS[e.code])
      e.preventDefault()
    }
    if (e.code === 'KeyE') {
      interactQueued = true
      interactHeld = true
      e.preventDefault()
    }
    // Space jumps. It would otherwise scroll the page, so always swallow it.
    if (e.code === 'Space') {
      jumpQueued = true
      e.preventDefault()
    }
  }

  const onKeyUp = (e) => {
    if (MOVE_KEYS[e.code]) pressed.delete(MOVE_KEYS[e.code])
    if (e.code === 'KeyE') interactHeld = false
  }

  // Releasing focus while a key is held would otherwise leave the dino walking.
  const onBlur = () => {
    pressed.clear()
    interactHeld = false
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    pressed.clear()
  }
}

export function setStick(x, y) {
  stick.x = x
  stick.y = y
}

export function queueInteract() {
  interactQueued = true
}

/** Called by the on-screen interact button on press/release (keyboard drives this itself). */
export function setInteractHeld(down) {
  interactHeld = down
}

/** Whether the interact control is currently held down. */
export function isInteractHeld() {
  return interactHeld
}

export function queueJump() {
  jumpQueued = true
}

export function queueAttack() {
  attackQueued = true
}

/** Reads and clears the interact request. */
export function consumeInteract() {
  const value = interactQueued
  interactQueued = false
  return value
}

/** Reads and clears the jump request. */
export function consumeJump() {
  const value = jumpQueued
  jumpQueued = false
  return value
}

/** Reads and clears the attack request. */
export function consumeAttack() {
  const value = attackQueued
  attackQueued = false
  return value
}

/**
 * Combined move vector in world space.
 * x = strafe (+ right), z = forward (- is away from the camera).
 */
export function getMoveVector(out = { x: 0, z: 0 }) {
  let x = stick.x
  let z = stick.y

  if (pressed.has('left')) x -= 1
  if (pressed.has('right')) x += 1
  if (pressed.has('up')) z -= 1
  if (pressed.has('down')) z += 1

  const length = Math.hypot(x, z)
  if (length > 1) {
    x /= length
    z /= length
  }

  out.x = x
  out.z = z
  return out
}
