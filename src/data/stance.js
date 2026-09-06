import { buildFor } from './builds.js'

/**
 * Where a dino's legs are, and what that does to where it stands.
 *
 * `PrimitiveDino` has always claimed "feet on y = 0" in its own doc comment,
 * and it has never been true. The hips are hand-placed round numbers - 1.06 for
 * the hindquarters of everything - while a foot's reach below its hip falls out
 * of the leg's *length*, which differs by build. The arithmetic never met:
 *
 *   biped  back foot   y = -0.060   sunk into the ground
 *   quad   back foot   y = +0.042   hovering
 *   quad   front foot  y = +0.064   hovering, and more than the back, so a
 *                                   four-legged dino stood nose-up
 *
 * Multiplied by the tier's scale, the biped's six hundredths is most of a foot
 * swallowed by the floor. Rather than nudge a hip - which would slide the thigh
 * out of the body it is socketed into - the whole animal is offset so that its
 * lowest foot lands exactly on zero, keeping every part where it was drawn
 * relative to every other part.
 *
 * With builds in the picture this matters more, not less: a raptor's legs are
 * a tenth longer than a rex's are short, and every one of those has to end on
 * the same floor. So nothing here is a constant that a build can contradict -
 * it is all derived, per build, from the same numbers the legs are made of.
 */

/**
 * How far below its hip a leg of this length reaches.
 *
 * The foot pad sits at -1.02 x length with a half-height of 0.1, and the claws
 * at -1.04 x length with a half-height of 0.065; whichever hangs lower is what
 * the animal is standing on. Kept in step with `legBoxes` by the stance test.
 */
export function legDrop(length) {
  return Math.max(1.02 * length + 0.1, 1.04 * length + 0.065)
}

/** Leg builds at the base proportions: `legBoxes(thickness, length)`. */
export const LEGS = {
  quadFront: { thickness: 0.92, length: 0.82 },
  quadBack: { thickness: 1.05, length: 0.9 },
  bipedBack: { thickness: 1.2, length: 1 },
}

/** Where the hindquarters sit before a build stretches the body. */
const HAUNCH_Y = 1.06
/** And the arms, on a biped. They never reach the ground. */
const ARM_HIP = [0.66, 1.2, 0.5]
/** Hip placement across and along the body, before a build's stretch. */
const HIP_X = { front: 0.5, back: -0.5 }
const HIP_Z = 0.46

/**
 * The whole standing arrangement for one animal.
 *
 * Returns the hip sockets in model space, the leg descriptions to hang off
 * them, and the lift that puts the lowest foot on y = 0.
 */
export function stanceFor(shape) {
  const build = buildFor(shape)
  const quad = shape?.legs === 4

  const backLeg = {
    ...(quad ? LEGS.quadBack : LEGS.bipedBack),
    length: (quad ? LEGS.quadBack.length : LEGS.bipedBack.length) * build.legLength,
  }
  const frontLeg = {
    ...LEGS.quadFront,
    length: LEGS.quadFront.length * build.legLength,
  }

  const haunchY = HAUNCH_Y * build.height
  const spread = HIP_Z * build.girth * build.stance

  const backHip = [HIP_X.back * build.length, haunchY, spread]
  /*
   * The shoulder is *derived*, not chosen: a quadruped's front legs are the
   * shorter pair, so a shoulder at the same height as the haunch left the
   * front feet a further two hundredths off the floor - the animal stood
   * nose-up on its front claws.
   */
  const frontHip = quad
    ? [HIP_X.front * build.length, haunchY - legDrop(backLeg.length) + legDrop(frontLeg.length), spread]
    : [ARM_HIP[0] * build.length, ARM_HIP[1] * build.height, ARM_HIP[2] * build.girth]

  const lowest = quad
    ? Math.min(backHip[1] - legDrop(backLeg.length), frontHip[1] - legDrop(frontLeg.length))
    : backHip[1] - legDrop(backLeg.length)

  return { quad, backLeg, frontLeg, backHip, frontHip, lowest, offset: -lowest }
}

/** Where the lowest foot of a build ends up, before any correction. */
export function lowestFoot(shape) {
  return stanceFor(shape).lowest
}

/** Lift (or drop) that puts that foot on the floor. */
export function groundOffset(shape) {
  return stanceFor(shape).offset
}
