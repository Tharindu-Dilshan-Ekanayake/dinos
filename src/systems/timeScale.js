/**
 * Global hit-stop clock.
 *
 * On a heavy hit we briefly crush the time scale toward zero, then ease it
 * back. Every animated system multiplies its own delta by `getTimeScale()`, so
 * the whole scene freezes together for a couple of frames - the classic
 * "punch" feel - without touching React state.
 */
let scale = 1
let freezeRemaining = 0
let freezeDuration = 0
let freezeStrength = 0

/** Freeze the scene. `strength` 0-1, `duration` in seconds. */
export function hitStop(strength = 0.6, duration = 0.06) {
  // Never let a rapid click cancel a stronger, already-running freeze.
  if (freezeRemaining > 0 && freezeStrength > strength) return
  freezeStrength = Math.min(0.92, strength)
  freezeDuration = duration
  freezeRemaining = duration
}

/** Advance the clock. Called once per frame from the root of the scene. */
export function updateTimeScale(rawDelta) {
  if (freezeRemaining > 0) {
    freezeRemaining = Math.max(0, freezeRemaining - rawDelta)
    // Ease back out of the freeze so it releases smoothly.
    const t = freezeDuration > 0 ? 1 - freezeRemaining / freezeDuration : 1
    const eased = t * t
    scale = (1 - freezeStrength) + freezeStrength * eased
  } else {
    scale = 1
  }
  return scale
}

export function getTimeScale() {
  return scale
}

export function resetTimeScale() {
  scale = 1
  freezeRemaining = 0
  freezeStrength = 0
}
