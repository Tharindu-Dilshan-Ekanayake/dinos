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
 * The numbers live here rather than in the component so the offset is derived
 * from the same values the legs are built from, and so the claim can be
 * checked without rendering anything.
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

/** Leg builds: `legBoxes(thickness, length)`. */
export const LEGS = {
  quadFront: { thickness: 0.92, length: 0.82 },
  quadBack: { thickness: 1.05, length: 0.9 },
  bipedBack: { thickness: 1.2, length: 1 },
}

/** Where the hindquarters sit. Everything else is measured from here. */
const HAUNCH_Y = 1.06

/** Hip sockets, in the model's own frame. It faces +X. */
export const HIPS = {
  quadBack: [-0.5, HAUNCH_Y, 0.46],
  /*
   * The shoulder is *derived*, not chosen: a quadruped's front legs are the
   * shorter pair, so a shoulder at the same round number as the haunch left
   * the front feet a further two hundredths off the floor - the animal stood
   * nose-up on its front claws. Setting it from the difference in leg length
   * puts all four feet on one plane and keeps them there if a leg is retuned.
   */
  quadFront: [
    0.5,
    HAUNCH_Y - legDrop(LEGS.quadBack.length) + legDrop(LEGS.quadFront.length),
    0.46,
  ],
  bipedBack: [-0.5, HAUNCH_Y, 0.46],
  // A biped's front limbs are arms. They never reach the ground, so this one
  // is free to be placed by eye.
  bipedArm: [0.66, 1.2, 0.5],
}

/** Where the lowest foot of a given build ends up, before any correction. */
export function lowestFoot(quad) {
  if (!quad) return HIPS.bipedBack[1] - legDrop(LEGS.bipedBack.length)
  return Math.min(
    HIPS.quadBack[1] - legDrop(LEGS.quadBack.length),
    HIPS.quadFront[1] - legDrop(LEGS.quadFront.length)
  )
}

/** Lift (or drop) that puts that foot on the floor. */
export function groundOffset(quad) {
  return -lowestFoot(quad)
}
