/**
 * How readable a sign standing in the world should be from where you are.
 *
 * A level has four things with writing on them - the way on, the way back and
 * two cash-out pads - and every one of them used to shout at full volume from
 * anywhere in the chamber. Standing at a gate you got the sign in front of
 * you, the sign at the far end, and both pads, stacked up the middle of the
 * screen with the fight somewhere behind them.
 *
 * A sign is only worth reading when you are close enough to act on it, so that
 * is when it is drawn. Walk into the middle of a chamber and the writing gets
 * out of the way of the fight; walk up to a gate and it tells you where it
 * goes.
 */

/**
 * Close enough to be acting on it: full strength.
 *
 * Tight on purpose. At the first attempt a waymarker was still three-quarters
 * lit from the middle of the chamber, which is where the fight is - the whole
 * gain of fading them was given straight back.
 */
export const SIGN_NEAR = 7

/** Far enough that it is somebody else's business: gone. */
export const SIGN_FAR = 18

/** 0 when there is no reason to read it, 1 when you are standing at it. */
export function signOpacity(distance, near = SIGN_NEAR, far = SIGN_FAR) {
  if (distance <= near) return 1
  if (distance >= far) return 0
  const t = (far - distance) / (far - near)
  // Squared, so it stays out of the way until you have nearly arrived rather
  // than hanging around at half strength across the whole chamber.
  return t * t
}

/**
 * Apply an opacity to a drei <Text>.
 *
 * troika reads `fillOpacity` and `outlineOpacity` in its own onBeforeRender, so
 * these can be written every frame without a re-render and without the
 * `sync()` that changing the text itself would cost.
 */
export function fadeText(text, opacity) {
  if (!text) return
  text.fillOpacity = opacity
  text.outlineOpacity = opacity
  text.visible = opacity > 0.01
}
