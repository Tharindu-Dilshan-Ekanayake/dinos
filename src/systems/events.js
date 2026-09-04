/**
 * Minimal synchronous pub/sub.
 *
 * The store stays the single source of truth for *state*; this bus only
 * carries one-shot *effects* (a hit landed, a stage cleared) to the imperative
 * layers - particles, camera shake, floating text, audio. Routing those
 * through React state would re-render the tree on every click, which a clicker
 * cannot afford.
 */
const listeners = new Map()

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(handler)
  return () => off(event, handler)
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler)
}

export function emit(event, payload) {
  const set = listeners.get(event)
  if (!set) return
  for (const handler of set) handler(payload)
}

/** Event names, centralised so typos surface fast. */
export const EVENTS = {
  HIT: 'hit',
  STAGE_CLEAR: 'stageClear',
  EVOLVE: 'evolve',
  REBIRTH: 'rebirth',
  AREA_CHANGE: 'areaChange',
  PURCHASE: 'purchase',
  DENIED: 'denied',
  READY: 'ready',
  ARENA_PROMPT: 'arenaPrompt',
  GATE_PROMPT: 'gatePrompt',
  RESPAWN: 'respawn',
  DEATH: 'death',
  STAGE_ENTER: 'stageEnter',
  CLAIM_WINS: 'claimWins',
  SCENE_CHANGE: 'sceneChange',
  PROMPT: 'prompt',
  OPEN_REBIRTH: 'openRebirth',
  TRAINING: 'training',
}
