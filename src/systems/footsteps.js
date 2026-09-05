import { playFootstep } from './audio.js'
import { playerPosition } from './playerState.js'

/**
 * Footfalls, taken from the same stride phase that swings the legs.
 *
 * The rigs already animate from a `stride` number, so the sound is derived
 * from that rather than from a second timer of its own: a step is heard on the
 * frame the foot is actually down, and slowing the walk slows the footsteps
 * without anything having to keep the two in agreement.
 */

/** Half a stride cycle - one foot down. */
const STEP_PHASE = Math.PI

/** Below this the legs are barely moving and there is no footfall to hear. */
const WALK_THRESHOLD = 0.3

/** Nothing further away than this is audible at all. */
const EARSHOT = 26

/**
 * Floor on the gap between any two *pack* footfalls.
 *
 * Seven dinos running at you put a foot down every few frames between them,
 * which as audio is not seven footsteps - it is noise. One budget shared
 * across the whole pack keeps it reading as a herd instead.
 */
const PACK_MIN_INTERVAL = 0.07
let lastPackStep = 0

/**
 * Build a stepper for one dino.
 *
 * `scale` sizes the voice: a bigger dino lands heavier and lower. `shared`
 * puts the stepper on the pack's rate limit, and passing x/z fades it with
 * distance from the player - both of which only matter for enemies, since
 * there is exactly one of you and you are always at the microphone.
 */
export function createStepper({ scale = 1, gain = 1, shared = false } = {}) {
  const pitch = Math.max(0.55, Math.min(1.4, 1.3 - scale * 0.38))
  let previous = 0

  return function step(stride, speed, { grounded = true, x = null, z = null } = {}) {
    if (speed < WALK_THRESHOLD || !grounded) {
      /*
       * Hold the phase just short of a footfall while standing (or in the
       * air), so the first step after setting off lands promptly rather than
       * half a cycle later - and so landing a jump thuds rather than waiting.
       */
      previous = stride - STEP_PHASE * 0.75
      return
    }

    if (stride - previous < STEP_PHASE) return
    previous = stride

    let falloff = 1
    if (x !== null) {
      const distance = Math.hypot(x - playerPosition.x, z - playerPosition.z)
      if (distance > EARSHOT) return
      falloff = 1 - distance / EARSHOT
      // Squared, so a dino at the far wall is a hint and one at your heels is
      // a stomp, rather than everything in the chamber sounding equally close.
      falloff *= falloff
    }

    if (shared) {
      const now = performance.now() / 1000
      if (now - lastPackStep < PACK_MIN_INTERVAL) return
      lastPackStep = now
    }

    playFootstep({ intensity: speed, gain: gain * falloff, pitch })
  }
}
