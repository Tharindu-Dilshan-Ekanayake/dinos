/**
 * Debounced save/load of the full run to localStorage.
 *
 * All storage access funnels through this module: if the game is ever ported
 * to a sandbox without localStorage (a Claude Artifact, an SSR pass) the reads
 * and writes degrade to no-ops here and nothing else has to change.
 */
const SAVE_KEY = 'dino-evolution-save'
const SAVE_VERSION = 2
const DEBOUNCE_MS = 400

let timer = null
let pending = null

function storageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const probe = '__dino_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const available = storageAvailable()

/** Shape written to disk. Kept explicit so stray runtime state never leaks in. */
function serialise(state) {
  return {
    version: SAVE_VERSION,
    strength: state.strength,
    wins: state.wins,
    totalWins: state.totalWins,
    lifetimeWins: state.lifetimeWins,
    stageIndex: state.stageIndex,
    enemyHealth: state.enemyHealth,
    stageCleared: state.stageCleared,
    // What the run has already done to the corridor behind it. Without this a
    // reload mid-run restocks every level you had walked back through.
    chamberHealth: { ...state.chamberHealth },
    equippedIndex: state.equippedIndex,
    scene: state.scene,
    rebirths: state.rebirths,
    muted: state.muted,
    autoFight: state.autoFight,
    quality: state.quality,
    upgradeLevels: { ...state.upgradeLevels },
    trainedPower: state.trainedPower,
    battlePower: state.battlePower,
    bestStage: state.bestStage,
    playerName: state.playerName,
    savedAt: Date.now(),
  }
}

/** Load a save, or null when there is nothing valid stored. */
export function loadSave() {
  if (!available) return null
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    // Older saves only tracked rebirths; keep them rather than wiping progress.
    if (data.version !== SAVE_VERSION) {
      return {
        rebirths: Number(data.rebirths) || 0,
        muted: Boolean(data.muted),
        migrated: true,
      }
    }
    return data
  } catch {
    return null
  }
}

/** Queue a debounced write. Safe to call on every click. */
export function saveState(state) {
  if (!available) return
  pending = serialise(state)
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flushSave()
  }, DEBOUNCE_MS)
}

/** Write immediately - used on tab hide/unload so nothing is lost. */
export function flushSave() {
  if (!available || !pending) return
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(pending))
  } catch {
    /* quota or private mode - drop the write rather than crash the game */
  }
  pending = null
}

export function clearSave() {
  if (!available) return
  try {
    window.localStorage.removeItem(SAVE_KEY)
  } catch {
    /* nothing to do */
  }
  pending = null
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

export const persistenceAvailable = available
