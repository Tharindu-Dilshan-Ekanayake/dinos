/**
 * Training pads.
 *
 * Standing on a pad trains your dino: it adds permanent Damage over time, at
 * the pad's multiplier. Better pads are gated behind rebirth counts, so the
 * rebirth loop is what opens up faster training rather than just a bigger
 * number - exactly the pull that keeps a hub game moving.
 *
 * All the tuning lives here.
 */

/** Damage per second earned on a x1 pad. */
export const TRAIN_BASE_RATE = 0.8

/** How often training is committed to the store, in seconds. */
export const TRAIN_FLUSH_INTERVAL = 0.25

/** How close to a pad's centre you must stand to be training on it. */
export const PAD_RADIUS = 2.1

export const TRAINING_PADS = [
  { id: 'pad1', multiplier: 1, requiresRebirths: 0, color: '#e2e8f0', accent: '#94a3b8' },
  { id: 'pad2', multiplier: 2, requiresRebirths: 1, color: '#fde68a', accent: '#f59e0b' },
  { id: 'pad3', multiplier: 3, requiresRebirths: 3, color: '#c4b5fd', accent: '#8b5cf6' },
  { id: 'pad5', multiplier: 5, requiresRebirths: 6, color: '#a7f3d0', accent: '#10b981' },
  { id: 'pad8', multiplier: 8, requiresRebirths: 9, color: '#fca5a5', accent: '#ef4444' },
  { id: 'pad12', multiplier: 12, requiresRebirths: 12, color: '#93c5fd', accent: '#3b82f6' },
  { id: 'pad18', multiplier: 18, requiresRebirths: 15, color: '#f9a8d4', accent: '#ec4899' },
  { id: 'pad26', multiplier: 26, requiresRebirths: 20, color: '#5eead4', accent: '#14b8a6' },
  { id: 'pad40', multiplier: 40, requiresRebirths: 26, color: '#fdba74', accent: '#f97316' },
]

/** Damage per second earned on a pad. */
export function padRate(pad) {
  return TRAIN_BASE_RATE * pad.multiplier
}

/** Whether the player's rebirth count opens this pad. */
export function padUnlocked(pad, rebirths) {
  return rebirths >= pad.requiresRebirths
}

/** Best pad the player can currently use, for the HUD hint. */
export function bestUnlockedPad(rebirths) {
  let best = TRAINING_PADS[0]
  for (const pad of TRAINING_PADS) {
    if (padUnlocked(pad, rebirths)) best = pad
  }
  return best
}
